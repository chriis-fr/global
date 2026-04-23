import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { OrganizationService } from '@/lib/services/organizationService';
import { reconTillAttributedNoStkLink } from '@/lib/mpesa/reconTillMatch';
import type { ReconTransaction } from '@/models/ReconTransaction';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
} from 'lucide-react';

interface WaiterDetailPageProps {
  params: Promise<{ waiterId: string }>;
  searchParams?: Promise<{ page?: string }>;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function WaiterDetailPage({ params, searchParams }: WaiterDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth');

  const organizationId = session.user.organizationId as string | undefined;
  if (!organizationId) redirect('/dashboard');

  const { waiterId } = await params;
  if (!waiterId) notFound();
  const sp = searchParams ? await searchParams : {};

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org?._id) notFound();

  const mpesaEnabled = org.settings?.mpesa?.enabled === true;
  if (!mpesaEnabled) notFound();

  const member = org.members.find((m) => m.userId.toString() === session.user.id);
  const role = member?.role ?? null;
  // Owners/admins can view any waiter; a waiter can view only their own history
  if (role !== 'owner' && role !== 'admin' && session.user.id !== waiterId) notFound();

  const waiterMember = org.members.find((m) => m.userId.toString() === waiterId);
  if (!waiterMember || waiterMember.role !== 'waiter') notFound();

  const db = await connectToDatabase();
  const users = db.collection('users');

  const waiterUser = await users.findOne(
    { _id: new ObjectId(waiterId) },
    { projection: { name: 1, email: 1 } }
  );
  if (!waiterUser) notFound();

  const waiterName = (waiterUser.name as string) || 'Waiter';
  const waiterEmail = (waiterUser.email as string) || '';

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <Link
          href="/dashboard/services/mpesa"
          className="inline-flex items-center gap-2 text-blue-200 hover:text-white text-sm font-medium mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to M-Pesa
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <User className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">{waiterName}</h1>
              {waiterEmail && (
                <div className="flex items-center gap-2 text-blue-200 text-sm mt-0.5">
                  <Mail className="h-4 w-4" />
                  {waiterEmail}
                </div>
              )}
              <p className="text-xs text-blue-300 mt-1">
                Waiter · STK prompts and claimed till payments (read-only)
              </p>
            </div>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4 animate-pulse"
              >
                <div className="h-4 w-16 bg-white/20 rounded mb-3" />
                <div className="h-7 w-24 bg-white/30 rounded mb-1" />
                <div className="h-3 w-20 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        }
      >
        <WaiterStatsSection organizationId={organizationId} waiterId={waiterId} />
      </Suspense>

      <Suspense
        fallback={
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-4 sm:p-6">
            <div className="h-4 w-40 bg-white/20 rounded mb-4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        }
      >
        <WaiterCollectionsSection
          organizationId={organizationId}
          waiterId={waiterId}
          page={Number(sp.page ?? '1') || 1}
        />
      </Suspense>
    </div>
  );
}

type UnifiedPaymentRow = {
  kind: 'stk' | 'till';
  id: string;
  sortAt: Date;
  amount: number;
  status: string;
  phoneNumber: string;
  mpesaReceiptNumber: string;
};

