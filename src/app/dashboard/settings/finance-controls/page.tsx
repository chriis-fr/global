'use client';

import { ShieldCheck, Lock, Unlock, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/lib/contexts/PermissionContext';
import { useSession } from '@/lib/auth-client';
import { getFinanceControlsSettings, getFinancialInsights } from '@/lib/actions/finance-controls';

export default function FinanceControlsSettingsPage() {
  const { data: session } = useSession();
  const { permissions } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    periodLocking: boolean;
    bulkActions: boolean;
    carryForward: boolean;
    auditLog: boolean;
  } | null>(null);
  const [insightsSummary, setInsightsSummary] = useState<{
    overdueCount: number;
    totalOutstanding: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Finance controls are only for organization accounts
      if (!session?.user?.organizationId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [settingsResult, insightsResult] = await Promise.all([
          getFinanceControlsSettings(),
          getFinancialInsights()
        ]);

        if (cancelled) return;

        if (settingsResult.success && settingsResult.data) {
          setSettings(settingsResult.data);
        }
        if (insightsResult.success && insightsResult.data) {
          setInsightsSummary({
            overdueCount: insightsResult.data.overdueCount,
            totalOutstanding: insightsResult.data.totalOutstanding
          });
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load finance controls right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.organizationId]);

  const hasAnyFinancePermission =
    permissions.canClosePeriod ||
    permissions.canReopenPeriod ||
    permissions.canWriteOff ||
    permissions.canBulkUpdate ||
    permissions.canViewAudit;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          Finance Controls
        </h1>
        <p className="text-blue-200/90 text-sm md:text-base">
          Period locking, proper adjustments, and audit trails for enterprise-grade financial control.
        </p>
      </div>

      {!session?.user?.organizationId && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Finance controls are only available for organizations. Individual accounts don&apos;t have period locking or ledger
          adjustments.
        </div>
      )}

      {session?.user?.organizationId && !hasAnyFinancePermission && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Your role does not have access to manage finance controls. Ask an owner or admin to update your permissions.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-300" />
            <h2 className="text-sm font-semibold text-white/90">Period Locking</h2>
          </div>
          <p className="text-xs text-blue-100/80">
            Close and lock months or quarters so past invoices cannot be edited, only adjusted via proper entries.
          </p>
          <p className="text-xs text-blue-200/80 mt-2">
            Status:{' '}
            <span className="font-semibold">
              {settings?.periodLocking ? 'Enabled' : loading ? 'Loading…' : 'Disabled'}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-blue-300" />
            <h2 className="text-sm font-semibold text-white/90">Bulk Payments & Adjustments</h2>
          </div>
          <p className="text-xs text-blue-100/80">
            Use bulk mark-as-paid tools that post payment entries instead of directly overriding invoice fields.
          </p>
          <p className="text-xs text-blue-200/80 mt-2">
            Status:{' '}
            <span className="font-semibold">
              {settings?.bulkActions ? 'Enabled' : loading ? 'Loading…' : 'Disabled'}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-semibold text-white/90">Current Period Snapshot</h2>
        </div>
        <p className="text-xs text-blue-100/80">
          High-level view derived from your existing invoices and payment entries. No data is cleared or rewritten.
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs mt-2">
          <div className="rounded-lg bg-black/20 border border-white/10 px-3 py-2">
            <p className="text-blue-200/80">Overdue invoices</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {insightsSummary ? insightsSummary.overdueCount : loading ? '—' : '0'}
            </p>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 px-3 py-2">
            <p className="text-blue-200/80">Total outstanding</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {insightsSummary
                ? insightsSummary.totalOutstanding.toLocaleString(undefined, {
                    maximumFractionDigits: 2
                  })
                : loading
                  ? '—'
                  : '0'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

