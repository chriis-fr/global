import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, invoiceToken } = body;

    console.log('🔗 [Invoice Signup] Processing signup for user:', userId, 'with token:', invoiceToken);

    if (!userId || !invoiceToken) {
      return NextResponse.json(
        { success: false, message: 'User ID and invoice token are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Find invoice by invoice number (token)
    const invoice = await invoicesCollection.findOne({
      invoiceNumber: invoiceToken
    });

    if (!invoice) {
      console.log('❌ [Invoice Signup] Invoice not found:', invoiceToken);
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if this user's email matches the invoice recipient email
    const userCollection = db.collection('users');
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const recipientEmail = invoice.clientDetails?.email || invoice.clientEmail;
    if (user.email !== recipientEmail) {
      console.log('❌ [Invoice Signup] Email mismatch:', user.email, 'vs', recipientEmail);
      return NextResponse.json(
        { success: false, message: 'Email does not match invoice recipient' },
        { status: 400 }
      );
    }

    // Create payable record for the invoice
    await createPayableFromInvoice(userId, invoice);

    console.log('✅ [Invoice Signup] Successfully processed signup for invoice:', invoiceToken);

    return NextResponse.json({
      success: true,
      message: 'Invoice payable created successfully',
      data: {
        invoiceNumber: invoice.invoiceNumber,
        payableCreated: true
      }
    });

  } catch (error) {
    console.error('❌ [Invoice Signup] Error processing signup:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process invoice signup',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createPayableFromInvoice(userId: string, invoice: any) {
  try {
    console.log('💳 [Invoice Signup] Creating payable from invoice for user:', userId);

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Check if payable already exists for this invoice and user
    const existingPayable = await payablesCollection.findOne({
      relatedInvoiceId: new ObjectId(invoice._id),
      issuerId: new ObjectId(userId)
    });

    if (existingPayable) {
      console.log('✅ [Invoice Signup] Payable already exists for this invoice');
      return;
    }

    // Generate payable number
    const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create payable data
    const payableData = {
      payableNumber,
      payableName: `Invoice Payment - ${invoice.invoiceNumber}`,
      issueDate: new Date(),
      dueDate: new Date(invoice.dueDate),
      companyName: invoice.companyDetails?.name || invoice.companyName,
      companyEmail: invoice.companyDetails?.email || invoice.companyEmail,
      companyPhone: invoice.companyDetails?.phone || invoice.companyPhone,
      companyAddress: invoice.companyDetails?.address || invoice.companyAddress,
      companyTaxNumber: '',
      vendorName: invoice.clientDetails?.name || invoice.clientName,
      vendorEmail: invoice.clientDetails?.email || invoice.clientEmail,
      vendorPhone: invoice.clientDetails?.phone || invoice.clientPhone,
      vendorAddress: invoice.clientDetails?.address || invoice.clientAddress,
      currency: invoice.currency,
      paymentMethod: invoice.paymentMethod,
      paymentNetwork: invoice.paymentNetwork,
      paymentAddress: invoice.paymentAddress,
      enableMultiCurrency: false,
      payableType: 'regular',
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      totalTax: invoice.totalTax || 0,
      total: invoice.totalAmount || 0,
      memo: `Auto-generated payable from invoice ${invoice.invoiceNumber}`,
      status: 'pending',
      priority: 'medium',
      category: 'Invoice Payment',
      attachedFiles: [],
      issuerId: new ObjectId(userId),
      organizationId: null, // Individual user
      relatedInvoiceId: new ObjectId(invoice._id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await payablesCollection.insertOne(payableData);
    console.log('✅ [Invoice Signup] Payable created with ID:', result.insertedId);

    // Also sync to financial ledger
    try {
      const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
      console.log('✅ [Invoice Signup] Payable synced to ledger');
    } catch (syncError) {
      console.error('⚠️ [Invoice Signup] Failed to sync payable to ledger:', syncError);
      // Don't fail the request if sync fails
    }

  } catch (error) {
    console.error('❌ [Invoice Signup] Error creating payable:', error);
    // Don't fail the signup if payable creation fails
  }
}
