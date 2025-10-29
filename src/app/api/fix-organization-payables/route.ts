import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    
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

    // Find payables that belong to organization members but don't have organizationId set
    const organizationMembers = await db.collection('users').find({
      organizationId: user.organizationId
    }).toArray();

    const memberEmails = organizationMembers.map(member => member.email);
    
    // Update payables that belong to organization members
    const updateResult = await db.collection('payables').updateMany(
      {
        userId: { $in: memberEmails },
        $or: [
          { organizationId: { $exists: false } },
          { organizationId: null }
        ]
      },
      {
        $set: {
          organizationId: user.organizationId,
          ownerId: user.organizationId,
          ownerType: 'organization',
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ [Fix Organization Payables] Updated payables:', {
      organizationId: user.organizationId,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
    });

    // Also sync existing payables to ledger
    const payablesToSync = await db.collection('payables').find({
      organizationId: user.organizationId
    }).toArray();

    let syncedCount = 0;
    for (const payable of payablesToSync) {
      try {
        const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
        await LedgerSyncService.syncPayableToLedger(payable);
        syncedCount++;
      } catch (error) {
        console.error('❌ [Fix Organization Payables] Failed to sync payable:', payable._id, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Organization payables fixed',
      data: {
        payablesUpdated: updateResult.modifiedCount,
        payablesSynced: syncedCount,
        organizationId: user.organizationId
      }
    });

  } catch (error) {
    console.error('Error fixing organization payables:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fix organization payables' },
      { status: 500 }
    );
  }
}
