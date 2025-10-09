import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendInvoiceNotification } from '@/lib/services/emailService';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { UserService } from '@/lib/services/userService';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ [Send Invoice] JSON parsing error:', error);
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { invoiceId, recipientEmail, pdfBuffer, attachedFiles } = body;

    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID and recipient email are required' },
        { status: 400 }
      );
    }

    // Connect to database
    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get the invoice - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { 
          _id: new ObjectId(invoiceId), 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    let invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      console.log('❌ [Send Invoice] Invoice not found with primary query:', {
        invoiceId,
        ownerType: isOrganization ? 'organization' : 'individual',
        ownerId: isOrganization ? session.user.organizationId : session.user.email,
        userEmail: session.user.email,
        query: query
      });
      
      // Try to find the invoice without organization filter to debug
      const debugInvoice = await invoicesCollection.findOne({ _id: new ObjectId(invoiceId) });
      if (debugInvoice) {
        console.log('🔍 [Send Invoice] Debug - Invoice exists but query failed:', {
          invoiceId,
          foundInvoice: {
            _id: debugInvoice._id,
            invoiceNumber: debugInvoice.invoiceNumber,
            organizationId: debugInvoice.organizationId,
            issuerId: debugInvoice.issuerId,
            userId: debugInvoice.userId,
            status: debugInvoice.status
          },
          userSession: {
            id: session.user.id,
            email: session.user.email,
            organizationId: session.user.organizationId
          }
        });
        
        // Try a more permissive query as fallback
        console.log('🔄 [Send Invoice] Trying fallback query...');
        const fallbackQuery = {
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email },
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        };
        
        const fallbackInvoice = await invoicesCollection.findOne(fallbackQuery);
        if (fallbackInvoice) {
          console.log('✅ [Send Invoice] Found invoice with fallback query, using it');
          invoice = fallbackInvoice;
        } else {
          console.log('❌ [Send Invoice] Fallback query also failed');
          return NextResponse.json(
            { success: false, message: 'Invoice not found' },
            { status: 404 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, message: 'Invoice not found' },
          { status: 404 }
        );
      }
    }

    console.log('✅ [Send Invoice] Invoice found:', {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceName: invoice.invoiceName,
      total: invoice.total,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      organizationId: invoice.organizationId,
      issuerId: invoice.issuerId,
      userId: invoice.userId
    });

    // Check if invoice requires approval and is not yet approved
    if (invoice.status === 'pending_approval') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invoice is pending approval and cannot be sent yet',
          requiresApproval: true,
          status: 'pending_approval'
        },
        { status: 200 } // Return 200 instead of 400 for better UX
      );
    }

    // Check if invoice was rejected
    if (invoice.status === 'rejected') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invoice was rejected and cannot be sent',
          status: 'rejected'
        },
        { status: 200 } // Return 200 instead of 400 for better UX
      );
    }

    // Allow sending approved invoices
    if (invoice.status === 'approved') {
      console.log('📧 [Send Invoice] Sending approved invoice:', invoice.invoiceNumber);
    }


    // Prepare payment methods for display
    const paymentMethods: string[] = [];
    if (invoice.paymentSettings?.method === 'fiat') {
      paymentMethods.push('Bank Transfer');
    }
    if (invoice.paymentSettings?.method === 'crypto') {
      paymentMethods.push('Cryptocurrency');
    }

    // Convert PDF buffer if provided
    let pdfAttachment: Buffer | undefined;
    if (pdfBuffer) {
      pdfAttachment = Buffer.from(pdfBuffer, 'base64');
    }

    // Convert attached files to buffers
    const additionalAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const file of attachedFiles) {
        if (file.filename && file.content && file.contentType) {
          additionalAttachments.push({
            filename: file.filename,
            content: Buffer.from(file.content, 'base64'),
            contentType: file.contentType
          });
        }
      }
    }

    // Determine the greeting name - always use the client name
    const fullName = [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ');
    
    
    const greetingName = invoice.clientDetails?.companyName 
      ? (fullName || invoice.clientDetails?.companyName) // If company exists, use individual name or company name
      : (fullName || 'Client'); // If no company, use individual name or 'Client'
    

    // Generate secure access token for the invoice
    console.log('🔐 [Send Invoice] Generating secure access token...');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const baseUrl = frontendUrl.startsWith('http') ? frontendUrl : `https://${frontendUrl}`;
    
    let accessUrl = `${baseUrl}/invoice/${invoice.invoiceNumber}`; // Fallback
    
    try {
      // Generate token directly instead of making HTTP call
      const accessTokensCollection = db.collection('invoice_access_tokens');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Handle both MongoDB ObjectIds and OAuth IDs for createdBy
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
      const createdBy = isObjectId ? new ObjectId(session.user.id) : session.user.id;
      
      const tokenData = {
        token,
        invoiceId: new ObjectId(invoice._id as unknown as string),
        recipientEmail: recipientEmail,
        createdBy: createdBy,
        createdAt: new Date(),
        expiresAt,
        used: false,
        usedAt: null,
        usedBy: null
      };

      await accessTokensCollection.insertOne(tokenData);
      accessUrl = `${baseUrl}/invoice-access?token=${token}`;
      console.log('✅ [Send Invoice] Secure access token generated');
    } catch (tokenError) {
      console.error('❌ [Send Invoice] Failed to generate access token:', tokenError);
    }

    // Send invoice email with timeout
    let result: { success: boolean; messageId?: string; error?: Error };
    try {
      result = await Promise.race([
        sendInvoiceNotification(
          recipientEmail,
          greetingName, // Proper greeting name
          invoice.invoiceNumber,
          invoice.total || invoice.totalAmount || 0, // Use consistent field name
          invoice.currency,
          invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
          invoice.companyDetails?.name || (isOrganization ? 'Your Company' : ''), // Company name (empty for individuals)
          invoice.clientDetails?.companyName || fullName || 'Client', // Recipient name/company
          accessUrl, // Use secure access URL
          paymentMethods,
          pdfAttachment,
          additionalAttachments
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Email service timeout')), 120000) // 2 minute timeout
        )
      ]) as { success: boolean; messageId?: string; error?: Error };
    } catch (error) {
      console.error('❌ [Send Invoice] Email service error:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send invoice email - service timeout or error',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    if (result.success) {
      // Update invoice status to sent
      await invoicesCollection.updateOne(
        { _id: new ObjectId(invoiceId) },
        { 
          $set: { 
            status: 'sent',
            sentAt: new Date(),
            sentTo: recipientEmail
          }
        }
      );

      // Automatically create payable for recipient if they have an account
      try {
        await createPayableForRecipient(recipientEmail, invoice);
      } catch (payableError) {
        console.error('⚠️ [Send Invoice] Failed to create payable for recipient:', payableError);
        // Don't fail the email send if payable creation fails
      }

      return NextResponse.json({
        success: true,
        message: 'Invoice sent successfully',
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send invoice email',
          error: result.error?.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [Send Invoice] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send invoice' },
      { status: 500 }
    );
  }
}

/**
 * Automatically create a payable for the recipient when an invoice is sent
 * This ensures invoices appear in the recipient's app immediately
 */
async function createPayableForRecipient(recipientEmail: string, invoice: Record<string, unknown>) {
  try {
    console.log('💳 [Auto Payable] Checking if recipient is registered:', recipientEmail);

    // Check if recipient has an account
    let recipientUser = await UserService.getUserByEmail(recipientEmail);
    
    // If recipient email is not a registered user, check if it's an organization's primary email
    if (!recipientUser) {
      console.log('📧 [Auto Payable] Recipient email not found, checking if it\'s an organization primary email:', recipientEmail);
      
      const db = await connectToDatabase();
      const organization = await db.collection('organizations').findOne({
        billingEmail: recipientEmail
      });
      
      if (organization) {
        console.log('🏢 [Auto Payable] Found organization with this primary email, using organization owner:', organization.name);
        
        // Find the organization owner to use as the recipient user
        const owner = organization.members.find((member: any) => member.role === 'owner');
        if (owner) {
          recipientUser = await db.collection('users').findOne({
            _id: new ObjectId(owner.userId)
          });
          
          if (recipientUser) {
            console.log('✅ [Auto Payable] Using organization owner as recipient user:', recipientUser.email);
          }
        }
      }
    }
    
    if (!recipientUser) {
      console.log('📧 [Auto Payable] Recipient not registered, storing for future signup:', recipientEmail);
      
      // Store pending payable for when they sign up
      await storePendingPayable(recipientEmail, invoice);
      return;
    }

    console.log('✅ [Auto Payable] Recipient is registered, creating payable immediately');
    console.log('🔍 [Auto Payable] Recipient user details:', {
      _id: recipientUser._id,
      email: recipientUser.email,
      _idType: typeof recipientUser._id
    });

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Check if payable already exists for this invoice and recipient
    // Handle both MongoDB ObjectIds and OAuth IDs
    const isRecipientObjectId = /^[0-9a-fA-F]{24}$/.test(recipientUser._id as unknown as string);
    const recipientIssuerId = isRecipientObjectId ? new ObjectId(recipientUser._id as unknown as string) : recipientUser._id;
    
    const existingPayable = await payablesCollection.findOne({
      relatedInvoiceId: new ObjectId(invoice._id as unknown as string),
      issuerId: recipientIssuerId
    });

    if (existingPayable) {
      console.log('✅ [Auto Payable] Payable already exists for this invoice');
      return;
    }

    // Generate payable number
    const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Check if recipient is part of an organization and get approval settings
    let approvalWorkflow = null;
    let approvalStatus = 'pending';
    let payableStatus = 'pending';
    
    if (recipientUser.organizationId) {
      console.log('🏢 [Auto Payable] Recipient is organization member, checking approval settings');
      
      try {
        const { ApprovalService } = await import('@/lib/services/approvalService');
        const approvalSettings = await ApprovalService.getApprovalSettings(recipientUser.organizationId);
        
        if (approvalSettings?.requireApproval) {
          console.log('✅ [Auto Payable] Organization requires approval, creating workflow');
          
          // Create approval workflow for the payable
          approvalWorkflow = await ApprovalService.createApprovalWorkflow(
            null, // Will be set after payable creation
            recipientUser.organizationId,
            recipientUser._id?.toString() || recipientUser.email,
            parseFloat(invoice.total || invoice.totalAmount || 0) // Use consistent field name
          );
          
          if (approvalWorkflow) {
            approvalStatus = approvalWorkflow.status === 'approved' ? 'approved' : 'pending_approval';
            payableStatus = approvalWorkflow.status === 'approved' ? 'approved' : 'pending_approval';
            console.log('✅ [Auto Payable] Approval workflow created:', approvalWorkflow._id);
          }
        } else {
          console.log('✅ [Auto Payable] Organization has no approval requirements');
          approvalStatus = 'approved';
          payableStatus = 'approved';
        }
      } catch (approvalError) {
        console.error('⚠️ [Auto Payable] Failed to check approval settings:', approvalError);
        // Continue with default status if approval check fails
      }
    } else {
      console.log('👤 [Auto Payable] Recipient is individual user, no approval required');
      approvalStatus = 'approved';
      payableStatus = 'approved';
    }

    // Create comprehensive payable data with full tracking
    const payableData = {
      // Basic payable info
      payableNumber,
      payableName: `Invoice Payment - ${invoice.invoiceNumber}`,
      payableType: 'invoice_payment',
      
      // Organization/User identification
      issuerId: recipientIssuerId,
      userId: recipientEmail, // Use original recipient email, not organization owner's email
      organizationId: recipientUser.organizationId || null, // Set organization ID if user belongs to one
      ownerId: recipientUser.organizationId || recipientEmail, // Owner ID for ledger sync
      ownerType: recipientUser.organizationId ? 'organization' : 'individual', // Owner type for ledger sync
      
      // Dates and timing
      issueDate: new Date(),
      dueDate: new Date(invoice.dueDate as string),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentDate: null, // Will be set when payment is made
      
      // Company information (sender)
      companyName: (invoice.companyDetails as Record<string, unknown>)?.name || invoice.companyName,
      companyEmail: (invoice.companyDetails as Record<string, unknown>)?.email || invoice.companyEmail,
      companyPhone: (invoice.companyDetails as Record<string, unknown>)?.phone || invoice.companyPhone,
      companyAddress: (invoice.companyDetails as Record<string, unknown>)?.address || invoice.companyAddress,
      companyTaxNumber: (invoice.companyDetails as Record<string, unknown>)?.taxNumber || '',
      
      // Vendor information (recipient)
      vendorName: (invoice.clientDetails as Record<string, unknown>)?.name || invoice.clientName,
      vendorEmail: recipientEmail, // Use original recipient email
      vendorPhone: (invoice.clientDetails as Record<string, unknown>)?.phone || invoice.clientPhone,
      vendorAddress: (invoice.clientDetails as Record<string, unknown>)?.address || invoice.clientAddress,
      
      // Payment information
      currency: invoice.currency,
      paymentMethod: invoice.paymentMethod,
      paymentNetwork: invoice.paymentNetwork,
      paymentAddress: invoice.paymentAddress,
      enableMultiCurrency: invoice.enableMultiCurrency || false,
      
      // Financial details
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      totalTax: invoice.totalTax || 0,
      total: invoice.total || invoice.totalAmount || 0, // Use consistent field name
      memo: `Auto-generated payable from invoice ${invoice.invoiceNumber}`,
      
      // Status and workflow
      status: payableStatus, // pending, approved, paid, overdue, cancelled
      priority: 'medium', // low, medium, high, urgent
      category: 'Invoice Payment',
      
      // Approval workflow
      approvalStatus: approvalStatus, // pending, approved, rejected
      approvalWorkflowId: approvalWorkflow?._id || null,
      approvedBy: null,
      approvedAt: null,
      approvalNotes: '',
      
      // Payment tracking
      paymentStatus: 'pending', // pending, processing, completed, failed
      paymentMethodDetails: {
        method: invoice.paymentMethod,
        network: invoice.paymentNetwork,
        address: invoice.paymentAddress,
        bankDetails: invoice.bankAccount || null,
        cryptoDetails: invoice.paymentMethod === 'crypto' ? {
          network: invoice.paymentNetwork,
          address: invoice.paymentAddress,
          token: invoice.currency
        } : null
      },
      
      // System tracking
      attachedFiles: [],
      issuerId: recipientIssuerId,
      userId: recipientUser.email, // Add userId field for query compatibility
      organizationId: recipientUser.organizationId ? new ObjectId(recipientUser.organizationId) : null,
      relatedInvoiceId: new ObjectId(invoice._id as unknown as string),
      
      // Ledger integration
      ledgerEntryId: null, // Will be set by ledger sync
      ledgerStatus: 'pending', // pending, synced, updated
      
      // Frequency and recurring (for future use)
      frequency: 'one_time', // one_time, weekly, monthly, quarterly, yearly
      recurringEndDate: null,
      
      // Audit trail
      statusHistory: [{
        status: 'pending',
        changedBy: 'system',
        changedAt: new Date(),
        notes: 'Payable created from invoice'
      }],
      
      // Notifications
      lastNotificationSent: null,
      notificationCount: 0
    };

    const result = await payablesCollection.insertOne(payableData);
    console.log('✅ [Auto Payable] Payable created with ID:', result.insertedId);

    // Update approval workflow with payable ID if it exists
    if (approvalWorkflow && approvalWorkflow._id) {
      try {
        const { ApprovalService } = await import('@/lib/services/approvalService');
        await ApprovalService.updateWorkflowBillId(approvalWorkflow._id, result.insertedId);
        console.log('✅ [Auto Payable] Approval workflow updated with payable ID');
      } catch (workflowError) {
        console.error('⚠️ [Auto Payable] Failed to update workflow with payable ID:', workflowError);
      }
    }

    // Send approval notifications if payable requires approval
    if (approvalStatus === 'pending_approval' && approvalWorkflow) {
      try {
        await sendPayableApprovalNotifications(approvalWorkflow, payableData, recipientUser);
        console.log('✅ [Auto Payable] Approval notifications sent');
      } catch (notificationError) {
        console.error('⚠️ [Auto Payable] Failed to send approval notifications:', notificationError);
      }
    }

    // Also sync to financial ledger
    try {
      const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
      console.log('✅ [Auto Payable] Payable synced to ledger');
    } catch (syncError) {
      console.error('⚠️ [Auto Payable] Failed to sync payable to ledger:', syncError);
      // Don't fail if sync fails
    }

  } catch (error) {
    console.error('❌ [Auto Payable] Error creating payable:', error);
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Store pending payable for unregistered users
 * This will be processed when they sign up
 */
async function storePendingPayable(recipientEmail: string, invoice: Record<string, unknown>) {
  try {
    const db = await connectToDatabase();
    const pendingPayablesCollection = db.collection('pending_payables');

    // Check if already stored
    const existing = await pendingPayablesCollection.findOne({
      recipientEmail,
      invoiceId: new ObjectId(invoice._id as unknown as string)
    });

    if (existing) {
      console.log('✅ [Pending Payable] Already stored for this email and invoice');
      return;
    }

    // Store pending payable
    const pendingPayable = {
      recipientEmail,
      invoiceId: new ObjectId(invoice._id as unknown as string),
      invoiceData: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        companyDetails: invoice.companyDetails,
        clientDetails: invoice.clientDetails,
        items: invoice.items,
        subtotal: invoice.subtotal,
        totalTax: invoice.totalTax,
        paymentMethod: invoice.paymentMethod,
        paymentNetwork: invoice.paymentNetwork,
        paymentAddress: invoice.paymentAddress
      },
      createdAt: new Date(),
      processed: false
    };

    await pendingPayablesCollection.insertOne(pendingPayable);
    console.log('✅ [Pending Payable] Stored for future signup:', recipientEmail);

  } catch (error) {
    console.error('❌ [Pending Payable] Error storing pending payable:', error);
    throw error;
  }
}

/**
 * Send approval notifications for payables created from invoices
 */
async function sendPayableApprovalNotifications(
  workflow: Record<string, unknown>,
  payableData: Record<string, unknown>,
  recipientUser: Record<string, unknown>
) {
  try {
    console.log('📧 [Payable Approval] Sending notifications for payable:', payableData.payableNumber);
    
    const { NotificationService } = await import('@/lib/services/notificationService');
    const db = await connectToDatabase();
    
    // Get organization details
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(recipientUser.organizationId)
    });
    
    if (!organization) {
      console.error('❌ [Payable Approval] Organization not found');
      return;
    }
    
    // Get ALL approvers in the organization (not just current step)
    const organizationMembers = organization.members || [];
    const approvers = organizationMembers.filter((member: any) => 
      member.role === 'admin' || member.role === 'approver' || member.role === 'owner'
    );
    
    console.log('📧 [Payable Approval] Found approvers in organization:', {
      totalMembers: organizationMembers.length,
      approvers: approvers.length,
      approverRoles: approvers.map((a: any) => a.role)
    });
    
    if (approvers.length === 0) {
      console.error('❌ [Payable Approval] No approvers found in organization');
      return;
    }
    
    // Send notification to ALL approvers (except the recipient email)
    const notificationPromises = approvers.map(async (approver: any) => {
      try {
        // Get approver user details
        const approverUser = await db.collection('users').findOne({
          _id: new ObjectId(approver.userId)
        });
        
        if (!approverUser) {
          console.error('❌ [Payable Approval] Approver user not found:', approver.userId);
          return;
        }
        
        // Skip if this approver is the recipient (they already received the invoice email)
        if (approverUser.email === recipientUser.email) {
          console.log('⏭️ [Payable Approval] Skipping notification to recipient:', approverUser.email);
          return;
        }
        
        // Send approval request notification
        await NotificationService.sendApprovalRequest(
          approverUser.email,
          approverUser.name || approverUser.email,
          {
            vendor: payableData.vendorName || payableData.companyName,
            amount: payableData.total,
            currency: payableData.currency,
            description: `Invoice payment: ${payableData.payableName}`,
            dueDate: payableData.dueDate
          },
          workflow,
          organization.name
        );
        
        console.log('✅ [Payable Approval] Notification sent to:', approverUser.email, `(${approver.role})`);
        return approverUser.email;
      } catch (error) {
        console.error('❌ [Payable Approval] Failed to send notification to approver:', approver.userId, error);
        return null;
      }
    });
    
    // Wait for all notifications to be sent
    const results = await Promise.all(notificationPromises);
    const successfulNotifications = results.filter(Boolean);
    
    console.log('✅ [Payable Approval] Notifications sent to approvers:', successfulNotifications);
    
  } catch (error) {
    console.error('❌ [Payable Approval] Error sending notifications:', error);
    throw error;
  }
} 