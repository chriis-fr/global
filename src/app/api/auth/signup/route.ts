import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { CreateUserInput, CreateOrganizationInput } from '@/models';
import { createDefaultServices } from '@/lib/services/serviceManager';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/database';


export async function POST(request: NextRequest) {
  console.log('🚀 [SIGNUP] Starting signup process...');
  try {
    const body = await request.json();
    console.log('📥 [SIGNUP] Received request body:', { 
      email: body.email, 
      name: body.name, 
      userType: body.userType,
      hasPassword: !!body.password,
      hasAddress: !!body.address
    });
    
    const { email, password, name, userType, phone, industry, address, taxId, termsAgreement, companyName } = body;

    // Basic validation
    console.log('🔍 [SIGNUP] Validating required fields...');
    console.log('📋 [SIGNUP] Field validation:', {
      hasEmail: !!email,
      hasPassword: !!password,
      hasName: !!name,
      hasUserType: !!userType,
      hasAddress: !!address,
      hasIndustry: !!industry,
      hasTermsAgreement: !!termsAgreement
    });
    
    if (!email || !password || !name || !userType || !address) {
      console.log('❌ [SIGNUP] Validation failed - missing required fields');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Email, password, name, userType, and address are required' 
        },
        { status: 400 }
      );
    }
    
    // Validate company name for business users
    if (userType === 'business' && !companyName) {
      console.log('❌ [SIGNUP] Validation failed - company name required for business users');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Company name is required for business accounts' 
        },
        { status: 400 }
      );
    }
    
    // Validate terms agreement
    if (!termsAgreement || !termsAgreement.agreed) {
      console.log('❌ [SIGNUP] Validation failed - terms agreement required');
      return NextResponse.json(
        { 
          success: false, 
          message: 'You must agree to the Terms of Service and Privacy Policy to continue' 
        },
        { status: 400 }
      );
    }
    console.log('✅ [SIGNUP] Basic validation passed');

    // Check both: user and (for business) organization must not already exist
    console.log('🔍 [SIGNUP] Checking for existing user with email:', email);
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      console.log('❌ [SIGNUP] User already exists with email:', email);
      return NextResponse.json(
        { 
          success: false, 
          message: 'User with this email already exists' 
        },
        { status: 409 }
      );
    }
    console.log('✅ [SIGNUP] No existing user found - email available');

    // For business users, billing email = user email; ensure no org already has it
    if (userType === 'business') {
      console.log('🔍 [SIGNUP] Checking for existing organization with billing email:', email);
      const existingOrg = await OrganizationService.getOrganizationByBillingEmail(email);
      if (existingOrg) {
        console.log('❌ [SIGNUP] Organization already exists with billing email:', email);
        return NextResponse.json(
          { 
            success: false, 
            message: 'An organization with this billing email already exists' 
          },
          { status: 409 }
        );
      }
      console.log('✅ [SIGNUP] No existing organization found for billing email');
    }

    // Hash password
    console.log('🔐 [SIGNUP] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ [SIGNUP] Password hashed successfully');

    // Create user data
    console.log('📝 [SIGNUP] Creating user data object...');
    const userData: CreateUserInput = {
      email,
      password: hashedPassword,
      name,
      role: userType === 'business' ? 'admin' : 'user',
      userType,
      phone,
      industry,
      address,
      taxId,
      termsAgreement,
      walletAddresses: [],
      settings: {
        currencyPreference: 'USD',
        notifications: {
          email: true,
          sms: false,
          push: false,
          inApp: true,
          invoiceCreated: true,
          invoicePaid: true,
          invoiceOverdue: true,
          paymentReceived: true,
          paymentFailed: true,
          systemUpdates: true,
          securityAlerts: true,
          reminders: true,
          approvals: true,
          frequency: 'immediate',
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'UTC'
          }
        }
      },
      services: createDefaultServices(),
      onboarding: {
        completed: false,
        currentStep: 1,
        completedSteps: ['signup'],
        serviceOnboarding: {}
      }
    };
    console.log('📋 [SIGNUP] User data prepared:', {
      email: userData.email,
      name: userData.name,
      userType: userData.userType,
      role: userData.role,
      hasAddress: !!userData.address,
      hasServices: !!userData.services,
      hasOnboarding: !!userData.onboarding
    });

    console.log('💾 [SIGNUP] Calling UserService.createUser...');
    const newUser = await UserService.createUser(userData);
    console.log('✅ [SIGNUP] User created successfully with ID:', newUser._id);
    
    // Process any pending payables for this email
    try {
      console.log('🔄 [SIGNUP] Processing pending payables for:', email);
      await processPendingPayablesForUser(newUser._id!.toString(), email);
    } catch (pendingError) {
      console.error('⚠️ [SIGNUP] Error processing pending payables:', pendingError);
      // Don't fail signup if pending payables processing fails
    }
    
    // Check if this is an invitation signup (user will join existing organization)
    const isInvitationSignup = body.invitationToken || body.isInvitationSignup;
    
    console.log('🔍 [SIGNUP] Invitation signup check:', {
      isInvitationSignup,
      invitationToken: body.invitationToken,
      isInvitationSignupFlag: body.isInvitationSignup,
      userType
    });
    
    // If this is a business user, create an organization (unless it's an invitation signup)
    let organization = null;
    if (userType === 'business' && !isInvitationSignup) {
      console.log('🏢 [SIGNUP] Creating organization for business user...');
      
      const orgData: CreateOrganizationInput = {
        name: companyName, // Use company name for organization, not user name
        billingEmail: email,
        industry: industry || 'Other',
        companySize: '1-10', // Default size, can be updated later
        businessType: 'LLC', // Default type, can be updated later
        phone: phone || '',
        address: address,
        taxId: taxId || '',
        primaryContact: {
          name: name, // User's actual name for primary contact
          email: email,
          phone: phone || '',
          role: 'Owner'
        },
        members: [{
          userId: new ObjectId(newUser._id),
          email: email,
          name: name,
          role: 'owner',
          permissions: {
            canAddPaymentMethods: true,
            canModifyPaymentMethods: true,
            canManageTreasury: true,
            canManageTeam: true,
            canInviteMembers: true,
            canRemoveMembers: true,
            canManageCompanyInfo: true,
            canManageSettings: true,
            canCreateInvoices: true,
            canSendInvoices: true,
            canManageInvoices: true,
            canCreateBills: true,
            canApproveBills: true,
            canExecutePayments: true,
            canManagePayables: true,
            canViewAllData: true,
            canExportData: true,
            canReconcileTransactions: true,
            canManageAccounting: true,
            canApproveDocuments: true,
            canManageApprovalPolicies: true,
            canClosePeriod: true,
            canReopenPeriod: true,
            canWriteOff: true,
            canBulkUpdate: true,
            canViewAudit: true
          },
          status: 'active',
          invitedBy: new ObjectId(newUser._id),
          joinedAt: new Date(),
          lastActiveAt: new Date()
        }],
        services: createDefaultServices(),
        onboarding: {
          completed: false,
          currentStep: 1,
          completedSteps: ['creation'],
          serviceOnboarding: {}
        }
      };
      
      organization = await OrganizationService.createOrganization(orgData);
      console.log('✅ [SIGNUP] Organization created successfully with ID:', organization._id);
      
      // Update the user to link them to the organization
      if (newUser._id) {
        await UserService.updateUser(newUser._id.toString(), {
          organizationId: new ObjectId(organization._id)
        });
        console.log('🔗 [SIGNUP] User linked to organization');
        
        // Update the user object to include the organization ID
        newUser.organizationId = new ObjectId(organization._id);
      }
    }

    // Note: Trial is already initialized in UserService.createUser with trial-premium plan
    // No need to call initializeTrial again - subscription is set in UserService
    if (!isInvitationSignup) {
      console.log('✅ [SIGNUP] User created with trial-premium subscription (already set in UserService)');
      
      // If organization was created, ensure the owner has proper permissions
      if (organization && organization._id && newUser._id) {
        console.log('🔄 [SIGNUP] Setting up owner permissions for organization...');
        
        const db = await getDatabase();
        await db.collection('organizations').updateOne(
          { 
            _id: new ObjectId(organization._id),
            'members.userId': new ObjectId(newUser._id)
          },
          { 
            $set: { 
              'members.$.role': 'owner',
              'members.$.permissions': {
                canAddPaymentMethods: true,
                canModifyPaymentMethods: true,
                canManageTreasury: true,
                canManageTeam: true,
                canInviteMembers: true,
                canRemoveMembers: true,
                canManageCompanyInfo: true,
                canManageSettings: true,
                canCreateInvoices: true,
                canSendInvoices: true,
                canManageInvoices: true,
                canCreateBills: true,
                canApproveBills: true,
                canExecutePayments: true,
                canManagePayables: true,
                canViewAllData: true,
                canExportData: true,
                canReconcileTransactions: true,
                canManageAccounting: true,
                canApproveDocuments: true,
                canManageApprovalPolicies: true,
                canClosePeriod: true,
                canReopenPeriod: true,
                canWriteOff: true,
                canBulkUpdate: true,
                canViewAudit: true
              },
              updatedAt: new Date()
            }
          }
        );
        console.log('✅ [SIGNUP] Organization member updated with owner role and permissions');
      }
    } else {
      console.log('⏭️ [SIGNUP] Skipping trial initialization for invitation signup - will use organization subscription');
    }
    
    // Remove password from response - extract password to exclude it from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: removedPassword, ...userWithoutPassword } = newUser;
    
    console.log('📤 [SIGNUP] Sending success response with auto-login data...');
    return NextResponse.json({
      success: true,
      data: userWithoutPassword,
      organization: organization ? {
        _id: organization._id,
        name: organization.name,
        industry: organization.industry
      } : null,
      message: 'User created successfully',
      autoLogin: {
        email: email,
        password: password // Send back for automatic login
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('❌ [SIGNUP] Error creating user:', error);
    console.error('🔍 [SIGNUP] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process pending payables for a newly created user
 */
async function processPendingPayablesForUser(userId: string, userEmail: string) {
  try {
    console.log('🔄 [Process Pending Payables] Processing for user:', userEmail);

    const { connectToDatabase } = await import('@/lib/database');
    const db = await connectToDatabase();
    const pendingPayablesCollection = db.collection('pending_payables');
    const payablesCollection = db.collection('payables');

    // Find all pending payables for this user's email
    const pendingPayables = await pendingPayablesCollection.find({
      recipientEmail: userEmail,
      processed: false
    }).toArray();

    if (pendingPayables.length === 0) {
      console.log('✅ [Process Pending Payables] No pending payables found');
      return;
    }

    console.log(`📋 [Process Pending Payables] Found ${pendingPayables.length} pending payables`);

    let processedCount = 0;

    for (const pendingPayable of pendingPayables) {
      try {
        // Check if payable already exists
        const existingPayable = await payablesCollection.findOne({
          relatedInvoiceId: pendingPayable.invoiceId,
          issuerId: new ObjectId(userId)
        });

        if (existingPayable) {
          console.log('✅ [Process Pending Payables] Payable already exists, marking as processed');
          await pendingPayablesCollection.updateOne(
            { _id: pendingPayable._id },
            { $set: { processed: true, processedAt: new Date() } }
          );
          continue;
        }

        // Generate payable number
        const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Create payable data
        const payableData = {
          payableNumber,
          payableName: `Invoice Payment - ${pendingPayable.invoiceData.invoiceNumber}`,
          issueDate: new Date(),
          dueDate: new Date(pendingPayable.invoiceData.dueDate),
          companyName: pendingPayable.invoiceData.companyDetails?.name || '',
          companyEmail: pendingPayable.invoiceData.companyDetails?.email || '',
          companyPhone: pendingPayable.invoiceData.companyDetails?.phone || '',
          companyAddress: pendingPayable.invoiceData.companyDetails?.address || {},
          companyTaxNumber: '',
          vendorName: pendingPayable.invoiceData.clientDetails?.name || '',
          vendorEmail: pendingPayable.invoiceData.clientDetails?.email || '',
          vendorPhone: pendingPayable.invoiceData.clientDetails?.phone || '',
          vendorAddress: pendingPayable.invoiceData.clientDetails?.address || {},
          currency: pendingPayable.invoiceData.currency,
          paymentMethod: pendingPayable.invoiceData.paymentMethod,
          paymentNetwork: pendingPayable.invoiceData.paymentNetwork,
          paymentAddress: pendingPayable.invoiceData.paymentAddress,
          enableMultiCurrency: false,
          payableType: 'regular',
          items: pendingPayable.invoiceData.items || [],
          subtotal: pendingPayable.invoiceData.subtotal || 0,
          totalTax: pendingPayable.invoiceData.totalTax || 0,
          total: pendingPayable.invoiceData.totalAmount || 0,
          memo: `Auto-generated payable from invoice ${pendingPayable.invoiceData.invoiceNumber}`,
          status: 'pending',
          priority: 'medium',
          category: 'Invoice Payment',
          attachedFiles: [],
          issuerId: new ObjectId(userId),
          organizationId: null, // Will be updated if user has organization
          relatedInvoiceId: pendingPayable.invoiceId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Insert payable
        const result = await payablesCollection.insertOne(payableData);
        console.log('✅ [Process Pending Payables] Payable created with ID:', result.insertedId);

        // Mark as processed
        await pendingPayablesCollection.updateOne(
          { _id: pendingPayable._id },
          { $set: { processed: true, processedAt: new Date() } }
        );

        // Sync to financial ledger
        try {
          const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
          const payableWithId = { _id: result.insertedId, ...payableData };
          await LedgerSyncService.syncPayableToLedger(payableWithId);
          console.log('✅ [Process Pending Payables] Payable synced to ledger');
        } catch (syncError) {
          console.error('⚠️ [Process Pending Payables] Failed to sync payable to ledger:', syncError);
        }

        processedCount++;

      } catch (error) {
        console.error('❌ [Process Pending Payables] Error processing pending payable:', error);
        // Continue with other payables even if one fails
      }
    }

    console.log(`✅ [Process Pending Payables] Successfully processed ${processedCount} payables`);

  } catch (error) {
    console.error('❌ [Process Pending Payables] Error:', error);
    throw error;
  }
} 