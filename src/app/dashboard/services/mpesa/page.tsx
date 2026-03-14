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
import { Waves, Users, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

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

  // Load waiter user info
  const waiterIds = agg
    .map((g) => g._id)
    .filter((id): id is ObjectId => !!id);

  let waiterSummaries: MpesaWaiterSummary[] = [];

  if (waiterIds.length > 0) {
    const users = await db
      .collection('users')
      .find({ _id: { $in: waiterIds } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    waiterSummaries = agg.map((g) => {
      const user =
        users.find(
          (u) => g._id && u._id.toString() === (g._id as ObjectId).toString()
        ) || null;
      return {
        waiterUserId: g._id ? (g._id as ObjectId).toString() : 'unknown',
        waiterName: user?.name || 'Waiter',
        waiterEmail: user?.email as string | undefined,
        totalAmount: g.totalAmount ?? 0,
        count: g.count ?? 0,
        lastActivity: g.lastActivity,
      };
    });

    // Show only actual waiters in Waiter Summary (exclude owner/admin)
    if (waiterOnlyUserIds && waiterOnlyUserIds.length > 0) {
      const set = new Set(waiterOnlyUserIds);
      waiterSummaries = waiterSummaries.filter((w) => set.has(w.waiterUserId));
    }
  }

  return {
    totalAmount: totals.totalAmount ?? 0,
    successCount: totals.successCount ?? 0,
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
                Send payment prompts to customers. Your activity is tracked for
                end-of-day reports.
              </p>
            </div>
          </div>
        </div>

        <WaiterPromptCard />
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
              Track STK prompts by waiter, table, and status.
            </p>
          </div>
        </div>
      </div>

      {/* Stats (only when there is actual activity) */}
      {hasAnyStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MpesaTotalAmountCard />
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">Successful Prompts</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {dashboardData.successCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-300" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">Failed Prompts</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {dashboardData.failedCount}
              </p>
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
                Per-waiter totals across all prompts
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
                      <th className="py-2 px-4 text-left font-medium">Prompts</th>
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
          <WaiterPromptCard />
        </div>
      </div>
    </div>
  );
}

