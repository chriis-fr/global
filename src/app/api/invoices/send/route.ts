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

    // Get the invoice
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query = isOrganization 
      ? { _id: new ObjectId(invoiceId), organizationId: session.user.organizationId }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      console.log('❌ [Send Invoice] Invoice not found:', {
        invoiceId,
        ownerType: isOrganization ? 'organization' : 'individual',
        ownerId: isOrganization ? session.user.organizationId : session.user.email,
        userEmail: session.user.email
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
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
        invoiceId: new ObjectId(invoice._id),
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
          invoice.totalAmount,
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
async function createPayableForRecipient(recipientEmail: string, invoice: any) {
  try {
    console.log('💳 [Auto Payable] Checking if recipient is registered:', recipientEmail);

    // Check if recipient has an account
    const recipientUser = await UserService.getUserByEmail(recipientEmail);
    
    if (!recipientUser) {
      console.log('📧 [Auto Payable] Recipient not registered, storing for future signup:', recipientEmail);
      
      // Store pending payable for when they sign up
      await storePendingPayable(recipientEmail, invoice);
      return;
    }

    console.log('✅ [Auto Payable] Recipient is registered, creating payable immediately');

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Check if payable already exists for this invoice and recipient
    // Handle both MongoDB ObjectIds and OAuth IDs
    const isRecipientObjectId = /^[0-9a-fA-F]{24}$/.test(recipientUser._id);
    const recipientIssuerId = isRecipientObjectId ? new ObjectId(recipientUser._id) : recipientUser._id;
    
    const existingPayable = await payablesCollection.findOne({
      relatedInvoiceId: new ObjectId(invoice._id),
      issuerId: recipientIssuerId
    });

    if (existingPayable) {
      console.log('✅ [Auto Payable] Payable already exists for this invoice');
      return;
    }

    // Generate payable number
    const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create comprehensive payable data with full tracking
    const payableData = {
      // Basic payable info
      payableNumber,
      payableName: `Invoice Payment - ${invoice.invoiceNumber}`,
      payableType: 'invoice_payment',
      
      // Dates and timing
      issueDate: new Date(),
      dueDate: new Date(invoice.dueDate),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentDate: null, // Will be set when payment is made
      
      // Company information (sender)
      companyName: invoice.companyDetails?.name || invoice.companyName,
      companyEmail: invoice.companyDetails?.email || invoice.companyEmail,
      companyPhone: invoice.companyDetails?.phone || invoice.companyPhone,
      companyAddress: invoice.companyDetails?.address || invoice.companyAddress,
      companyTaxNumber: invoice.companyDetails?.taxNumber || '',
      
      // Vendor information (recipient)
      vendorName: invoice.clientDetails?.name || invoice.clientName,
      vendorEmail: invoice.clientDetails?.email || invoice.clientEmail,
      vendorPhone: invoice.clientDetails?.phone || invoice.clientPhone,
      vendorAddress: invoice.clientDetails?.address || invoice.clientAddress,
      
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
      total: invoice.totalAmount || 0,
      memo: `Auto-generated payable from invoice ${invoice.invoiceNumber}`,
      
      // Status and workflow
      status: 'pending', // pending, approved, paid, overdue, cancelled
      priority: 'medium', // low, medium, high, urgent
      category: 'Invoice Payment',
      
      // Approval workflow
      approvalStatus: 'pending', // pending, approved, rejected
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
      relatedInvoiceId: new ObjectId(invoice._id),
      
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
async function storePendingPayable(recipientEmail: string, invoice: any) {
  try {
    const db = await connectToDatabase();
    const pendingPayablesCollection = db.collection('pending_payables');

    // Check if already stored
    const existing = await pendingPayablesCollection.findOne({
      recipientEmail,
      invoiceId: new ObjectId(invoice._id)
    });

    if (existing) {
      console.log('✅ [Pending Payable] Already stored for this email and invoice');
      return;
    }

    // Store pending payable
    const pendingPayable = {
      recipientEmail,
      invoiceId: new ObjectId(invoice._id),
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