import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('clients');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { ...query, organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { ...query, userId: session.user.email };
    }

    const client = await collection.findOne(query);

    if (!client) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: client
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
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
    const collection = db.collection('clients');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    let emailConflictQuery: Record<string, unknown> = { email, _id: { $ne: new ObjectId(id) } };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { ...query, organizationId: session.user.organizationId };
      emailConflictQuery = { ...emailConflictQuery, organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { ...query, userId: session.user.email };
      emailConflictQuery = { ...emailConflictQuery, userId: session.user.email };
    }

    // Check if client exists and belongs to user/organization
    const existingClient = await collection.findOne(query);

    if (!existingClient) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    // Check if email is already used by another client for the same user/organization
    const emailConflict = await collection.findOne(emailConflictQuery);

    if (emailConflict) {
      return NextResponse.json(
        { success: false, message: 'Client with this email already exists' },
        { status: 400 }
      );
    }

    // Update client
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
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Client updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to update client' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('clients');

    let query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { ...query, organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId
      query = { ...query, userId: session.user.email };
    }

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to delete client' },
      { status: 500 }
    );
  }
} 