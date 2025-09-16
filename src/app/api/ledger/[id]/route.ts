import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ledger entry ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('financial_ledger');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    const entry = await collection.findOne(query);

    if (!entry) {
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error fetching ledger entry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch ledger entry' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ledger entry ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      counterparty,
      amount,
      currency,
      subtotal,
      totalTax,
      items,
      paymentDetails,
      issueDate,
      dueDate,
      status,
      priority,
      category,
      notes,
      memo,
      paidDate,
      transactionHash,
      blockchainNetwork,
      walletAddress
    } = body;

    const db = await connectToDatabase();
    const collection = db.collection('financial_ledger');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    // Check if entry exists and user has access
    const existingEntry = await collection.findOne(query);
    if (!existingEntry) {
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (counterparty) updateData.counterparty = counterparty;
    if (amount !== undefined) updateData.amount = amount;
    if (currency) updateData.currency = currency;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (totalTax !== undefined) updateData.totalTax = totalTax;
    if (items) updateData.items = items;
    if (paymentDetails) updateData.paymentDetails = paymentDetails;
    if (issueDate) updateData.issueDate = new Date(issueDate);
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (category) updateData.category = category;
    if (notes !== undefined) updateData.notes = notes;
    if (memo !== undefined) updateData.memo = memo;
    if (paidDate) updateData.paidDate = new Date(paidDate);
    if (transactionHash) updateData.transactionHash = transactionHash;
    if (blockchainNetwork) updateData.blockchainNetwork = blockchainNetwork;
    if (walletAddress) updateData.walletAddress = walletAddress;

    // Handle status changes
    if (status === 'paid' && !existingEntry.paidDate) {
      updateData.paidDate = new Date();
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Ledger entry updated successfully',
      data: { _id: id, ...updateData }
    });
  } catch (error) {
    console.error('Error updating ledger entry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update ledger entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ledger entry ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('financial_ledger');

    // Build query based on user type
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
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
      return NextResponse.json({ success: false, message: 'Ledger entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Ledger entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete ledger entry' },
      { status: 500 }
    );
  }
}
