import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

// Client interface removed as it's not used

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('clients');

    let query = {};
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId (email)
      query = { userId: session.user.email };
    }

    const clients = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch clients' },
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

    let query = {};
    const clientData: Record<string, unknown> = {
      name,
      email,
      phone,
      address,
      company,
      taxId,
      notes,
      userId: session.user.email,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // For business users, use organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { email, organizationId: session.user.organizationId };
      clientData.organizationId = session.user.organizationId;
    } else {
      // For individual users, use userId
      query = { email, userId: session.user.email };
    }

    // Check if client with same email already exists for this user/organization
    const existingClient = await collection.findOne(query);

    if (existingClient) {
      return NextResponse.json(
        { success: false, message: 'Client with this email already exists' },
        { status: 400 }
      );
    }

    const result = await collection.insertOne(clientData);

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId, ...clientData }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create client' },
      { status: 500 }
    );
  }
} 