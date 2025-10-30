import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId, Db } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';
import { SubscriptionService } from '@/lib/services/subscriptionService';
import { canCreateInvoice } from '@/lib/actions/subscription';

// Secure invoice number generation function
const generateSecureInvoiceNumber = async (db: Db, organizationId: string, ownerId: string, excludeNumber?: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Create a short, secure identifier from organization/user ID
  let secureId: string;
  if (organizationId) {
    // For organizations, use last 4 chars of org ID
    secureId = organizationId.slice(-4);
  } else {
    // For individual users, create a unique identifier from email
    // Take first 4 chars of username + first 2 chars of domain (more readable)
    const emailParts = ownerId.split('@');
    const username = emailParts[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const domain = emailParts[1]?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'XX';
    secureId = `${username}${domain}`.toUpperCase();
  }
  
  // Query for the last invoice number for this organization/user
  let query: { organizationId?: string } | { ownerId: string };
  if (organizationId) {
    // For organizations, look for invoices with this organizationId
    query = { organizationId: organizationId };
  } else {
    // For individual users, look for invoices with this ownerId (email)
    query = { ownerId: ownerId };
  }
  
  const lastInvoice = await db.collection('invoices').findOne(
    query,
    { 
      sort: { invoiceNumber: -1 },
      projection: { invoiceNumber: 1 }
    }
  );

  let sequence = 1;
  
  if (lastInvoice?.invoiceNumber) {
    // Extract sequence from existing invoice number
    const match = lastInvoice.invoiceNumber.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  // Generate the invoice number
  let invoiceNumber = `INV-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  
  // If we need to exclude a specific number, check if it matches and increment if needed
  if (excludeNumber && invoiceNumber === excludeNumber) {
    sequence++;
    invoiceNumber = `INV-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Double-check that the generated number doesn't exist
  const existingInvoice = await db.collection('invoices').findOne(
    { invoiceNumber: invoiceNumber }
  );
  
  if (existingInvoice) {
    // If it exists, find all invoices for this month and get the highest sequence
    const allInvoices = await db.collection('invoices').find(
      { 
        invoiceNumber: { $regex: `^INV-${secureId}-${currentYear}${currentMonth}-` }
      },
      { 
        sort: { invoiceNumber: -1 },
        projection: { invoiceNumber: 1 }
      }
    ).toArray();
    
    // Get all sequences and find the highest one
    const usedSequences = allInvoices.map(inv => {
      const match = inv.invoiceNumber.match(/-(\d{4})$/);
      return match ? parseInt(match[1]) : 0;
    });
    
    // Find the highest sequence and increment by 1
    const highestSequence = Math.max(...usedSequences, 0);
    sequence = highestSequence + 1;
    
    invoiceNumber = `INV-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  }

  return invoiceNumber;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can create invoice using server action
    const canCreate = await canCreateInvoice();
    
    if (!canCreate.allowed) {
      console.log('❌ [API Invoices] Invoice creation blocked:', canCreate.reason);
      return NextResponse.json({
        success: false,
        error: canCreate.reason,
        requiresUpgrade: canCreate.requiresUpgrade
      }, { status: 403 });
    }

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoiceNumber,
      issueDate,
      dueDate,
      companyLogo,
      companyName,
      companyAddress,
      companyTaxNumber,
      clientName,
      clientCompany,
      clientEmail,
      clientAddress,
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      invoiceType,
      items,
      subtotal,
      totalTax,
      total,
      memo,
      status,
      createdAt,
      updatedAt,
      invoiceName,
      companyEmail,
      companyPhone,
      clientPhone
    } = body;

    // Amount validation and logging
    console.log('📊 [API Invoices] Received invoice amounts:', {
      subtotal,
      totalTax,
      total,
      currency
    });

    await connectToDatabase();

    // Determine if user is individual or organization
    // For organization owners, they should create organization invoices
    const isOrganization = !!session.user.organizationId;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    // Connect to database
    const db = await connectToDatabase();

    // Check if approval is required based on organization settings
    let requiresApproval = false;
    let initialStatus = status || 'pending';
    let organization = null;

    if (isOrganization && ownerId) {
      // Get organization approval settings
      organization = await db.collection('organizations').findOne({
        _id: new ObjectId(ownerId)
      });

      console.log('🔍 [Approval Check] Organization approval settings:', {
        hasApprovalSettings: !!organization?.approvalSettings,
        requireApproval: organization?.approvalSettings?.requireApproval,
        amountThresholds: organization?.approvalSettings?.approvalRules?.amountThresholds,
        invoiceAmount: parseFloat(total) || 0
      });

      if (organization?.approvalSettings?.requireApproval) {
        // Check if user is owner/admin (can bypass approval)
        const userMember = organization.members.find((member: { userId: ObjectId; role: string }) => 
          member.userId.toString() === session.user.id && 
          (member.role === 'owner' || member.role === 'admin')
        );

        console.log('🔍 [Approval Check] User member details:', {
          isOwnerOrAdmin: !!userMember,
          userRole: userMember?.role,
          userId: session.user.id
        });

        // ALL users (including owners) need approval when approval is enabled
        // This ensures proper oversight and prevents owners from bypassing approval
        requiresApproval = true;
        initialStatus = 'pending_approval';
        console.log('⏳ [Approval Check] Approval required for all users (including owners) when approval is enabled');
      } else {
        console.log('ℹ️ [Approval Check] Approval not required for this organization');
      }
    }

    // Check if recipient is an organization
    let recipientType = 'individual';
    let recipientOrganization = null;
    
    if (clientEmail) {
      // Check if the recipient email belongs to an organization's primary email
      recipientOrganization = await db.collection('organizations').findOne({
        billingEmail: clientEmail
      });
      
      if (recipientOrganization) {
        recipientType = 'organization';
        console.log('🏢 [Invoice Creation] Recipient is organization:', recipientOrganization.name);
      } else {
        console.log('👤 [Invoice Creation] Recipient is individual user');
      }
    }

    // Generate secure invoice number if not provided or if provided number already exists
    let finalInvoiceNumber = invoiceNumber;
    
    if (finalInvoiceNumber) {
      // Check if the provided invoice number already exists
      const existingInvoice = await db.collection('invoices').findOne(
        { invoiceNumber: finalInvoiceNumber }
      );
      
      if (existingInvoice) {
        console.log('⚠️ [API Invoices] Provided invoice number already exists, generating new one:', finalInvoiceNumber);
        finalInvoiceNumber = await generateSecureInvoiceNumber(
          db, 
          session.user.organizationId || '', 
          ownerId || ''
        );
      }
    } else {
      // No invoice number provided, generate a new one
      finalInvoiceNumber = await generateSecureInvoiceNumber(
        db, 
        session.user.organizationId || '', 
        ownerId || '',
        undefined // No exclusion needed for initial generation
      );
    }

    console.log('💾 [API Invoices] Saving invoice:', {
      invoiceNumber: finalInvoiceNumber,
      ownerType,
      ownerId,
      total,
      requiresApproval,
      initialStatus,
      isOrganization,
      approvalSettings: organization?.approvalSettings ? 'enabled' : 'disabled'
    });

    // Transform data to match InvoiceFormData structure exactly
    const invoiceData = {
      // Basic invoice info
      invoiceNumber: finalInvoiceNumber,
      invoiceName: invoiceName || `Invoice ${finalInvoiceNumber}`,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      
      // Owner information
      ownerId, // Dynamic owner ID (email for individual, organizationId for org)
      ownerType, // 'individual' or 'organization'
      userId: session.user.email, // Keep for backward compatibility
      organizationId: session.user.organizationId || null, // Don't assign random ObjectId for individuals
      issuerId: session.user.id || new ObjectId(),
      
      // Company information
      companyLogo: companyLogo,
      companyName: companyName,
      companyEmail: companyEmail,
      companyPhone: companyPhone,
      companyAddress: {
        street: companyAddress?.street || '',
        city: companyAddress?.city || '',
        state: companyAddress?.state || '',
        zipCode: companyAddress?.zipCode || '',
        country: companyAddress?.country || ''
      },
      companyTaxNumber: companyTaxNumber,
      
      // Client information
      clientName: clientName,
      clientCompany: clientCompany,
      clientEmail: clientEmail,
      clientPhone: clientPhone,
      clientAddress: {
        street: clientAddress?.street || '',
        city: clientAddress?.city || '',
        state: clientAddress?.state || '',
        zipCode: clientAddress?.zipCode || '',
        country: clientAddress?.country || ''
      },
      
      // Payment information
      currency: currency,
      paymentMethod: paymentMethod,
      paymentNetwork: paymentNetwork,
      paymentAddress: paymentAddress,
      bankName: bankName,
      accountNumber: accountNumber,
      routingNumber: routingNumber,
      enableMultiCurrency: enableMultiCurrency,
      
      // Invoice details
      invoiceType: invoiceType || 'regular',
      items: items.map((item: { id?: string; description: string; quantity: number; unitPrice: number; amount: number; tax: number; discount?: number }) => ({
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        amount: item.amount
      })),
      subtotal: subtotal,
      totalTax: totalTax,
      total: total,
      memo: memo,
      
      // Status and metadata
      status: initialStatus,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      
      // Approval workflow
      approvalWorkflow: requiresApproval ? {
        requiresApproval: true,
        submittedBy: session.user.id,
        submittedAt: new Date()
      } : undefined,
      
      // Approval tracking
      approvals: [], // Array of approval objects
      approvalCount: 0, // Current number of approvals
      requiredApprovals: requiresApproval ? (() => {
        // Calculate required approvals based on amount and settings
        if (organization?.approvalSettings) {
          const amount = parseFloat(total) || 0;
          const settings = organization.approvalSettings.approvalRules;
          if (amount >= settings.amountThresholds.high) {
            return settings.requiredApprovers.high;
          } else if (amount >= settings.amountThresholds.medium) {
            return settings.requiredApprovers.medium;
          } else {
            return settings.requiredApprovers.low;
          }
        }
        return 1; // Default
      })() : 0,
      
      // Backward compatibility - keep nested structure for existing code
      type: invoiceType || 'regular',
      companyDetails: {
        name: companyName,
        firstName: '',
        lastName: '',
        country: companyAddress?.country || '',
        region: companyAddress?.state || '',
        city: companyAddress?.city || '',
        postalCode: companyAddress?.zipCode || '',
        addressLine1: companyAddress?.street || '',
        addressLine2: '',
        taxNumber: companyTaxNumber,
        logo: companyLogo
      },
      clientDetails: {
        email: clientEmail,
        companyName: clientCompany || undefined,
        firstName: clientName || '',
        lastName: '',
        country: clientAddress?.country || '',
        region: clientAddress?.state || '',
        city: clientAddress?.city || '',
        postalCode: clientAddress?.zipCode || '',
        addressLine1: clientAddress?.street || '',
        addressLine2: '',
        taxNumber: ''
      },
      taxes: [{
        name: 'Tax',
        rate: totalTax / subtotal,
        amount: totalTax
      }],
      totalAmount: total,
      
      paymentSettings: {
        method: paymentMethod,
        currency,
        enableMultiCurrency,
        cryptoNetwork: paymentNetwork,
        walletAddress: paymentAddress,
        bankAccount: bankName ? {
          accountNumber: accountNumber || '',
          routingNumber: routingNumber || '',
          bankName,
          accountType: 'checking'
        } : undefined
      },
      notes: memo,
      pdfUrl: '',
      isTemplate: false,
      
      // Recipient type for conditional approval display
      recipientType: recipientType
    };

    // Use MongoDB directly since the model structure is complex
    let result: { insertedId: ObjectId } | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    let currentInvoiceNumber = finalInvoiceNumber;
    
    while (attempts < maxAttempts) {
      try {
        result = await db.collection('invoices').insertOne(invoiceData);
        break; // Success, exit the loop
      } catch (error: unknown) {
        attempts++;
        
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
          // Duplicate key error - generate a new invoice number and try again
          const newInvoiceNumber = await generateSecureInvoiceNumber(
            db, 
            session.user.organizationId || '', 
            ownerId || '',
            currentInvoiceNumber // Exclude the current number that caused the conflict
          );
          
          currentInvoiceNumber = newInvoiceNumber;
          invoiceData.invoiceNumber = newInvoiceNumber;
          invoiceData.invoiceName = invoiceName || `Invoice ${newInvoiceNumber}`;
          
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique invoice number after multiple attempts');
          }
        } else {
          // Non-duplicate error, throw immediately
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error('Failed to insert invoice - no result returned');
    }
    
    console.log('✅ [API Invoices] Invoice saved successfully');

    // Sync to financial ledger
    try {
      const invoiceWithId = { _id: result.insertedId, ...invoiceData };
      await LedgerSyncService.syncInvoiceToLedger(invoiceWithId);
      console.log('✅ [API Invoices] Invoice synced to ledger');
    } catch (syncError) {
      console.error('⚠️ [API Invoices] Failed to sync invoice to ledger:', syncError);
      // Don't fail the request if sync fails
    }

           // After successful invoice creation, increment usage:
           await SubscriptionService.incrementInvoiceUsage(
             new ObjectId(session.user.id)
           );

           // Send approval notifications if invoice requires approval
           if (requiresApproval && organization) {
             try {
               const { NotificationService } = await import('@/lib/services/notificationService');
               
               // Get all admins, approvers, and owners who can approve
               const approvers = organization.members.filter((member: { role: string; userId: ObjectId }) => 
                 (member.role === 'owner' || member.role === 'admin' || member.role === 'approver') && 
                 member.userId.toString() !== session.user.id // Don't notify the creator
               );

               console.log('📧 [Approval Notifications] Found approvers:', {
                 totalApprovers: approvers.length,
                 approverRoles: approvers.map((a: { role: string }) => a.role),
                 creatorId: session.user.id,
                 organizationMembers: organization.members.map((m: { role: string; userId: ObjectId }) => ({ role: m.role, userId: m.userId.toString() }))
               });

               // Send notification to each approver
               for (const approver of approvers) {
                 const approverUser = await db.collection('users').findOne({
                   _id: new ObjectId(approver.userId)
                 });

                 if (approverUser?.email) {
                   console.log('📧 [Approval Notifications] Sending notification to:', {
                     email: approverUser.email,
                     name: approverUser.name || approverUser.email,
                     role: approver.role
                   });
                   
                   await NotificationService.sendInvoiceApprovalRequest(
                     approverUser.email,
                     approverUser.name || approverUser.email,
                     {
                       invoiceNumber: finalInvoiceNumber,
                       invoiceName: invoiceName || 'Invoice',
                       amount: parseFloat(total) || 0,
                       currency: currency || 'USD',
                       clientName: clientName || 'Unknown Client',
                       clientEmail: clientEmail || '',
                       dueDate: dueDate
                     },
                     organization.name,
                     session.user.name || session.user.email || 'Unknown User'
                   );
                 } else {
                   console.log('⚠️ [Approval Notifications] Approver user not found:', {
                     userId: approver.userId.toString(),
                     role: approver.role
                   });
                 }
               }

               console.log('✅ [API Invoices] Approval notifications sent to', approvers.length, 'approvers');
             } catch (notificationError) {
               console.error('⚠️ [API Invoices] Failed to send approval notifications:', notificationError);
               // Don't fail the request if notifications fail
             }
           }

           return NextResponse.json({
             success: true,
             message: 'Invoice saved successfully',
             invoice: { _id: result.insertedId, ...invoiceData }
           });

  } catch (error) {
    console.error('❌ [API Invoices] Error saving invoice:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to save invoice';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const convertToPreferred = searchParams.get('convertToPreferred') === 'true';

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    let query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    if (status) {
      query = { ...query, status } as typeof query & { status: string };
    }

    // Add date range filtering
    if (dateFrom || dateTo) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (dateFrom) {
        dateFilter.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.$lte = new Date(dateTo + 'T23:59:59.999Z'); // End of day
      }
      query = { ...query, createdAt: dateFilter } as typeof query & { createdAt: { $gte?: Date; $lte?: Date } };
    }

    // Get total count
    const total = await invoicesCollection.countDocuments(query);

    // Get status counts for all invoices (not just paginated ones)
    const statusCounts = await Promise.all([
      invoicesCollection.countDocuments({ ...query, status: 'draft' }),
      invoicesCollection.countDocuments({ ...query, status: 'sent' }),
      invoicesCollection.countDocuments({ ...query, status: 'pending' }),
      invoicesCollection.countDocuments({ ...query, status: 'paid' }),
      invoicesCollection.countDocuments({ ...query, status: 'overdue' })
    ]);

    const [draftCount, sentCount, pendingCount, paidCount, overdueCount] = statusCounts;

    // Get invoices with pagination
    const skip = (page - 1) * limit;
    let invoices = await invoicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Convert currencies if requested
    if (convertToPreferred) {
      const convertedInvoices = await Promise.all(
        invoices.map(invoice => 
          CurrencyService.convertInvoiceForReporting(invoice as { [key: string]: unknown }, preferredCurrency)
        )
      );
      invoices = convertedInvoices as typeof invoices;
    }

    // Calculate total revenue in preferred currency
    // Only include approved invoices (approved, sent, paid) - exclude pending_approval, rejected, draft, cancelled
    const baseRevenueQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };
    
    // Add status filter to only include approved invoices
    const revenueQuery = {
      ...baseRevenueQuery,
      status: { $in: ['approved', 'sent', 'paid'] }
    };
    
    const allInvoices = await invoicesCollection.find(revenueQuery).toArray();
    
    // Always convert total revenue to user's preferred currency for consistent display
    // The convertToPreferred parameter only affects individual invoice conversion, not total revenue
    
    const totalRevenue = await CurrencyService.calculateTotalRevenue(allInvoices as { [key: string]: unknown }[], preferredCurrency);
    

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalRevenue,
          preferredCurrency,
          totalInvoices: total,
          statusCounts: {
            draft: draftCount,
            sent: sentCount,
            pending: pendingCount,
            paid: paidCount,
            overdue: overdueCount
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
} 