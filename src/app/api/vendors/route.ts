import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('vendors');

    let query = {};
    
    // For business users, filter by organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { organizationId: session.user.organizationId };
    } else {
      // For individual users, filter by userId (email)
      query = { userId: session.user.email };
    }

    const vendors = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: vendors
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch vendors' },
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

    const db = await connectToDatabase();
    const collection = db.collection('vendors');

    let query = {};
    const vendorData: Record<string, unknown> = {
      name: name ?? '',
      email: email ?? '',
      phone,
      address,
      company,
      taxId,
      notes,
      userId: session.user.email,
      // One vendor = one reusable submission link
      paymentLinkToken: crypto.randomBytes(24).toString('hex'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // For business users, use organizationId
    if (session.user.userType === 'business' && session.user.organizationId) {
      query = { email, organizationId: session.user.organizationId };
      vendorData.organizationId = session.user.organizationId;
    } else {
      // For individual users, use userId
      query = { email, userId: session.user.email };
    }

    // Check if vendor with same email already exists for this user/organization
    const existingVendor = await collection.findOne(query);

    if (existingVendor) {
      return NextResponse.json(
        { success: false, message: 'Vendor with this email already exists' },
        { status: 400 }
      );
    }

    const result = await collection.insertOne(vendorData);

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId, ...vendorData }
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