async function fetchWaiterPaymentsMerged(
  organizationId: string,
  waiterId: string,
  limit: number,
  page: number
): Promise<{ rows: UnifiedPaymentRow[]; total: number }> {
  const db = await connectToDatabase();
  const sessionsCol = db.collection('mpesa_stk_sessions');
  const orgObjectId = new ObjectId(organizationId);
  const waiterObjectId = new ObjectId(waiterId);
  const skip = (page - 1) * limit;

  const pipeline: object[] = [
    { $match: { organizationId: orgObjectId, waiterUserId: waiterObjectId } },
    {
      $project: {
        kind: { $literal: 'stk' },
        rawId: '$_id',
        sortAt: '$createdAt',
        amount: '$amount',
        status: '$status',
        phoneNumber: '$phoneNumber',
        mpesaReceiptNumber: '$mpesaReceiptNumber',
      },
    },
    {
      $unionWith: {
        coll: 'recon_transactions',
        pipeline: [
          {
            $match: {
              ...reconTillAttributedNoStkLink(orgObjectId),
              waiterUserId: waiterObjectId,
            },
          },
          {
            $project: {
              kind: { $literal: 'till' },
              rawId: '$_id',
              sortAt: { $ifNull: ['$mpesaTimestamp', '$createdAt'] },
              amount: { $ifNull: ['$mpesaAmount', '$expectedAmount'] },
              status: { $literal: 'success' },
              phoneNumber: '$phoneNumber',
              mpesaReceiptNumber: '$mpesaReceiptNumber',
            },
          },
        ],
      },
    },
    { $sort: { sortAt: -1 } },
    {
      $project: {
        kind: 1,
        id: { $toString: '$rawId' },
        sortAt: 1,
        amount: 1,
        status: 1,
        phoneNumber: { $ifNull: ['$phoneNumber', ''] },
        mpesaReceiptNumber: { $ifNull: ['$mpesaReceiptNumber', ''] },
      },
    },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const out = await sessionsCol.aggregate(pipeline).toArray();
  const facet = out[0] as {
    rows: UnifiedPaymentRow[];
    total: { n: number }[];
  };
  const total = facet?.total?.[0]?.n ?? 0;
  const rows = (facet?.rows ?? []).map((r) => ({
    ...r,
    sortAt: r.sortAt ? new Date(r.sortAt as unknown as string) : new Date(0),
    amount: Number(r.amount ?? 0),
    phoneNumber: String(r.phoneNumber ?? ''),
    mpesaReceiptNumber: String(r.mpesaReceiptNumber ?? ''),
    status: String(r.status ?? ''),
  }));
  return { rows, total };
}

async function sumStkSuccessInRange(
  orgOid: ObjectId,
  waiterOid: ObjectId,
  start: Date
): Promise<{ total: number; count: number }> {
  const db = await connectToDatabase();
  const agg = await db
    .collection('mpesa_stk_sessions')
    .aggregate<{ total: number; count: number }>([
      {
        $match: {
          organizationId: orgOid,
          waiterUserId: waiterOid,
          status: 'success',
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return { total: agg[0]?.total ?? 0, count: agg[0]?.count ?? 0 };
}

async function sumStkSuccessAllTime(
  orgOid: ObjectId,
  waiterOid: ObjectId
): Promise<{ total: number; count: number }> {
  const db = await connectToDatabase();
  const agg = await db
    .collection('mpesa_stk_sessions')
    .aggregate<{ total: number; count: number }>([
      {
        $match: {
          organizationId: orgOid,
          waiterUserId: waiterOid,
          status: 'success',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return { total: agg[0]?.total ?? 0, count: agg[0]?.count ?? 0 };
}

async function sumReconTillInRange(
  orgOid: ObjectId,
  waiterOid: ObjectId,
  start: Date
): Promise<{ total: number; count: number }> {
  const db = await connectToDatabase();
  const reconCol = db.collection<ReconTransaction>('recon_transactions');
  const agg = await reconCol
    .aggregate<{ total: number; count: number }>([
      {
        $match: {
          ...reconTillAttributedNoStkLink(orgOid),
          waiterUserId: waiterOid,
        },
      },
      { $addFields: { at: { $ifNull: ['$mpesaTimestamp', '$createdAt'] } } },
      { $match: { at: { $gte: start } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return { total: agg[0]?.total ?? 0, count: agg[0]?.count ?? 0 };
}

async function sumReconTillAllTime(
  orgOid: ObjectId,
  waiterOid: ObjectId
): Promise<{ total: number; count: number }> {
  const db = await connectToDatabase();
  const reconCol = db.collection<ReconTransaction>('recon_transactions');
  const agg = await reconCol
    .aggregate<{ total: number; count: number }>([
      {
        $match: {
          ...reconTillAttributedNoStkLink(orgOid),
          waiterUserId: waiterOid,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  return { total: agg[0]?.total ?? 0, count: agg[0]?.count ?? 0 };
}

async function WaiterStatsSection({
  organizationId,
  waiterId,
}: {
  organizationId: string;
  waiterId: string;
}) {
  const orgOid = new ObjectId(organizationId);
  const waiterOid = new ObjectId(waiterId);
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const [
    stkToday,
    reconToday,
    stkWeek,
    reconWeek,
    stkMonth,
    reconMonth,
    stkAll,
    reconAll,
  ] = await Promise.all([
    sumStkSuccessInRange(orgOid, waiterOid, todayStart),
    sumReconTillInRange(orgOid, waiterOid, todayStart),
    sumStkSuccessInRange(orgOid, waiterOid, weekStart),
    sumReconTillInRange(orgOid, waiterOid, weekStart),
    sumStkSuccessInRange(orgOid, waiterOid, monthStart),
    sumReconTillInRange(orgOid, waiterOid, monthStart),
    sumStkSuccessAllTime(orgOid, waiterOid),
    sumReconTillAllTime(orgOid, waiterOid),
  ]);

  const todayAmount = stkToday.total + reconToday.total;
  const weekAmount = stkWeek.total + reconWeek.total;
  const monthAmount = stkMonth.total + reconMonth.total;
  const allTimeAmount = stkAll.total + reconAll.total;

  const todayCount = stkToday.count + reconToday.count;
  const weekCount = stkWeek.count + reconWeek.count;
  const monthCount = stkMonth.count + reconMonth.count;
  const allTimeCount = stkAll.count + reconAll.count;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
        <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
          <Calendar className="h-4 w-4" />
          Today
        </div>
        <p className="text-2xl font-semibold text-white">
          KES {todayAmount.toLocaleString()}
        </p>
        <p className="text-xs text-blue-300">{todayCount} payments</p>
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
        <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
          <Calendar className="h-4 w-4" />
          This week
        </div>
        <p className="text-2xl font-semibold text-white">
          KES {weekAmount.toLocaleString()}
        </p>
        <p className="text-xs text-blue-300">{weekCount} payments</p>
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
        <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
          <Calendar className="h-4 w-4" />
          This month
        </div>
        <p className="text-2xl font-semibold text-white">
          KES {monthAmount.toLocaleString()}
        </p>
        <p className="text-xs text-blue-300">{monthCount} payments</p>
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
        <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
          <Receipt className="h-4 w-4" />
          All time
        </div>
        <p className="text-2xl font-semibold text-white">
          KES {allTimeAmount.toLocaleString()}
        </p>
        <p className="text-xs text-blue-300">{allTimeCount} payments</p>
      </div>
    </div>
  );
}

async function WaiterCollectionsSection({
  organizationId,
  waiterId,
  page,
}: {
  organizationId: string;
  waiterId: string;
  page: number;
}) {
  const pageSize = 10;
  const { rows, total } = await fetchWaiterPaymentsMerged(
    organizationId,
    waiterId,
    pageSize,
    page
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-300" />
          Payments (STK + till, read-only)
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-blue-200">
            {total} item{total !== 1 ? 's' : ''} total (page {currentPage} of {totalPages})
          </p>
          <div className="flex items-center gap-1">
            {hasPrev && (
              <Link
                href={`/dashboard/services/mpesa/waiter/${waiterId}?page=${currentPage - 1}`}
                className="text-[11px] text-blue-300 hover:text-white underline-offset-2 hover:underline"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/dashboard/services/mpesa/waiter/${waiterId}?page=${currentPage + 1}`}
                className="text-[11px] text-blue-300 hover:text-white underline-offset-2 hover:underline"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-blue-200">
          No M-Pesa prompts or claimed till payments for this waiter yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-blue-200 border-b border-white/10">
                <th className="py-2 pr-4 text-left font-medium">Date / Time</th>
                <th className="py-2 px-4 text-left font-medium">Source</th>
                <th className="py-2 px-4 text-left font-medium">Amount (KES)</th>
                <th className="py-2 px-4 text-left font-medium">Status</th>
                <th className="py-2 px-4 text-left font-medium">Phone</th>
                <th className="py-2 px-4 text-left font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const createdAt = s.sortAt;
                const isSuccess = s.status === 'success';
                return (
                  <tr key={`${s.kind}-${s.id}`} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-blue-100">
                      {createdAt
                        ? createdAt.toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-blue-200 text-xs uppercase tracking-wide">
                      {s.kind === 'till' ? 'Till' : 'STK'}
                    </td>
                    <td className="py-2 px-4 text-blue-100 font-medium">
                      {Number(s.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle className="h-4 w-4" />
                          Success
                        </span>
                      ) : s.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <XCircle className="h-4 w-4" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Clock className="h-4 w-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-blue-100 font-mono text-xs">
                      {s.phoneNumber || '—'}
                    </td>
                    <td className="py-2 px-4 text-blue-100 font-mono text-xs">
                      {s.mpesaReceiptNumber || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
