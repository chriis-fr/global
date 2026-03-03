'use client';

import {
  ShieldCheck,
  Lock,
  Unlock,
  Activity,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  ListChecks,
  ChevronDown,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { usePermissions } from '@/lib/contexts/PermissionContext';
import { useSession } from '@/lib/auth-client';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { BILLING_PLANS } from '@/data/billingPlans';
import Link from 'next/link';
import {
  getFinanceControlsSettings,
  setFinanceControlsSettings,
  getFinancialInsights,
  listPeriods,
  createAccountingPeriod,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  createPaymentEntry,
  createAdjustment,
  carryForward,
  getFinanceAuditLog,
  listInvoicesForFinanceControls,
  type FinanceControlsInvoiceListItem,
} from '@/lib/actions/finance-controls';

type PeriodRow = {
  _id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  closedAtISO?: string;
  closedByUserId?: string;
};

function formatPeriodName(start: Date, end: Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = s.getMonth() === e.getMonth() && s.getDate() === 1 && e.getDate() >= 28;
  if (sameYear && sameMonth) {
    return s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (sameYear && (e.getMonth() - s.getMonth() + 1 === 3)) {
    return `Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()}`;
  }
  if (e.getFullYear() - s.getFullYear() === 1 && s.getMonth() === 0 && e.getMonth() === 11) {
    return `${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
}

export default function FinanceControlsSettingsPage() {
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  const { permissions, member } = usePermissions();

  // Admin accounts (adminTag) always get Finance Controls; others need Scale/Enterprise plan
  const isAdmin = session?.user?.adminTag === true;
  const billingPlan = subscription?.plan?.planId ? BILLING_PLANS.find(p => p.planId === subscription.plan!.planId) : undefined;
  const hasFinanceControlsPlan = !!billingPlan && (billingPlan.tier === 'scale' || billingPlan.isEnterprise === true);
  const canAccessFinanceControls = isAdmin || hasFinanceControlsPlan;
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{
    periodLocking: boolean;
    bulkActions: boolean;
    carryForward: boolean;
    auditLog: boolean;
  } | null>(null);
  const [insights, setInsights] = useState<{
    arAging: { current: number; days30: number; days60: number; days90Plus: number };
    paymentVelocity: number;
    overdueCount: number;
    totalOutstanding: number;
    volumeTrend: number;
  } | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [auditEntries, setAuditEntries] = useState<Array<{ _id: string; entityType: string; action: string; timestamp: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [periodForm, setPeriodForm] = useState<'monthly' | 'quarterly' | 'annual' | 'custom'>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenPeriodId, setReopenPeriodId] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentInvoiceSummary, setPaymentInvoiceSummary] = useState<{ invoiceNumber: string; clientName: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [adjustmentEntityType, setAdjustmentEntityType] = useState<'invoice' | 'payable'>('invoice');
  const [adjustmentEntityId, setAdjustmentEntityId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'WRITE_OFF' | 'CREDIT' | 'CORRECTION'>('WRITE_OFF');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [carryFromPeriodId, setCarryFromPeriodId] = useState('');
  const [carryToStart, setCarryToStart] = useState('');
  const [carryToEnd, setCarryToEnd] = useState('');
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [invoiceFilterStart, setInvoiceFilterStart] = useState('');
  const [invoiceFilterEnd, setInvoiceFilterEnd] = useState('');
  const [invoiceOptions, setInvoiceOptions] = useState<FinanceControlsInvoiceListItem[]>([]);
  const [invoiceOptionsLoading, setInvoiceOptionsLoading] = useState(false);
  const [invoiceOptionsError, setInvoiceOptionsError] = useState<string | null>(null);
  const scrollPositionRef = useRef(0);

  // Lock body/main scroll when invoice picker modal is open (same pattern as create invoice page)
  useEffect(() => {
    if (showInvoicePicker) {
      scrollPositionRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
      window.scrollTo(0, 0);
      document.body.style.cssText = `
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        width: 100% !important;
        overflow: hidden !important;
      `;
      document.documentElement.style.cssText = `
        overflow: hidden !important;
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        width: 100% !important;
      `;
      const main = document.querySelector('main');
      if (main) {
        (main as HTMLElement).style.cssText = 'overflow: hidden !important;';
      }
    } else {
      document.body.style.cssText = '';
      document.documentElement.style.cssText = '';
      const main = document.querySelector('main');
      if (main) {
        (main as HTMLElement).style.overflow = '';
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, scrollPositionRef.current);
      }
    }
    return () => {
      document.body.style.cssText = '';
      document.documentElement.style.cssText = '';
      const main = document.querySelector('main');
      if (main) {
        (main as HTMLElement).style.overflow = '';
      }
    };
  }, [showInvoicePicker]);

  const loadAll = useCallback(async () => {
    if (!session?.user?.organizationId) return;
    setError(null);
    try {
      setLoading(true);
      const [settingsRes, insightsRes, periodsRes, auditRes] = await Promise.all([
        getFinanceControlsSettings(),
        getFinancialInsights(),
        listPeriods(),
        getFinanceAuditLog({ limit: 30 }),
      ]);
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
      if (insightsRes.success && insightsRes.data) setInsights(insightsRes.data);
      if (periodsRes.success && periodsRes.data) {
        setPeriods(
          periodsRes.data.map((p) => ({
            ...p,
            startDate: new Date(p.startDate),
            endDate: new Date(p.endDate),
          }))
        );
      }
      if (auditRes.success && auditRes.data?.entries) {
        setAuditEntries(
          (auditRes.data.entries as Array<{ _id?: unknown; entityType: string; action: string; timestamp: Date }>)
            .slice(0, 20)
            .map((e) => ({
              _id: typeof e._id === 'object' && e._id !== null && 'toString' in e._id ? (e._id as { toString: () => string }).toString() : String(e._id ?? ''),
              entityType: e.entityType,
              action: e.action,
              timestamp: new Date(e.timestamp).toISOString(),
            }))
        );
      }
    } catch {
      setError('Failed to load financial controls.');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hasAnyFinancePermission =
    permissions.canClosePeriod ||
    permissions.canReopenPeriod ||
    permissions.canWriteOff ||
    permissions.canBulkUpdate ||
    permissions.canViewAudit;
  const isOrgOwnerOrAdmin = member?.role === 'owner' || member?.role === 'admin';
  const hasAccess = !!session?.user?.organizationId && (isOrgOwnerOrAdmin || hasAnyFinancePermission);
  const canChangeSettings = isOrgOwnerOrAdmin;

  const handleToggle = async (key: 'periodLocking' | 'bulkActions' | 'carryForward' | 'auditLog', value: boolean) => {
    if (!settings || !canChangeSettings) return;
    setSaving(true);
    setError(null);
    const next = { ...settings, [key]: value };
    const res = await setFinanceControlsSettings(next);
    setSaving(false);
    if (res.success) {
      setSettings(next);
      setSuccess(`${key === 'periodLocking' ? 'Period locking' : key === 'bulkActions' ? 'Bulk actions' : key === 'carryForward' ? 'Carry forward' : 'Audit log'} ${value ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(res.error ?? 'Failed to update settings');
    }
  };

  const handleCreatePeriod = async () => {
    let start: Date;
    let end: Date;
    const now = new Date();
    if (periodForm === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (periodForm === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3) + 1;
      start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      end = new Date(now.getFullYear(), q * 3, 0);
    } else if (periodForm === 'annual') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else {
      if (!customStart || !customEnd) {
        setError('Enter custom start and end dates.');
        return;
      }
      start = new Date(customStart);
      end = new Date(customEnd);
    }
    if (start >= end) {
      setError('Start date must be before end date.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createAccountingPeriod(start, end);
    setSaving(false);
    if (res.success) {
      setSuccess('Period created.');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to create period');
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    if (!confirm('Close this period? Invoices in this period will no longer be editable.')) return;
    setSaving(true);
    setError(null);
    const res = await closePeriod(periodId);
    setSaving(false);
    if (res.success) {
      setSuccess('Period closed.');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to close period');
    }
  };

  const handleLockPeriod = async (periodId: string) => {
    if (!confirm('Lock this period? Only adjustments will be allowed until reopened.')) return;
    setSaving(true);
    setError(null);
    const res = await lockPeriod(periodId);
    setSaving(false);
    if (res.success) {
      setSuccess('Period locked.');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to lock period');
    }
  };

  const handleReopenPeriod = async () => {
    if (!reopenPeriodId || !reopenReason.trim()) {
      setError('Select a period and enter a reason to reopen.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await reopenPeriod(reopenPeriodId, reopenReason.trim());
    setSaving(false);
    if (res.success) {
      setSuccess('Period reopened.');
      setReopenPeriodId(null);
      setReopenReason('');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to reopen period');
    }
  };

  const handlePaymentEntry = async () => {
    const amount = parseFloat(paymentAmount);
    if (!paymentInvoiceId.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Select an invoice and enter amount.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createPaymentEntry(
      paymentInvoiceId.trim(),
      amount,
      new Date(paymentDate),
      paymentMethod,
      paymentReference.trim() || undefined
    );
    setSaving(false);
    if (res.success) {
      setSuccess('Payment recorded.');
      setPaymentInvoiceId('');
      setPaymentInvoiceSummary(null);
      setPaymentAmount('');
      setPaymentReference('');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to record payment');
    }
  };

  const handleAdjustment = async () => {
    const amount = parseFloat(adjustmentAmount);
    if (!adjustmentEntityId.trim() || !Number.isFinite(amount) || amount <= 0 || !adjustmentReason.trim()) {
      setError('Enter entity ID, amount, and reason.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createAdjustment(
      adjustmentEntityType,
      adjustmentEntityId.trim(),
      adjustmentType,
      amount,
      adjustmentReason.trim()
    );
    setSaving(false);
    if (res.success) {
      setSuccess('Adjustment recorded.');
      setAdjustmentEntityId('');
      setAdjustmentAmount('');
      setAdjustmentReason('');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to create adjustment');
    }
  };

  const handleCarryForward = async () => {
    if (!carryFromPeriodId || !carryToStart || !carryToEnd) {
      setError('Select source period and target period dates.');
      return;
    }
    const start = new Date(carryToStart);
    const end = new Date(carryToEnd);
    if (start >= end) {
      setError('Target period end must be after start.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await carryForward(carryFromPeriodId, start, end);
    setSaving(false);
    if (res.success) {
      setSuccess(`Carry forward completed. ${res.data?.journalEntryIds?.length ?? 0} opening balance entries created.`);
      setCarryFromPeriodId('');
      setCarryToStart('');
      setCarryToEnd('');
      loadAll();
    } else {
      setError(res.error ?? 'Failed to carry forward');
    }
  };

  const loadInvoiceOptions = async () => {
    setInvoiceOptionsError(null);
    setInvoiceOptionsLoading(true);
    try {
      const res = await listInvoicesForFinanceControls({
        startDate: invoiceFilterStart ? new Date(invoiceFilterStart) : undefined,
        endDate: invoiceFilterEnd ? new Date(invoiceFilterEnd) : undefined,
      });
      if (res.success && res.data) {
        setInvoiceOptions(res.data);
      } else {
        setInvoiceOptionsError(res.error ?? 'Failed to load invoices');
      }
    } catch {
      setInvoiceOptionsError('Failed to load invoices');
    } finally {
      setInvoiceOptionsLoading(false);
    }
  };

  if (!session?.user?.organizationId && !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          Financial Controls
        </h1>
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Finance controls are only available for organizations.
        </div>
      </div>
    );
  }

  if (!session?.user?.organizationId && isAdmin) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          Financial Controls
        </h1>
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Create or join an organization to use Finance Controls. Actions are scoped to an organization.
        </div>
      </div>
    );
  }

  if (!canAccessFinanceControls) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          Financial Controls
        </h1>
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-4 text-sm text-blue-100 space-y-3">
          <p className="font-medium">Finance Controls is available on Scale and Enterprise plans.</p>
          <p className="text-blue-200/90">
            Period locking, record payments, write-offs, carry forward, and audit log are included with Scale. Upgrade to access.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View plans
          </Link>
        </div>
      </div>
    );
  }

  if (!hasAccess && !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
          Financial Controls
        </h1>
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Your role does not have access. Ask an owner or admin to update your permissions.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-blue-400" />
            Financial Controls
          </h1>
          <p className="text-blue-200/90 text-sm">
            Period locking, adjustments, carry forward, and audit — CFO-grade control without breaking accounting integrity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {success && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 0. Enable/disable features (owner/admin only) */}
      {canChangeSettings && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-300" />
            Feature toggles
          </h2>
          <p className="text-xs text-blue-200/80 mb-4">
            Enable these to use period locking, bulk payments, carry forward, and audit logging. Changes save immediately.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'periodLocking' as const, label: 'Period locking', desc: 'Close and lock periods' },
              { key: 'bulkActions' as const, label: 'Bulk payments & adjustments', desc: 'Bulk mark as paid, write-offs' },
              { key: 'carryForward' as const, label: 'Carry forward', desc: 'Opening balances for next period' },
              { key: 'auditLog' as const, label: 'Audit log', desc: 'Log all finance actions' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-black/20 border border-white/10 px-4 py-3">
                <div>
                  <p className="font-medium text-white text-sm">{label}</p>
                  <p className="text-xs text-blue-200/70">{desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings?.[key] ?? false}
                  disabled={saving}
                  onClick={() => handleToggle(key, !(settings?.[key] ?? false))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                    settings?.[key] ? 'bg-blue-600 border-blue-500' : 'bg-white/10 border-white/20'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      settings?.[key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Accounting periods */}
      {(permissions.canClosePeriod || isOrgOwnerOrAdmin) && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-300" />
            Accounting periods
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={periodForm}
              onChange={(e) => setPeriodForm(e.target.value as 'monthly' | 'quarterly' | 'annual' | 'custom')}
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            >
              <option value="monthly">This month</option>
              <option value="quarterly">This quarter</option>
              <option value="annual">This year</option>
              <option value="custom">Custom range</option>
            </select>
            {periodForm === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                />
              </>
            )}
            <button
              type="button"
              disabled={saving || !settings?.periodLocking}
              onClick={handleCreatePeriod}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create period
            </button>
            {!settings?.periodLocking && (
              <span className="text-xs text-yellow-200">Enable Period locking above to create periods.</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-blue-200/80 border-b border-white/10">
                  <th className="pb-2 pr-4">Period</th>
                  <th className="pb-2 pr-4">Start</th>
                  <th className="pb-2 pr-4">End</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Closed</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-4 text-blue-200/70">
                      No periods yet. Create one after enabling Period locking.
                    </td>
                  </tr>
                )}
                {periods.map((p) => (
                  <tr key={p._id} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white font-medium">{formatPeriodName(p.startDate, p.endDate)}</td>
                    <td className="py-2 pr-4 text-blue-100">{p.startDate.toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-blue-100">{p.endDate.toLocaleDateString()}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          p.status === 'OPEN' ? 'bg-green-500/20 text-green-200' : p.status === 'LOCKED' ? 'bg-red-500/20 text-red-200' : 'bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-blue-100/80 text-xs">
                      {p.closedAtISO ? new Date(p.closedAtISO).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 flex flex-wrap gap-1">
                      {p.status === 'OPEN' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleClosePeriod(p._id)}
                            disabled={saving}
                            className="rounded bg-amber-600/80 px-2 py-1 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            Close
                          </button>
                        </>
                      )}
                      {p.status === 'CLOSED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleLockPeriod(p._id)}
                            disabled={saving}
                            className="rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Lock
                          </button>
                          <button
                            type="button"
                            onClick={() => setReopenPeriodId(p._id)}
                            disabled={saving}
                            className="rounded bg-blue-600/80 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        </>
                      )}
                      {p.status === 'LOCKED' && (
                        <button
                          type="button"
                          onClick={() => setReopenPeriodId(p._id)}
                          disabled={saving}
                          className="rounded bg-blue-600/80 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reopenPeriodId && (
            <div className="mt-4 p-4 rounded-lg bg-black/20 border border-white/10">
              <p className="text-sm text-white mb-2">Reopen period (reason required)</p>
              <input
                type="text"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for reopening"
                className="w-full max-w-md rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReopenPeriod}
                  disabled={saving || !reopenReason.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm reopen
                </button>
                <button
                  type="button"
                  onClick={() => { setReopenPeriodId(null); setReopenReason(''); }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Manual payment entry */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-300" />
          Record payment
        </h2>
        <p className="text-xs text-blue-200/80 mb-4">Add a payment against an invoice. Invoice status updates from the sum of payments.</p>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs font-medium text-blue-200/90">Invoice</label>
              {paymentInvoiceId ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {paymentInvoiceSummary ? `${paymentInvoiceSummary.invoiceNumber} – ${paymentInvoiceSummary.clientName}` : 'Invoice selected'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInvoicePicker(true);
                      if (invoiceOptions.length === 0 && !invoiceOptionsLoading) {
                        void loadInvoiceOptions();
                      }
                    }}
                    className="shrink-0 text-xs font-medium text-blue-300 hover:text-blue-200"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoicePicker(true);
                    if (invoiceOptions.length === 0 && !invoiceOptionsLoading) {
                      void loadInvoiceOptions();
                    }
                  }}
                  className="w-full rounded-lg border border-blue-400/50 bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/30"
                >
                  Pick invoice
                </button>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200/90">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200/90">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-blue-200/90">Payment method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="crypto">Crypto</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="max-w-md">
            <label className="mb-1.5 block text-xs font-medium text-blue-200/90">Reference (optional)</label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Payment reference"
              className="w-full rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            />
          </div>

          <button
            type="button"
            onClick={handlePaymentEntry}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Record payment
          </button>
        </div>
      </section>

      {/* 3. Write-off / adjustment */}
      {(permissions.canWriteOff || isOrgOwnerOrAdmin) && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-300" />
            Write-off or adjustment
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <select
              value={adjustmentEntityType}
              onChange={(e) => setAdjustmentEntityType(e.target.value as 'invoice' | 'payable')}
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            >
              <option value="invoice">Invoice</option>
              <option value="payable">Payable</option>
            </select>
            <input
              type="text"
              value={adjustmentEntityId}
              onChange={(e) => setAdjustmentEntityId(e.target.value)}
              placeholder="Entity ID"
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            />
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as 'WRITE_OFF' | 'CREDIT' | 'CORRECTION')}
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            >
              <option value="WRITE_OFF">Write-off</option>
              <option value="CREDIT">Credit</option>
              <option value="CORRECTION">Correction</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            />
          </div>
          <input
            type="text"
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
            placeholder="Reason (required)"
            className="mt-2 w-full max-w-md rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          />
          <button
            type="button"
            onClick={handleAdjustment}
            disabled={saving}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Post adjustment
          </button>
        </section>
      )}

      {/* 4. Carry forward */}
      {settings?.carryForward && (permissions.canClosePeriod || isOrgOwnerOrAdmin) && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-300" />
            Carry forward
          </h2>
          <p className="text-xs text-blue-200/80 mb-4">Create opening balance entries for the next period from unpaid invoice totals. Ledger stays intact.</p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={carryFromPeriodId}
              onChange={(e) => setCarryFromPeriodId(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            >
              <option value="">Select closed period</option>
              {periods.filter((p) => p.status === 'CLOSED' || p.status === 'LOCKED').map((p) => (
                <option key={p._id} value={p._id}>
                  {formatPeriodName(p.startDate, p.endDate)} ({p.status})
                </option>
              ))}
            </select>
            <input
              type="date"
              value={carryToStart}
              onChange={(e) => setCarryToStart(e.target.value)}
              placeholder="To period start"
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            />
            <input
              type="date"
              value={carryToEnd}
              onChange={(e) => setCarryToEnd(e.target.value)}
              placeholder="To period end"
              className="rounded-lg border border-white/20 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-blue-200/70 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
            />
            <button
              type="button"
              onClick={handleCarryForward}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Run carry forward
            </button>
          </div>
        </section>
      )}

      {/* 5. Financial insights */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-300" />
          Financial insights
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-black/20 border border-white/10 px-4 py-3">
            <p className="text-xs text-blue-200/80">Overdue invoices</p>
            <p className="mt-1 text-xl font-semibold text-white">{insights?.overdueCount ?? (loading ? '—' : 0)}</p>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 px-4 py-3">
            <p className="text-xs text-blue-200/80">Total outstanding</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {insights?.totalOutstanding != null ? insights.totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 2 }) : loading ? '—' : '0'}
            </p>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 px-4 py-3">
            <p className="text-xs text-blue-200/80">Payment velocity (avg days)</p>
            <p className="mt-1 text-xl font-semibold text-white">{insights?.paymentVelocity != null ? Math.round(insights.paymentVelocity) : loading ? '—' : '0'}</p>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 px-4 py-3">
            <p className="text-xs text-blue-200/80">Volume (period)</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {insights?.volumeTrend != null ? insights.volumeTrend.toLocaleString(undefined, { maximumFractionDigits: 2 }) : loading ? '—' : '0'}
            </p>
          </div>
        </div>
        {insights?.arAging && (
          <div className="mt-4">
            <p className="text-xs text-blue-200/80 mb-2">AR aging</p>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div className="rounded bg-black/20 px-3 py-2">
                <span className="text-blue-200/80">Current</span>
                <p className="font-semibold text-white">{insights.arAging.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded bg-black/20 px-3 py-2">
                <span className="text-blue-200/80">1–30 days</span>
                <p className="font-semibold text-white">{insights.arAging.days30.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded bg-black/20 px-3 py-2">
                <span className="text-blue-200/80">31–60 days</span>
                <p className="font-semibold text-white">{insights.arAging.days60.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded bg-black/20 px-3 py-2">
                <span className="text-blue-200/80">90+ days</span>
                <p className="font-semibold text-white">{insights.arAging.days90Plus.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 6. Audit log */}
      {(permissions.canViewAudit || isOrgOwnerOrAdmin) && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-blue-300" />
            Recent audit log
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-blue-200/80 border-b border-white/10">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="py-4 text-blue-200/70">
                      No audit entries yet. Enable Audit log and perform actions to see entries.
                    </td>
                  </tr>
                )}
                {auditEntries.map((e) => (
                  <tr key={e._id} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-blue-100 text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-white">{e.entityType}</td>
                    <td className="py-2 text-blue-100">{e.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showInvoicePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 overflow-hidden">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-slate-950 border border-white/15 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-300" />
                <h3 className="text-sm md:text-base font-semibold text-white">Pick invoice for payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoicePicker(false)}
                className="rounded-full border border-white/20 px-2 py-1 text-xs text-blue-100 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-3 space-y-3 overflow-y-auto">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <span className="text-[11px] text-blue-200/80 mb-1">Issue date from</span>
                  <input
                    type="date"
                    value={invoiceFilterStart}
                    onChange={(e) => setInvoiceFilterStart(e.target.value)}
                    className="rounded-lg border border-white/25 bg-white/5 text-white text-sm md:text-[15px] font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/80"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-blue-200/80 mb-1">Issue date to</span>
                  <input
                    type="date"
                    value={invoiceFilterEnd}
                    onChange={(e) => setInvoiceFilterEnd(e.target.value)}
                    className="rounded-lg border border-white/25 bg-white/5 text-white text-sm md:text-[15px] font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/80"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadInvoiceOptions}
                  disabled={invoiceOptionsLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs md:text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {invoiceOptionsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Apply filter
                </button>
                <span className="text-[11px] text-blue-200/70">
                  Showing unpaid invoices by default. Use filters to narrow by period.
                </span>
              </div>
              {invoiceOptionsError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  {invoiceOptionsError}
                </div>
              )}
              <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-blue-200/80">
                      <th className="px-3 py-2 text-left">Invoice</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Issue date</th>
                      <th className="px-3 py-2 text-left">Due date</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceOptionsLoading && invoiceOptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-blue-200/80">
                          Loading invoices…
                        </td>
                      </tr>
                    )}
                    {!invoiceOptionsLoading && invoiceOptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-blue-200/80">
                          No invoices match this filter.
                        </td>
                      </tr>
                    )}
                    {invoiceOptions.map((inv) => (
                      <tr key={inv._id} className="border-t border-white/5">
                        <td className="px-3 py-2 text-white">
                          <div className="flex flex-col">
                            <span className="font-medium">{inv.invoiceNumber}</span>
                            <span className="text-[11px] text-blue-200/80 truncate max-w-[140px]">
                              ID: {inv._id}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-blue-100">{inv.clientName}</td>
                        <td className="px-3 py-2 text-blue-100/80">
                          {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-blue-100/80">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-blue-100">
                          {inv.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                          <span className="text-blue-300/80">{inv.currency}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-blue-100">
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentInvoiceId(inv._id);
                              setPaymentInvoiceSummary({ invoiceNumber: inv.invoiceNumber, clientName: inv.clientName });
                              setShowInvoicePicker(false);
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Use for payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
