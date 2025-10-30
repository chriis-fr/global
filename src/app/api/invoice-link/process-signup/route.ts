import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, invoiceToken } = body;


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
      return NextResponse.json(
        { success: false, message: 'Email does not match invoice recipient' },
        { status: 400 }
      );
    }

    // Create payable record for the invoice
    await createPayableFromInvoice(userId, invoice);


    return NextResponse.json({
      success: true,
      message: 'Invoice payable created successfully',
      data: {
        invoiceNumber: invoice.invoiceNumber,
        payableCreated: true
      }
    });

  } catch (error) {
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

async function createPayableFromInvoice(userId: string, invoice: Record<string, unknown>) {
  try {

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Check if payable already exists for this invoice and user
    const existingPayable = await payablesCollection.findOne({
      relatedInvoiceId: new ObjectId(invoice._id as string),
      issuerId: new ObjectId(userId)
    });

    if (existingPayable) {
      return;
    }

    // Generate payable number
    const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create payable data
    const payableData = {
      payableNumber,
      payableName: `Invoice Payment - ${invoice.invoiceNumber}`,
      issueDate: new Date(),
      dueDate: new Date(invoice.dueDate as string),
      companyName: (invoice.companyDetails as Record<string, unknown>)?.name || invoice.companyName,
      companyEmail: (invoice.companyDetails as Record<string, unknown>)?.email || invoice.companyEmail,
      companyPhone: (invoice.companyDetails as Record<string, unknown>)?.phone || invoice.companyPhone,
      companyAddress: (invoice.companyDetails as Record<string, unknown>)?.address || invoice.companyAddress,
      companyTaxNumber: '',
      vendorName: (invoice.clientDetails as Record<string, unknown>)?.name || invoice.clientName,
      vendorEmail: (invoice.clientDetails as Record<string, unknown>)?.email || invoice.clientEmail,
      vendorPhone: (invoice.clientDetails as Record<string, unknown>)?.phone || invoice.clientPhone,
      vendorAddress: (invoice.clientDetails as Record<string, unknown>)?.address || invoice.clientAddress,
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
      relatedInvoiceId: new ObjectId(invoice._id as string),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await payablesCollection.insertOne(payableData);

    // Also sync to financial ledger
    try {
      const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
    } catch {
      // Don't fail the request if sync fails
    }

  } catch {
    // Don't fail the signup if payable creation fails
  }
}
