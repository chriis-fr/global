import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Check if user is an organization owner
    if (!user.organizationId) {
      return NextResponse.json({ success: false, message: 'User is not an organization owner' }, { status: 400 });
    }

    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
    }

    const ownerMember = organization.members.find((member: { userId: string; role: string }) => 
      member.userId.toString() === user._id?.toString() && member.role === 'owner'
    );

    if (!ownerMember) {
      return NextResponse.json({ success: false, message: 'User is not the organization owner' }, { status: 403 });
    }

    const invoicesToFix = await db.collection('invoices').find({
      issuerId: user._id,
      organizationId: null,
      ownerType: 'individual'
    }).toArray();

    let fixedCount = 0;

    for (const invoice of invoicesToFix) {
      const result = await db.collection('invoices').updateOne(
        { _id: invoice._id }, 
        {
          $set: {
            organizationId: user.organizationId,
            ownerId: user.organizationId,
            ownerType: 'organization',
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        fixedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalInvoices: invoicesToFix.length,
        fixedCount: fixedCount,
        organizationId: user.organizationId.toString(),
        organizationName: organization.name
      },
      message: `Fixed ${fixedCount} out of ${invoicesToFix.length} invoices`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to fix invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
