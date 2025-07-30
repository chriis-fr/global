import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
      updatedAt
    } = body;

    await connectToDatabase();

    // Transform data to match Invoice model structure
    const invoiceData = {
      invoiceNumber: invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: session.user.organizationId || new ObjectId(),
      issuerId: session.user.id || new ObjectId(),
      type: invoiceType || 'regular',
      status: status || 'sent',
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
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
        companyName: clientName,
        firstName: '',
        lastName: '',
        country: clientAddress?.country || '',
        region: clientAddress?.state || '',
        city: clientAddress?.city || '',
        postalCode: clientAddress?.zipCode || '',
        addressLine1: clientAddress?.street || '',
        addressLine2: '',
        taxNumber: ''
      },
      currency,
      items: items.map((item: { description: string; quantity: number; unitPrice: number; amount: number; tax: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.amount,
        taxRate: item.tax / 100
      })),
      taxes: [{
        name: 'Tax',
        rate: totalTax / subtotal,
        amount: totalTax
      }],
      subtotal,
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
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      isTemplate: false
    };

    // Use MongoDB directly since the model structure is complex
    const db = await connectToDatabase();
    const result = await db.collection('invoices').insertOne(invoiceData);

    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      invoice: { _id: result.insertedId, ...invoiceData }
    });

  } catch (error) {
    console.error('Error saving invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save invoice' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();

    const invoices = await db.collection('invoices')
      .find({ userId: session.user.email })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      invoices: invoices
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
} 