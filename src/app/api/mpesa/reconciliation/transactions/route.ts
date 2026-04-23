import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import type { MatchStatus, ReconTransaction } from '@/models/ReconTransaction';
import { queryPullTransactionsAndIngest } from '@/lib/services/darajaPullTransactionsService';

type PeriodKey = '30m' | '1h' | '90m' | '2h' | '6h' | '12h' | '24h' | '48h' | 'today' | 'week' | 'month' | 'all';
type ReconFilters = {
  q: string;
  code: string;
  phone: string;
  minAmount?: number;
  maxAmount?: number;
};

type SessionUserShape = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  organizationId?: string | null;
  organizationRole?: string | null;
  adminTag?: boolean;
};

function getRangeStart(period: PeriodKey): Date | null {
  const now = new Date();
  if (period === '30m') return new Date(now.getTime() - 30 * 60 * 1000);
  if (period === '1h') return new Date(now.getTime() - 60 * 60 * 1000);
  if (period === '90m') return new Date(now.getTime() - 90 * 60 * 1000);
  if (period === '2h') return new Date(now.getTime() - 2 * 60 * 60 * 1000);
  if (period === '6h') return new Date(now.getTime() - 6 * 60 * 60 * 1000);
  if (period === '12h') return new Date(now.getTime() - 12 * 60 * 60 * 1000);
  if (period === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === '48h') return new Date(now.getTime() - 48 * 60 * 60 * 1000);
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function parsePeriod(value: string | null): PeriodKey {
  if (
    value === '30m' ||
    value === '1h' ||
    value === '90m' ||
    value === '2h' ||
    value === '6h' ||
    value === '12h' ||
    value === '24h' ||
    value === '48h' ||
    value === 'today' ||
    value === 'week' ||
    value === 'month' ||
    value === 'all'
  ) {
    return value;
  }
  return '48h';
}

async function authorize(session: { user?: SessionUserShape } | null) {
  const user = session?.user;
  const role = user?.organizationRole;
  const isSuper = user?.adminTag === true;
  const orgId = user?.organizationId ?? null;
  if (!user?.id || (!orgId && !isSuper)) return null;
  if (!isSuper && role !== 'owner' && role !== 'admin') return null;
  return { user, orgId: orgId as string };
}

async function buildResponse(orgId: string, period: PeriodKey, filters: ReconFilters) {
  const db = await connectToDatabase();
  const reconCol = db.collection<ReconTransaction>('recon_transactions');
  const sessionsCol = db.collection('mpesa_stk_sessions');
  const orgCol = db.collection('organizations');
  const usersCol = db.collection('users');

  const orgObjectId = new ObjectId(orgId);
  const rangeStart = getRangeStart(period);

  const filter: Record<string, unknown> = { organizationId: orgObjectId, provider: 'mpesa' };
  if (rangeStart) {
    filter.$or = [
      { mpesaTimestamp: { $gte: rangeStart } },
      { createdAt: { $gte: rangeStart } },
    ];
  }

  const docs = await reconCol.find(filter).sort({ mpesaTimestamp: -1, createdAt: -1 }).limit(1000).toArray();

  const org = await orgCol.findOne(
    { _id: orgObjectId },
    { projection: { members: 1 } }
  ) as { members?: Array<{ userId?: ObjectId; role?: string }> } | null;

  const waiterMemberIds = (org?.members ?? [])
    .filter((m) => m.role === 'waiter' && m.userId)
    .map((m) => m.userId as ObjectId);
  const memberRoleById = new Map<string, string>();
  (org?.members ?? []).forEach((m) => {
    if (m.userId) memberRoleById.set(m.userId.toString(), m.role ?? 'unknown');
  });

  const promptFilter: Record<string, unknown> = { organizationId: orgObjectId };
  if (rangeStart) promptFilter.createdAt = { $gte: rangeStart };
  const promptDocs = await sessionsCol
    .find(promptFilter)
    .sort({ createdAt: -1 })
    .limit(400)
    .toArray() as Array<{
      _id: ObjectId;
      waiterUserId?: ObjectId;
      phoneNumber?: string;
      amount?: number;
      status?: string;
      mpesaReceiptNumber?: string;
      tableRef?: string;
      createdAt?: Date;
      transactionDate?: Date;
    }>;

  const promptWaiterIds = [...new Set(promptDocs.map((d) => d.waiterUserId?.toString()).filter(Boolean))] as string[];
  const combinedWaiterIds = [...new Set([...waiterMemberIds.map((id) => id.toString()), ...promptWaiterIds])];

  const waiterUsers = combinedWaiterIds.length
    ? await usersCol.find(
        { _id: { $in: combinedWaiterIds.map((id) => new ObjectId(id)) } },
        { projection: { name: 1, email: 1 } }
      ).toArray()
    : [];

  const waiterMap = new Map<string, { name: string; email: string }>();
  waiterUsers.forEach((u) => {
    waiterMap.set(u._id.toString(), {
      name: (u.name as string) || 'Unknown',
      email: (u.email as string) || '',
    });
  });

  const userIdsFromClaims = [...new Set(docs.map((d) => d.claimedByUserId?.toString()).filter(Boolean))] as string[];
  const claimUsers = userIdsFromClaims.length
    ? await usersCol
        .find({ _id: { $in: userIdsFromClaims.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
        .toArray()
    : [];
  const claimUserMap = new Map<string, string>();
  claimUsers.forEach((u) => claimUserMap.set(u._id.toString(), (u.name as string) || (u.email as string) || 'Unknown'));

  const q = filters.q.trim().toLowerCase();
  const codeQ = filters.code.trim().toLowerCase();
  const phoneQ = filters.phone.trim().toLowerCase();
  const matchesQ = (doc: ReconTransaction) => {
    const amount = Number(doc.mpesaAmount ?? doc.expectedAmount ?? 0);
    if (filters.minAmount != null && amount < filters.minAmount) return false;
    if (filters.maxAmount != null && amount > filters.maxAmount) return false;

    const claimedWaiterName = doc.waiterUserId ? (waiterMap.get(doc.waiterUserId.toString())?.name ?? '') : '';
    const fields = [
      doc.mpesaReceiptNumber,
      doc.phoneNumber,
      doc.tableRef,
      doc.externalWaiterName,
      claimedWaiterName,
      doc.claimedByName,
    ]
      .map((v) => (v ?? '').toString().toLowerCase())
      .join(' ');
    if (codeQ && !String(doc.mpesaReceiptNumber ?? '').toLowerCase().includes(codeQ)) return false;
    if (phoneQ && !String(doc.phoneNumber ?? '').toLowerCase().includes(phoneQ)) return false;
    if (q && !fields.includes(q)) return false;
    return true;
  };

  const filtered = docs.filter(matchesQ);

  const transactions = filtered.map((doc) => {
    const waiterId = doc.waiterUserId?.toString();
    const waiter = waiterId ? waiterMap.get(waiterId) : null;
    const claimedTo = waiter
      ? { type: 'waiter' as const, waiterUserId: waiterId!, name: waiter.name }
      : doc.externalWaiterName
        ? { type: 'external' as const, name: doc.externalWaiterName }
        : null;
    const initiatedBy = doc.claimedByUserId
      ? claimUserMap.get(doc.claimedByUserId.toString()) ?? doc.claimedByName ?? 'Unknown'
      : doc.claimedByName ?? null;

    return {
      id: doc._id?.toString() ?? '',
      mpesaReceiptNumber: doc.mpesaReceiptNumber ?? '',
      phoneNumber: doc.phoneNumber,
      tableRef: doc.tableRef ?? '',
      status: doc.status,
      matchStatus: doc.matchStatus as MatchStatus,
      amount: doc.mpesaAmount ?? doc.expectedAmount ?? 0,
      expectedAmount: doc.expectedAmount ?? null,
      mpesaAmount: doc.mpesaAmount ?? null,
      timestamp: (doc.mpesaTimestamp ?? doc.createdAt)?.toISOString() ?? null,
      claimedTo,
      claimedAt: doc.claimedAt?.toISOString() ?? null,
      initiatedBy,
    };
  });

  const totals = transactions.reduce(
    (acc, t) => {
      acc.totalAmount += Number(t.amount) || 0;
      acc.totalTransactions += 1;
      if (t.claimedTo) acc.claimedCount += 1;
      else acc.unclaimedCount += 1;
      return acc;
    },
    { totalAmount: 0, totalTransactions: 0, claimedCount: 0, unclaimedCount: 0 }
  );

  const waiterStatsMap = new Map<string, { name: string; type: 'waiter' | 'external' | 'unclaimed'; count: number; total: number }>();
  transactions.forEach((t) => {
    const key = t.claimedTo ? `${t.claimedTo.type}:${t.claimedTo.name}` : 'unclaimed:unclaimed';
    const existing = waiterStatsMap.get(key) ?? {
      name: t.claimedTo?.name ?? 'Unclaimed',
      type: t.claimedTo?.type ?? 'unclaimed',
      count: 0,
      total: 0,
    };
    existing.count += 1;
    existing.total += Number(t.amount) || 0;
    waiterStatsMap.set(key, existing);
  });

  const waiterStats = [...waiterStatsMap.values()].sort((a, b) => b.total - a.total);
  const waiters = waiterUsers
    .map((u) => ({ id: u._id.toString(), name: (u.name as string) || 'Unknown', email: (u.email as string) || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const promptSummary = promptDocs.reduce(
    (acc, d) => {
      const amount = Number(d.amount ?? 0);
      acc.total += amount;
      acc.count += 1;
      if ((d.status ?? '').toLowerCase() === 'success') acc.success += 1;
      if ((d.status ?? '').toLowerCase() === 'failed') acc.failed += 1;
      if ((d.status ?? '').toLowerCase() === 'pending') acc.pending += 1;
      return acc;
    },
    { total: 0, count: 0, success: 0, failed: 0, pending: 0 }
  );

  const promptTransactions = promptDocs.slice(0, 80).map((d) => {
    const waiterId = d.waiterUserId?.toString();
    const waiterName = waiterId ? (waiterMap.get(waiterId)?.name ?? 'Unknown') : 'Unknown';
    return {
      id: d._id.toString(),
      waiterName,
      phoneNumber: d.phoneNumber ?? '',
      amount: Number(d.amount ?? 0),
      status: d.status ?? 'unknown',
      receipt: d.mpesaReceiptNumber ?? '',
      tableRef: d.tableRef ?? '',
      timestamp: (d.transactionDate ?? d.createdAt)?.toISOString() ?? null,
    };
  });

  const unclaimedTransactions = transactions
    .filter((t) => !t.claimedTo)
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

  return {
    period,
    filters: {
      q: filters.q,
      code: filters.code,
      phone: filters.phone,
      minAmount: filters.minAmount ?? null,
      maxAmount: filters.maxAmount ?? null,
    },
    totals: {
      ...totals,
      totalAmount: Number(totals.totalAmount.toFixed(2)),
    },
    waiterStats: waiterStats.map((w) => ({ ...w, total: Number(w.total.toFixed(2)) })),
    waiters,
    transactions,
    unclaimedTransactions,
    promptSummary: {
      ...promptSummary,
      total: Number(promptSummary.total.toFixed(2)),
    },
    promptTransactions,
    waiterPromptSummary: {
      totalBalance: Number(
        promptDocs
          .filter((d) => {
            const uid = d.waiterUserId?.toString();
            return !!uid && memberRoleById.get(uid) === 'waiter';
          })
          .reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
          .toFixed(2)
      ),
      totalTransactions: promptDocs.filter((d) => {
        const uid = d.waiterUserId?.toString();
        return !!uid && memberRoleById.get(uid) === 'waiter';
      }).length,
      failedTransactions: promptDocs.filter((d) => {
        const uid = d.waiterUserId?.toString();
        return !!uid && memberRoleById.get(uid) === 'waiter' && (d.status ?? '').toLowerCase() === 'failed';
      }).length,
      claimedByWaiters: promptDocs.filter((d) => {
        const uid = d.waiterUserId?.toString();
        return !!uid && memberRoleById.get(uid) === 'waiter';
      }).length,
      adminInitiated: promptDocs.filter((d) => {
        const uid = d.waiterUserId?.toString();
        if (!uid) return false;
        const role = memberRoleById.get(uid);
        return role === 'admin' || role === 'owner';
      }).length,
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await authorize(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const period = parsePeriod(req.nextUrl.searchParams.get('period'));
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const phone = req.nextUrl.searchParams.get('phone') ?? '';
  const minAmountRaw = req.nextUrl.searchParams.get('minAmount');
  const maxAmountRaw = req.nextUrl.searchParams.get('maxAmount');
  const minAmount = minAmountRaw != null && minAmountRaw !== '' ? Number(minAmountRaw) : undefined;
  const maxAmount = maxAmountRaw != null && maxAmountRaw !== '' ? Number(maxAmountRaw) : undefined;
  const data = await buildResponse(auth.orgId, period, {
    q,
    code,
    phone,
    minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
    maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await authorize(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const period = parsePeriod(typeof body?.period === 'string' ? body.period : null);
    const q = typeof body?.q === 'string' ? body.q : '';
    const code = typeof body?.code === 'string' ? body.code : '';
    const phone = typeof body?.phone === 'string' ? body.phone : '';
    const minAmountRaw = body?.minAmount;
    const maxAmountRaw = body?.maxAmount;
    const minAmount = minAmountRaw != null && minAmountRaw !== '' ? Number(minAmountRaw) : undefined;
    const maxAmount = maxAmountRaw != null && maxAmountRaw !== '' ? Number(maxAmountRaw) : undefined;

    const rangeStart = getRangeStart(period === 'all' ? '48h' : period);
    const rangeEnd = new Date();

    const pullResult = await queryPullTransactionsAndIngest({
      organizationId: auth.orgId,
      startDate: rangeStart ?? undefined,
      endDate: rangeEnd,
      offsetValue: typeof body?.offsetValue === 'string' ? body.offsetValue : undefined,
    });

    const data = await buildResponse(auth.orgId, period, {
      q,
      code,
      phone,
      minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
      maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
    });
    return NextResponse.json({ success: true, data, pullResult });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
