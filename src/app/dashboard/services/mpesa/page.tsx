import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { OrganizationService } from '@/lib/services/organizationService';
import Link from 'next/link';
import { WaiterPromptCard } from '@/components/mpesa/WaiterPrompt';
import { RecentPromptsList } from '@/components/mpesa/RecentPromptsList';
import { MpesaTotalAmountCard } from '@/components/mpesa/MpesaTotalAmountCard';
import { AdminMpesaPrompt } from '@/components/mpesa/AdminMpesaPrompt';
import { Waves, Users, Clock, XCircle, ChevronRight, BarChart3, Receipt } from 'lucide-react';
import { getWaiterMpesaPaymentOverview } from '@/app/actions/mpesa-waiter-stats';
import type { ReconTransaction } from '@/models/ReconTransaction';
import { reconTillAttributedNoStkLink } from '@/lib/mpesa/reconTillMatch';

interface MpesaWaiterSummary {
  waiterUserId: string;
  waiterName: string;
  waiterEmail?: string;
  totalAmount: number;
  count: number;
  lastActivity?: Date;
}

interface MpesaDashboardData {
  totalAmount: number;
  successCount: number;
  failedCount: number;
  waiterSummaries: MpesaWaiterSummary[];
}

/** If provided, only include users whose org role is 'waiter' (exclude owner/admin). */
async function getMpesaDashboardData(
  organizationId: string,
  waiterOnlyUserIds?: string[]
): Promise<MpesaDashboardData> {
  const db = await connectToDatabase();
  const sessions = db.collection('mpesa_stk_sessions');
  const reconCol = db.collection<ReconTransaction>('recon_transactions');

  const orgObjectId = new ObjectId(organizationId);

  // Aggregate per waiter (all users who have prompts)
  const agg = await sessions
    .aggregate<{
      _id: ObjectId | null;
      totalAmount: number;
      count: number;
      lastActivity?: Date;
    }>([
      { $match: { organizationId: orgObjectId } },
      {
        $group: {
          _id: '$waiterUserId',
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0],
            },
          },
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
        },
      },
    ])
    .toArray();

  const totalAgg = await sessions
    .aggregate<{
      _id: null;
      totalAmount: number;
      successCount: number;
      failedCount: number;
    }>([
      { $match: { organizationId: orgObjectId } },
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

  const totals = totalAgg[0] ?? {
    totalAmount: 0,
    successCount: 0,
    failedCount: 0,
  };

  const reconOrgAgg = await reconCol
    .aggregate<{ _id: null; totalAmount: number; count: number }>([
      { $match: reconTillAttributedNoStkLink(orgObjectId) },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const reconOrg = reconOrgAgg[0] ?? { totalAmount: 0, count: 0 };

  const reconPerWaiterPipeline: object[] = [
    { $match: reconTillAttributedNoStkLink(orgObjectId) },
  ];
  if (waiterOnlyUserIds && waiterOnlyUserIds.length > 0) {
    reconPerWaiterPipeline.push({
      $match: {
        waiterUserId: {
          $in: waiterOnlyUserIds.map((id) => new ObjectId(id)),
        },
      },
    });
  }
  reconPerWaiterPipeline.push(
    {
      $group: {
        _id: '$waiterUserId',
        totalAmount: { $sum: { $ifNull: ['$mpesaAmount', '$expectedAmount'] } },
        count: { $sum: 1 },
        lastActivity: { $max: { $ifNull: ['$mpesaTimestamp', '$createdAt'] } },
      },
    },
    { $sort: { totalAmount: -1 } },
  );

  const reconAgg = await reconCol
    .aggregate<{
      _id: ObjectId;
      totalAmount: number;
      count: number;
      lastActivity?: Date;
    }>(reconPerWaiterPipeline)
    .toArray();

  type StkRow = {
    id: string;
    totalAmount: number;
    count: number;
    lastActivity?: Date;
  };
  const stkByWaiter = new Map<string, StkRow>();
  for (const g of agg) {
    if (!g._id) continue;
    const id = (g._id as ObjectId).toString();
    stkByWaiter.set(id, {
      id,
      totalAmount: g.totalAmount ?? 0,
      count: g.count ?? 0,
      lastActivity: g.lastActivity,
    });
  }

  const reconByWaiter = new Map<string, StkRow>();
  for (const g of reconAgg) {
    if (!g._id) continue;
    const id = g._id.toString();
    reconByWaiter.set(id, {
      id,
      totalAmount: g.totalAmount ?? 0,
      count: g.count ?? 0,
      lastActivity: g.lastActivity,
    });
  }

  const unionIds = new Set<string>([...stkByWaiter.keys(), ...reconByWaiter.keys()]);
  let waiterIds = [...unionIds].filter((id) => ObjectId.isValid(id));
  if (waiterOnlyUserIds && waiterOnlyUserIds.length > 0) {
    const allowed = new Set(waiterOnlyUserIds);
    waiterIds = waiterIds.filter((id) => allowed.has(id));
  }

  let waiterSummaries: MpesaWaiterSummary[] = [];

  if (waiterIds.length > 0) {
    const oids = waiterIds.map((id) => new ObjectId(id));
    const users = await db
      .collection('users')
      .find({ _id: { $in: oids } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    waiterSummaries = waiterIds.map((wid) => {
      const stk = stkByWaiter.get(wid);
      const recon = reconByWaiter.get(wid);
      const user = users.find((u) => u._id.toString() === wid) || null;
      const stkAmt = stk?.totalAmount ?? 0;
      const reconAmt = recon?.totalAmount ?? 0;
      const stkCnt = stk?.count ?? 0;
      const reconCnt = recon?.count ?? 0;
      const lastStk = stk?.lastActivity;
      const lastRecon = recon?.lastActivity;
      let lastActivity: Date | undefined;
      if (lastStk && lastRecon) {
        lastActivity = new Date(lastStk) > new Date(lastRecon) ? lastStk : lastRecon;
      } else {
        lastActivity = lastStk ?? lastRecon;
      }
      return {
        waiterUserId: wid,
        waiterName: (user?.name as string) || 'Waiter',
        waiterEmail: user?.email as string | undefined,
        totalAmount: stkAmt + reconAmt,
        count: stkCnt + reconCnt,
        lastActivity,
      };
    });

    waiterSummaries.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  return {
    totalAmount: (totals.totalAmount ?? 0) + (reconOrg.totalAmount ?? 0),
    successCount: (totals.successCount ?? 0) + (reconOrg.count ?? 0),
    failedCount: totals.failedCount ?? 0,
    waiterSummaries,
  };
}

export default async function MpesaServicePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth');
  }

  const organizationId = session.user.organizationId as string | undefined;

  // Admin account without org: allow testing M-Pesa for any org that has M-Pesa enabled
  if (!organizationId && session.user.adminTag) {
    const db = await connectToDatabase();
    const orgs = await db
      .collection('organizations')
      .find({ 'settings.mpesa.enabled': true })
      .project({ _id: 1, name: 1 })
      .toArray();
    const enabledOrgs = orgs.map((o) => ({
      id: (o._id as ObjectId).toString(),
      name: o.name as string,
    }));

    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Waves className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">M-Pesa Admin Prompt</h1>
              <p className="text-blue-200 text-sm">
                Select an organization with M-Pesa enabled and send a test prompt using its configuration.
              </p>
            </div>
          </div>
        </div>

        {enabledOrgs.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <p className="text-blue-200 text-sm">
              No organizations with M-Pesa enabled were found. Enable M-Pesa for an organization in the
              admin panel first.
            </p>
          </div>
        ) : (
          <AdminMpesaPrompt organizations={enabledOrgs} />
        )}
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h1 className="text-xl font-semibold text-white mb-2">M-Pesa</h1>
          <p className="text-blue-200 text-sm">
            M-Pesa services are only available for organization accounts.
          </p>
        </div>
      </div>
    );
  }

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org || !org._id) {
    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h1 className="text-xl font-semibold text-white mb-2">M-Pesa</h1>
          <p className="text-blue-200 text-sm">
            Organization not found. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  const member = org.members.find(
    (m) => m.userId.toString() === session.user.id
  );
  const orgRole = member?.role ?? (session.user as { organizationRole?: string }).organizationRole ?? null;

  // Waiters: show prompt UI immediately (having a waiter means org has M-Pesa enabled)
  if (orgRole === 'waiter') {
    const overviewRes = await getWaiterMpesaPaymentOverview();
    const o = overviewRes.success && overviewRes.data
      ? overviewRes.data
      : {
          stkSuccessTotal: 0,
          stkSessionCount: 0,
          tillClaimedTotal: 0,
          tillClaimCount: 0,
        };
    const combinedSuccess = o.stkSuccessTotal + o.tillClaimedTotal;
    const waiterSelfId = session.user.id ?? '';

    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Waves className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">M-Pesa Prompt</h1>
              <p className="text-blue-200 text-sm">
                Send payment prompts to customers. Till payments you claim from the dashboard appear
                here with your STK prompts.
              </p>
            </div>
          </div>
        </div>

        <WaiterPromptCard currentUserId={session.user.id ?? undefined} />

        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <Receipt className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Your payments</h2>
                <p className="text-xs text-blue-200 mt-1 max-w-xl">
                  Successful STK collections plus till payments you claimed (same totals as your detail page).
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-blue-300">STK success (KES)</dt>
                    <dd className="text-white font-medium tabular-nums">{o.stkSuccessTotal.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-300">Till claimed (KES)</dt>
                    <dd className="text-white font-medium tabular-nums">{o.tillClaimedTotal.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-300">STK prompts</dt>
                    <dd className="text-white font-medium">{o.stkSessionCount}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-300">Till claims</dt>
                    <dd className="text-white font-medium">{o.tillClaimCount}</dd>
                  </div>
                </dl>
                <p className="text-xs text-blue-200 mt-3">
                  Combined successful total:{' '}
                  <span className="text-white font-semibold">KES {combinedSuccess.toLocaleString()}</span>
                </p>
              </div>
            </div>
            {waiterSelfId && (
              <Link
                href={`/dashboard/services/mpesa/waiter/${waiterSelfId}`}
                className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Full history
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const mpesaEnabled = org.settings?.mpesa?.enabled === true;
  if (!mpesaEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h1 className="text-xl font-semibold text-white mb-2">M-Pesa</h1>
          <p className="text-blue-200 text-sm">
            M-Pesa has not been enabled for this organization. Please contact your
            admin.
          </p>
        </div>
      </div>
    );
  }

  // Non-waiter roles: full dashboard + optional prompt card
  const waiterOnlyUserIds = org.members
    .filter((m) => m.role === 'waiter')
    .map((m) => m.userId.toString());
  const dashboardData = await getMpesaDashboardData(
    organizationId,
    waiterOnlyUserIds
  );
  const hasAnyStats =
    (dashboardData.totalAmount ?? 0) > 0 ||
    (dashboardData.successCount ?? 0) > 0 ||
    (dashboardData.failedCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Waves className="h-6 w-6 text-blue-300" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white">
              M-Pesa Payments
            </h1>
            <p className="text-blue-200 text-sm">
              Track STK prompts and till payments claimed by each waiter.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/services/mpesa/reconciliation"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Reconciliation
        </Link>
      </div>

      {/* Stats (only when there is actual activity) */}
      {hasAnyStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MpesaTotalAmountCard />
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">Successful Payments</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {dashboardData.successCount}
              </p>
              <p className="text-xs text-blue-300 mt-0.5">
                Successful STK + claimed till ({dashboardData.successCount} item
                {dashboardData.successCount !== 1 ? 's' : ''})
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-300" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">Failed Payments</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {dashboardData.failedCount}
              </p>
              <p className="text-xs text-blue-300 mt-0.5">{dashboardData.failedCount} prompt{dashboardData.failedCount !== 1 ? 's' : ''}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      )}

      {/* Waiter breakdown + prompt card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* On mobile, show the STK prompt first; on desktop, keep waiter summary on the left */}
        <div className="order-2 lg:order-1 lg:col-span-2 space-y-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-300" />
                <h2 className="text-sm font-semibold text-white">
                  Waiter Summary
                </h2>
              </div>
              <p className="text-xs text-blue-200">
                STK prompts (all statuses) + successful till claims per waiter
              </p>
            </div>
            {dashboardData.waiterSummaries.length === 0 ? (
              <p className="text-sm text-blue-200">
                No M-Pesa activity recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-blue-200 border-b border-white/10">
                      <th className="py-2 pr-4 text-left font-medium">Waiter</th>
                      <th className="py-2 px-4 text-left font-medium">Count</th>
                      <th className="py-2 px-4 text-left font-medium">Total (KES)</th>
                      <th className="py-2 px-4 text-left font-medium">Last Activity</th>
                      <th className="py-2 pl-4 w-8" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.waiterSummaries.map((w) => (
                      <tr key={w.waiterUserId} className="border-b border-white/5 group">
                        <td className="py-2 pr-4 text-blue-100">
                          <Link
                            href={`/dashboard/services/mpesa/waiter/${w.waiterUserId}`}
                            className="flex flex-col hover:text-white transition-colors"
                          >
                            <span className="font-medium">{w.waiterName}</span>
                            {w.waiterEmail && (
                              <span className="text-xs text-blue-300 group-hover:text-blue-200">
                                {w.waiterEmail}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-2 px-4 text-blue-100">
                          <Link
                            href={`/dashboard/services/mpesa/waiter/${w.waiterUserId}`}
                            className="hover:text-white transition-colors"
                          >
                            {w.count}
                          </Link>
                        </td>
                        <td className="py-2 px-4 text-blue-100">
                          <Link
                            href={`/dashboard/services/mpesa/waiter/${w.waiterUserId}`}
                            className="hover:text-white transition-colors"
                          >
                            {w.totalAmount.toLocaleString()}
                          </Link>
                        </td>
                        <td className="py-2 px-4 text-blue-100">
                          <Link
                            href={`/dashboard/services/mpesa/waiter/${w.waiterUserId}`}
                            className="hover:text-white transition-colors"
                          >
                            {w.lastActivity
                              ? w.lastActivity.toLocaleString()
                              : '—'}
                          </Link>
                        </td>
                        <td className="py-2 pl-4 text-blue-300 group-hover:text-white">
                          <Link
                            href={`/dashboard/services/mpesa/waiter/${w.waiterUserId}`}
                            className="inline-flex"
                            aria-label="View waiter details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent prompts (org-wide) — below Waiter Summary for admins */}
          <RecentPromptsList />
        </div>

        <div className="order-1 lg:order-2">
          <WaiterPromptCard currentUserId={session.user.id ?? undefined} />
        </div>
      </div>
    </div>
  );
}

