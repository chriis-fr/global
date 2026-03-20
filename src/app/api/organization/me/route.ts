import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId || !ObjectId.isValid(organizationId)) {
      return NextResponse.json({ success: false, error: 'No organization' }, { status: 404 });
    }

    const db = await connectToDatabase();
    const org = await db.collection('organizations').findOne(
      { _id: new ObjectId(organizationId) },
      { projection: { name: 1, billingEmail: 1, phone: 1, address: 1, taxId: 1 } }
    );

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        name: org.name ?? '',
        billingEmail: org.billingEmail ?? '',
        phone: org.phone ?? '',
        address: org.address ?? null,
        taxId: org.taxId ?? '',
      },
    });
  } catch (error) {
    console.error('[Organization ME] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load organization' }, { status: 500 });
  }
}

