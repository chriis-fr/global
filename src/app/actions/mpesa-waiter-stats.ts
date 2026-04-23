'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { ReconTransaction } from '@/models/ReconTransaction';
import { reconTillAttributedNoStkLink } from '@/lib/mpesa/reconTillMatch';

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

    const reconCol = db.collection<ReconTransaction>('recon_transactions');
    const reconAgg = await reconCol
      .aggregate<{ totalAmount: number; count: number }>([
        {
          $match: {
            ...reconTillAttributedNoStkLink(new ObjectId(organizationId)),
            waiterUserId: new ObjectId(userId),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const r = reconAgg[0] ?? { totalAmount: 0, count: 0 };

    return {
      success: true,
      data: {
        totalAmount: (totals.totalAmount ?? 0) + (r.totalAmount ?? 0),
        successCount: (totals.successCount ?? 0) + (r.count ?? 0),
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

export type MpesaTotalPeriod = 'today' | '1w' | '1m' | '3m';

function getPeriodRange(period: MpesaTotalPeriod): { start: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      return { start };
    case '1w': {
      const d = new Date(start);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      d.setUTCDate(diff);
      return { start: d };
    }
    case '1m': {
      const d = new Date(start);
      d.setUTCDate(1);
      return { start: d };
    }
    case '3m': {
      const d = new Date(start);
      d.setUTCMonth(d.getUTCMonth() - 3);
      d.setUTCDate(1);
      return { start: d };
    }
    default:
      return { start };
  }
}

export async function getMpesaTotalByPeriod(period: MpesaTotalPeriod): Promise<{
  success: boolean;
  data?: { totalAmount: number };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId as string | undefined;

    if (!organizationId) {
      return { success: false, error: 'User is not part of an organization.' };
    }

    const { start } = getPeriodRange(period);
    const db = await connectToDatabase();
    const sessions = db.collection('mpesa_stk_sessions');
    const reconCol = db.collection<ReconTransaction>('recon_transactions');
    const orgOid = new ObjectId(organizationId);

    const agg = await sessions
      .aggregate<{ totalAmount: number }>([
        {
          $match: {
            organizationId: orgOid,
            status: 'success',
            createdAt: { $gte: start },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const stkAmount = agg[0]?.totalAmount ?? 0;

    const reconAgg = await reconCol
      .aggregate<{ totalAmount: number }>([
        { $match: reconTillAttributedNoStkLink(orgOid) },
        {
          $addFields: {
            at: { $ifNull: ['$mpesaTimestamp', '$createdAt'] },
          },
        },
        { $match: { at: { $gte: start } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
          },
        },
      ])
      .toArray();

    const totalAmount = stkAmount + (reconAgg[0]?.totalAmount ?? 0);

    return { success: true, data: { totalAmount } };
  } catch (error) {
    console.error('[getMpesaTotalByPeriod] Error:', error);
    return { success: false, error: 'Failed to load total by period' };
  }
}

/** STK + claimed till totals for the signed-in waiter (M-Pesa service page overview). */
export async function getWaiterMpesaPaymentOverview(): Promise<{
  success: boolean;
  data?: {
    stkSuccessTotal: number;
    stkSessionCount: number;
    tillClaimedTotal: number;
    tillClaimCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.organizationId) {
      return { success: false, error: 'Not in an organization.' };
    }
    const organizationId = session.user.organizationId;
    const userId = session.user.id;
    const db = await connectToDatabase();
    const orgOid = new ObjectId(organizationId);
    const waiterOid = new ObjectId(userId);
    const sessions = db.collection('mpesa_stk_sessions');
    const reconCol = db.collection<ReconTransaction>('recon_transactions');

    const stkAgg = await sessions
      .aggregate<{ successTotal: number; count: number }>([
        { $match: { organizationId: orgOid, waiterUserId: waiterOid } },
        {
          $group: {
            _id: null,
            successTotal: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const s = stkAgg[0] ?? { successTotal: 0, count: 0 };

    const reconAgg = await reconCol
      .aggregate<{ totalAmount: number; count: number }>([
        {
          $match: {
            ...reconTillAttributedNoStkLink(orgOid),
            waiterUserId: waiterOid,
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const r = reconAgg[0] ?? { totalAmount: 0, count: 0 };

    return {
      success: true,
      data: {
        stkSuccessTotal: Number(s.successTotal ?? 0),
        stkSessionCount: Number(s.count ?? 0),
        tillClaimedTotal: Number(r.totalAmount ?? 0),
        tillClaimCount: Number(r.count ?? 0),
      },
    };
  } catch (error) {
    console.error('[getWaiterMpesaPaymentOverview] Error:', error);
    return { success: false, error: 'Failed to load payment overview' };
  }
}
