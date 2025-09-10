import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    let query: any = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    const payable = await collection.findOne(query);

    if (!payable) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: payable
    });
  } catch (error) {
    console.error('Error fetching payable:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch payable' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      payableNumber,
      issueDate,
      dueDate,
      companyLogo,
      companyName,
      companyAddress,
      companyTaxNumber,
      vendorName,
      vendorCompany,
      vendorEmail,
      vendorAddress,
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      payableType,
      items,
      subtotal,
      totalTax,
      total,
      memo,
      status,
      category,
      priority,
      companyEmail,
      companyPhone,
      vendorPhone
    } = body;

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    let query: any = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    // Check if payable exists and user has access
    const existingPayable = await collection.findOne(query);
    if (!existingPayable) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData = {
      payableNumber,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      companyLogo,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress: {
        street: companyAddress?.street || '',
        city: companyAddress?.city || '',
        state: companyAddress?.state || '',
        zipCode: companyAddress?.zipCode || '',
        country: companyAddress?.country || ''
      },
      companyTaxNumber,
      vendorName,
      vendorCompany,
      vendorEmail,
      vendorPhone,
      vendorAddress: {
        street: vendorAddress?.street || '',
        city: vendorAddress?.city || '',
        state: vendorAddress?.state || '',
        zipCode: vendorAddress?.zipCode || '',
        country: vendorAddress?.country || ''
      },
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      payableType: payableType || 'regular',
      category: category || 'General',
      priority: priority || 'medium',
      items: items.map((item: { id?: string; description: string; quantity: number; unitPrice: number; amount: number; tax: number; discount?: number }) => ({
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        amount: item.amount
      })),
      subtotal,
      totalTax,
      total,
      memo,
      status,
      updatedAt: new Date()
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payable updated successfully',
      data: { _id: id, ...updateData }
    });
  } catch (error) {
    console.error('Error updating payable:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update payable' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    let query: any = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payable deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payable:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete payable' },
      { status: 500 }
    );
  }
}
