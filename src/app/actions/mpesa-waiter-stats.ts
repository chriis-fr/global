'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export interface WaiterMpesaStats {
  totalAmount: number;
  successCount: number;
  failedCount: number;
}

export interface WaiterPromptSummary {
  id: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  phoneNumber: string;
  tableRef?: string;
  createdAt: string;
  resultCode?: string;
  resultDescription?: string;
  mpesaReceiptNumber?: string;
}

export async function getWaiterMpesaStats(): Promise<{
  success: boolean;
  data?: WaiterMpesaStats;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;
    const organizationId = session?.user?.organizationId as string | undefined;

    if (!userId || !organizationId) {
      return { success: false, error: 'User is not part of an organization.' };
    }

    const db = await connectToDatabase();
    const sessions = db.collection('mpesa_stk_sessions');

    const agg = await sessions
      .aggregate<{
        _id: null;
        totalAmount: number;
        successCount: number;
        failedCount: number;
      }>([
        {
          $match: {
            organizationId: new ObjectId(organizationId),
            waiterUserId: new ObjectId(userId),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0],
              },
            },
            successCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'success'] }, 1, 0],
              },
            },
            failedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    const totals = agg[0] ?? {
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
    };

    return {
      success: true,
      data: {
        totalAmount: totals.totalAmount ?? 0,
        successCount: totals.successCount ?? 0,
        failedCount: totals.failedCount ?? 0,
      },
    };
  } catch (error) {
    console.error('[getWaiterMpesaStats] Error:', error);
    return {
      success: false,
      error: 'Failed to load M-Pesa stats for waiter',
    };
  }
}

export async function getWaiterRecentPrompts(limit = 10): Promise<{
  success: boolean;
  data?: WaiterPromptSummary[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;
    const organizationId = session?.user?.organizationId as string | undefined;

    if (!userId || !organizationId) {
      return { success: false, error: 'User is not part of an organization.' };
    }

    const db = await connectToDatabase();
    const sessions = db.collection('mpesa_stk_sessions');

    const docs = await sessions
      .find({
        organizationId: new ObjectId(organizationId),
        waiterUserId: new ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .project({
        _id: 1,
        amount: 1,
        status: 1,
        phoneNumber: 1,
        tableRef: 1,
        createdAt: 1,
        resultCode: 1,
        resultDescription: 1,
        mpesaReceiptNumber: 1,
      })
      .toArray();

    const data: WaiterPromptSummary[] = docs.map((d) => ({
      id: d._id.toString(),
      amount: d.amount ?? 0,
      status: d.status ?? 'pending',
      phoneNumber: d.phoneNumber ?? '',
      tableRef: d.tableRef,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
      resultCode: d.resultCode,
      resultDescription: d.resultDescription,
      mpesaReceiptNumber: d.mpesaReceiptNumber,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('[getWaiterRecentPrompts] Error:', error);
    return {
      success: false,
      error: 'Failed to load recent M-Pesa prompts',
    };
  }
}


