import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    
    // Get user
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not in organization' },
        { status: 404 }
      );
    }

    // Get organization
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId)
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    // Find owner
    const owner = organization.members.find((member: { role: string }) => member.role === 'owner');
    if (!owner) {
      return NextResponse.json(
        { success: false, message: 'Owner not found' },
        { status: 404 }
      );
    }

    // Get owner's subscription
    const ownerUser = await db.collection('users').findOne({
      _id: new ObjectId(owner.userId)
    });

    if (!ownerUser || !ownerUser.subscription) {
      return NextResponse.json(
        { success: false, message: 'Owner has no subscription' },
        { status: 404 }
      );
    }

    // Update organization subscription cache
    await db.collection('organizations').updateOne(
      { _id: new ObjectId(user.organizationId) },
      { 
        $set: { 
          subscription: ownerUser.subscription,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ [Refresh Subscription] Organization subscription cache updated:', {
      organizationId: user.organizationId,
      planId: ownerUser.subscription.planId
    });

    return NextResponse.json({
      success: true,
      message: 'Organization subscription cache refreshed',
      subscription: ownerUser.subscription
    });

  } catch (error) {
    console.error('Error refreshing organization subscription:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to refresh subscription' },
      { status: 500 }
    );
  }
}
