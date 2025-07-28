import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { Invoice, generateInvoiceNumber } from '@/models/Invoice';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'draft', 'sent', 'all'
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, message: 'No organization found' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Build query
    const query: any = { organizationId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get invoices with pagination
    const skip = (page - 1) * limit;
    const invoices = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await collection.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoiceName,
      issueDate,
      dueDate,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      clientName,
      clientEmail,
      clientPhone,
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
      status = 'draft'
    } = body;

    // Validate required fields
    if (!invoiceName || !issueDate || !dueDate || !companyName || !clientName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, message: 'No organization found' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const invoiceCollection = db.collection('invoices');
    const lastInvoice = await invoiceCollection
      .findOne({ organizationId }, { sort: { createdAt: -1 } });
    
    const invoiceNumber = generateInvoiceNumber(
      organizationId.toString(), 
      lastInvoice?.invoiceNumber
    );

    const invoiceData = {
      invoiceNumber,
      organizationId,
      userId: session.user.email,
      invoiceName,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      clientName,
      clientEmail,
      clientPhone,
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
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await invoiceCollection.insertOne(invoiceData);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId,
        ...invoiceData
      }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create invoice' },
      { status: 500 }
    );
  }
} 