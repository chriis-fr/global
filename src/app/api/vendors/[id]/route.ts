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
      return NextResponse.json({ success: false, message: 'Invalid vendor ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('vendors');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { _id: new ObjectId(id), organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { _id: new ObjectId(id), userId: session.user.email };
    }

    const vendor = await collection.findOne(query);

    if (!vendor) {
      return NextResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: vendor
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch vendor' },
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
      return NextResponse.json({ success: false, message: 'Invalid vendor ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      company,
      taxId,
      notes
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: 'Name and email are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection('vendors');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { _id: new ObjectId(id), organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { _id: new ObjectId(id), userId: session.user.email };
    }

    // Check if vendor exists and user has access
    const existingVendor = await collection.findOne(query);
    if (!existingVendor) {
      return NextResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    }

    // Check if another vendor with the same email exists (excluding current vendor)
    let emailQuery: Record<string, unknown> = { email, _id: { $ne: new ObjectId(id) } };
    if (session.user.userType === 'business' && session.user.organizationId) {
      emailQuery = { email, organizationId: session.user.organizationId, _id: { $ne: new ObjectId(id) } };
    } else {
      emailQuery = { email, userId: session.user.email, _id: { $ne: new ObjectId(id) } };    
    }

    const duplicateVendor = await collection.findOne(emailQuery);
    if (duplicateVendor) {
      return NextResponse.json(
        { success: false, message: 'Another vendor with this email already exists' },
        { status: 400 }
      );
    }

    const updateData = {
      name,
      email,
      phone,
      address,
      company,
      taxId,
      notes,
      updatedAt: new Date()
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor updated successfully',
      data: { _id: id, ...updateData }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to update vendor' },
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
      return NextResponse.json({ success: false, message: 'Invalid vendor ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('vendors');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { _id: new ObjectId(id), organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { _id: new ObjectId(id), userId: session.user.email };
    }

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to delete vendor' },
      { status: 500 }
    );
  }
}
