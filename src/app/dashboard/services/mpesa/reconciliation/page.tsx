import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { OrganizationService } from '@/lib/services/organizationService';
import { getReconSummary } from '@/lib/services/reconEngine';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Receipt,
  Calendar,
  Table2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  BadgeAlert,
  GitMerge,
} from 'lucide-react';
import { ReconciliationFilters } from '@/components/mpesa/ReconciliationFilters';
import { ReconcileRunButton } from '@/components/mpesa/ReconcileRunButton';
import type { ReconTransaction, MatchStatus } from '@/models/ReconTransaction';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionDoc {
  _id: ObjectId;
  waiterUserId?: ObjectId;
  phoneNumber?: string;
  amount?: number;
  confirmedAmount?: number;
  status?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  tableRef?: string;
  createdAt?: Date;
}

interface WaiterUser {
  _id: ObjectId;
  name?: string;
  email?: string;
}

interface WaiterRow {
  id: string;
  name: string;
  email: string;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  avgAmount: number;
}

interface TableRow {
  ref: string;
  totalAmount: number;
  count: number;
  avgAmount: number;
  waiters: Set<string>;
}

interface TxRow {
  id: string;
  waiterName: string;
  waiterEmail: string;
  phoneNumber: string;
  amount: number;
  confirmedAmount?: number;
  status: string;
  matchStatus: MatchStatus | null;
  mpesaReceiptNumber: string;
  tableRef: string;
  date: Date | null;
  matchNote?: string;
}

interface ExceptionRow {
  id: string;
  matchStatus: MatchStatus;
  waiterName: string;
  phoneNumber: string;
  amount: number;
  mpesaAmount?: number;
  mpesaReceiptNumber?: string;
  tableRef?: string;
  date: Date | null;
  matchNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day + (day === 0 ? -6 : 1));
  x.setHours(0,0,0,0);
  return x;
}
function startOfMonth(d: Date): Date { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtPhone(p: string): string {
  return p.startsWith('+') ? p : `+${p}`;
}

function matchStatusBadge(status: MatchStatus | null) {
  if (!status) return null;
  const cfg: Record<MatchStatus, { label: string; cls: string }> = {
    matched:          { label: 'Matched',          cls: 'text-emerald-300 bg-emerald-500/10' },
    amount_mismatch:  { label: 'Amount Mismatch',  cls: 'text-orange-300 bg-orange-500/10' },
    missing_external: { label: 'No Callback',      cls: 'text-yellow-300 bg-yellow-500/10' },
    missing_internal: { label: 'No STK Record',    cls: 'text-purple-300 bg-purple-500/10' },
    duplicate:        { label: 'Duplicate',        cls: 'text-red-300 bg-red-500/10' },
    orphaned:         { label: 'Orphaned',         cls: 'text-rose-300 bg-rose-500/10' },
    failed:           { label: 'Failed',           cls: 'text-red-400 bg-red-500/10' },
    pending:          { label: 'Pending',          cls: 'text-blue-300 bg-blue-500/10' },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: 'text-blue-300' };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ReconSearchParams {
  period?: string;
  page?: string;
  status?: string;
  waiter?: string;
  q?: string;
  exceptions?: string;  // 'all' | 'amount_mismatch' | 'missing_external' | 'duplicate' | 'orphaned'
}

interface Props {
  searchParams?: Promise<ReconSearchParams>;
}

export default async function ReconciliationPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth');

  const organizationId = session.user.organizationId as string | undefined;
  if (!organizationId) redirect('/dashboard');

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org?._id) notFound();

  const mpesaEnabled = org.settings?.mpesa?.enabled === true;
  if (!mpesaEnabled) notFound();

  const member = org.members.find((m) => m.userId.toString() === session.user.id);
  const role = member?.role ?? null;
  const isSuperAdmin = (session.user as { adminTag?: boolean }).adminTag === true;
  if (!isSuperAdmin && role !== 'owner' && role !== 'admin') notFound();

  const sp: ReconSearchParams = searchParams ? await searchParams : {};
  const period        = (sp.period ?? 'today') as 'today' | 'week' | 'month' | 'all';
  const page          = Math.max(1, Number(sp.page ?? '1') || 1);
  const statusFilter  = sp.status || 'all';
  const waiterFilter  = sp.waiter || '';
  const searchQ       = (sp.q ?? '').trim().toLowerCase();
  const exceptionsTab = sp.exceptions || 'all';
  const PAGE_SIZE     = 20;

  // ── Date range ─────────────────────────────────────────────────────────────
  const now = new Date();
  let rangeStart: Date | null = null;
  if (period === 'today') rangeStart = startOfDay(now);
  if (period === 'week')  rangeStart = startOfWeek(now);
  if (period === 'month') rangeStart = startOfMonth(now);

  const periodLabel: Record<string, string> = {
    today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time',
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const db = await connectToDatabase();
  const sessionsCol = db.collection('mpesa_stk_sessions');
  const reconCol    = db.collection<ReconTransaction>('recon_transactions');
  const usersCol    = db.collection('users');

  const orgObjectId = new ObjectId(organizationId);

  const matchFilter: Record<string, unknown> = { organizationId: orgObjectId };
  if (rangeStart) matchFilter.createdAt = { $gte: rangeStart };
  if (waiterFilter && ObjectId.isValid(waiterFilter)) {
    matchFilter.waiterUserId = new ObjectId(waiterFilter);
  }

  const allDocs = (await sessionsCol
    .find(matchFilter)
    .sort({ createdAt: -1 })
    .toArray()) as SessionDoc[];

  // Reconciliation summary (org-wide, not period-filtered — always total picture)
  const reconSummary = await getReconSummary(organizationId);

  // Recon transactions for the current period (to show matchStatus per row)
  const sessionIds = allDocs.map((d) => d._id);
  const reconDocs = sessionIds.length
    ? (await reconCol
        .find({ stkSessionId: { $in: sessionIds } })
        .toArray()) as (ReconTransaction & { _id: ObjectId })[]
    : [];

  // Pulled-only transactions (no STK session) — surfaced as exceptions so missed callbacks are visible.
  const pulledOnlyFilter: Record<string, unknown> = { organizationId: orgObjectId, matchStatus: 'missing_internal' };
  if (rangeStart) pulledOnlyFilter.createdAt = { $gte: rangeStart };
  const pulledOnlyDocs = (await reconCol
    .find(pulledOnlyFilter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as (ReconTransaction & { _id: ObjectId })[];

  const reconByStkId = new Map<string, ReconTransaction>();
  for (const r of reconDocs) {
    if (r.stkSessionId) reconByStkId.set(r.stkSessionId.toString(), r);
  }

  // ── Resolve waiter names ───────────────────────────────────────────────────
  const waiterIds = [...new Set(allDocs.map((d) => d.waiterUserId?.toString()).filter(Boolean))] as string[];
  const waiterDocs = waiterIds.length
    ? (await usersCol
        .find({ _id: { $in: waiterIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, email: 1 })
        .toArray()) as WaiterUser[]
    : [];

  const waiterMap = new Map<string, { name: string; email: string }>();
  for (const w of waiterDocs) {
    waiterMap.set(w._id.toString(), {
      name: (w.name as string) || 'Unknown',
      email: (w.email as string) || '',
    });
  }

  const waiterOptions = [...waiterMap.entries()]
    .map(([id, info]) => ({ id, name: info.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Summary stats ─────────────────────────────────────────────────────────
  const baseDocs    = allDocs;
  const successDocs = baseDocs.filter((d) => d.status === 'success');
  const failedDocs  = baseDocs.filter((d) => d.status === 'failed');
  const pendingDocs = baseDocs.filter((d) => d.status === 'pending');

  const totalCollected = successDocs.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const avgTx = successDocs.length > 0 ? totalCollected / successDocs.length : 0;

  // ── Exceptions from recon_transactions (period-filtered) ──────────────────
  const EXCEPTION_STATUSES: MatchStatus[] = [
    'amount_mismatch', 'missing_external', 'duplicate', 'orphaned', 'missing_internal',
  ];

  const exceptionDocs: ExceptionRow[] = reconDocs
    .filter((r) => EXCEPTION_STATUSES.includes(r.matchStatus))
    .map((r) => {
      const wid  = r.waiterUserId?.toString() ?? '';
      const info = waiterMap.get(wid) ?? { name: 'Unknown', email: '' };
      return {
        id: r._id.toString(),
        matchStatus: r.matchStatus,
        waiterName: info.name,
        phoneNumber: r.phoneNumber ?? '—',
        amount: r.expectedAmount ?? 0,
        mpesaAmount: r.mpesaAmount,
        mpesaReceiptNumber: r.mpesaReceiptNumber,
        tableRef: r.tableRef,
        date: r.initiatedAt ?? null,
        matchNote: r.matchNote,
      };
    });

  // Add pulled-only exceptions (missing_internal) so they show up even without STK sessions.
  for (const r of pulledOnlyDocs) {
    exceptionDocs.push({
      id: r._id.toString(),
      matchStatus: 'missing_internal',
      waiterName: '—',
      phoneNumber: r.phoneNumber ?? '—',
      amount: r.expectedAmount ?? 0,
      mpesaAmount: r.mpesaAmount,
      mpesaReceiptNumber: r.mpesaReceiptNumber,
      tableRef: r.tableRef,
      date: r.mpesaTimestamp ?? r.createdAt ?? null,
      matchNote: r.matchNote ?? 'Pulled transaction with no matching STK session.',
    });
  }

  const filteredExceptions = exceptionsTab === 'all'
    ? exceptionDocs
    : exceptionDocs.filter((e) => e.matchStatus === exceptionsTab);

  const exceptionCountByType = {
    amount_mismatch:  exceptionDocs.filter((e) => e.matchStatus === 'amount_mismatch').length,
    missing_external: exceptionDocs.filter((e) => e.matchStatus === 'missing_external').length,
    missing_internal: exceptionDocs.filter((e) => e.matchStatus === 'missing_internal').length,
    duplicate:        exceptionDocs.filter((e) => e.matchStatus === 'duplicate').length,
    orphaned:         exceptionDocs.filter((e) => e.matchStatus === 'orphaned').length,
  };

  // ── Per-waiter ─────────────────────────────────────────────────────────────
  const waiterRowMap = new Map<string, WaiterRow>();
  for (const doc of baseDocs) {
    const wid  = doc.waiterUserId?.toString() ?? 'unknown';
    const info = waiterMap.get(wid) ?? { name: 'Unknown', email: '' };
    if (!waiterRowMap.has(wid)) {
      waiterRowMap.set(wid, { id: wid, name: info.name, email: info.email,
        totalAmount: 0, successCount: 0, failedCount: 0, pendingCount: 0, avgAmount: 0 });
    }
    const row = waiterRowMap.get(wid)!;
    if (doc.status === 'success')      { row.totalAmount += Number(doc.amount) || 0; row.successCount++; }
    else if (doc.status === 'failed')  { row.failedCount++; }
    else                               { row.pendingCount++; }
  }
  for (const row of waiterRowMap.values()) {
    row.avgAmount = row.successCount > 0 ? row.totalAmount / row.successCount : 0;
  }
  const waiterRows = [...waiterRowMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);

  // ── Per-table ──────────────────────────────────────────────────────────────
  const tableRowMap = new Map<string, TableRow>();
  for (const doc of successDocs) {
    const ref = doc.tableRef?.trim() || '(no reference)';
    if (!tableRowMap.has(ref)) {
      tableRowMap.set(ref, { ref, totalAmount: 0, count: 0, avgAmount: 0, waiters: new Set() });
    }
    const row = tableRowMap.get(ref)!;
    row.totalAmount += Number(doc.amount) || 0;
    row.count++;
    if (doc.waiterUserId) row.waiters.add(doc.waiterUserId.toString());
  }
  for (const row of tableRowMap.values()) row.avgAmount = row.count > 0 ? row.totalAmount / row.count : 0;
  const tableRows = [...tableRowMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);

  // ── Transaction log ────────────────────────────────────────────────────────
  const filteredDocs = allDocs.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (searchQ) {
      const phone  = (doc.phoneNumber ?? '').toLowerCase();
      const ref    = (doc.mpesaReceiptNumber ?? '').toLowerCase();
      const tRef   = (doc.tableRef ?? '').toLowerCase();
      if (!phone.includes(searchQ) && !ref.includes(searchQ) && !tRef.includes(searchQ)) return false;
    }
    return true;
  });

  const txAll: TxRow[] = filteredDocs.map((doc) => {
    const wid    = doc.waiterUserId?.toString() ?? '';
    const info   = waiterMap.get(wid) ?? { name: 'Unknown', email: '' };
    const recon  = reconByStkId.get(doc._id.toString());
    return {
      id: doc._id.toString(),
      waiterName: info.name,
      waiterEmail: info.email,
      phoneNumber: doc.phoneNumber ?? '—',
      amount: Number(doc.amount) || 0,
      confirmedAmount: doc.confirmedAmount,
      status: doc.status ?? 'unknown',
      matchStatus: (recon?.matchStatus ?? null) as MatchStatus | null,
      mpesaReceiptNumber: doc.mpesaReceiptNumber ?? '—',
      tableRef: doc.tableRef?.trim() || '—',
      date: doc.transactionDate ?? doc.createdAt ?? null,
      matchNote: recon?.matchNote,
    };
  });

  const totalTxPages = Math.max(1, Math.ceil(txAll.length / PAGE_SIZE));
  const currentPage  = Math.min(page, totalTxPages);
  const txPage       = txAll.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const paginationLink = (p: number) => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (waiterFilter) params.set('waiter', waiterFilter);
    if (searchQ) params.set('q', searchQ);
    if (exceptionsTab !== 'all') params.set('exceptions', exceptionsTab);
    params.set('page', String(p));
    return `/dashboard/services/mpesa/reconciliation?${params.toString()}`;
  };

  const exceptionTabLink = (tab: string) => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (waiterFilter) params.set('waiter', waiterFilter);
    params.set('exceptions', tab);
    return `/dashboard/services/mpesa/reconciliation?${params.toString()}`;
  };

  const periods = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all',   label: 'All Time' },
  ];

  const totalExceptions = exceptionDocs.length;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/services/mpesa"
            className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-xs font-medium mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to M-Pesa
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <BarChart3 className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Reconciliation</h1>
              <p className="text-blue-200 text-xs">
                M-Pesa collections · {periodLabel[period]}
                {waiterFilter && waiterMap.get(waiterFilter) && (
                  <> · {waiterMap.get(waiterFilter)!.name}</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Period tabs */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {periods.map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/services/mpesa/reconciliation?period=${p.key}${waiterFilter ? `&waiter=${waiterFilter}` : ''}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.key
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          {/* Run button */}
          <ReconcileRunButton lastRunAt={reconSummary.lastRunAt?.toISOString() ?? null} />
        </div>
      </div>

      {/* ── Reconciliation Health ───────────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-semibold text-white">Reconciliation Health</h2>
          <span className="text-xs text-blue-300 ml-1">(all-time · org-wide)</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Match rate */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="relative w-16 h-16 mb-2">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke={reconSummary.matchRate >= 90 ? '#34d399' : reconSummary.matchRate >= 70 ? '#fbbf24' : '#f87171'}
                  strokeWidth="3"
                  strokeDasharray={`${(reconSummary.matchRate / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {reconSummary.matchRate}%
              </span>
            </div>
            <p className="text-xs text-blue-200 text-center">Match Rate</p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-emerald-300 text-xs mb-1">
              <CheckCircle className="h-3.5 w-3.5" /> Matched
            </div>
            <p className="text-2xl font-bold text-white">{reconSummary.matched}</p>
            <p className="text-xs text-blue-300 mt-0.5">KES {reconSummary.totalCollected.toLocaleString()}</p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Exceptions
            </div>
            <p className="text-2xl font-bold text-white">{reconSummary.amountMismatch + reconSummary.missingExternal + reconSummary.duplicate + reconSummary.orphaned}</p>
            <p className="text-xs text-blue-300 mt-0.5">requiring attention</p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-orange-300 text-xs mb-1">
              <GitMerge className="h-3.5 w-3.5" /> Discrepancy
            </div>
            <p className="text-2xl font-bold text-white">
              {reconSummary.totalDiscrepancy > 0
                ? `KES ${reconSummary.totalDiscrepancy.toLocaleString()}`
                : '—'}
            </p>
            <p className="text-xs text-blue-300 mt-0.5">amount mismatch delta</p>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-blue-300 text-xs mb-1">
              <Clock className="h-3.5 w-3.5" /> Pending
            </div>
            <p className="text-2xl font-bold text-white">{reconSummary.pending}</p>
            <p className="text-xs text-blue-300 mt-0.5">awaiting callback</p>
          </div>
        </div>

        {/* Breakdown bar */}
        {reconSummary.total > 0 && (
          <div className="mt-4">
            <div className="flex rounded-full overflow-hidden h-2 w-full gap-px">
              {reconSummary.matched > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(reconSummary.matched / reconSummary.total) * 100}%` }}
                  title={`Matched: ${reconSummary.matched}`}
                />
              )}
              {reconSummary.pending > 0 && (
                <div
                  className="bg-blue-500"
                  style={{ width: `${(reconSummary.pending / reconSummary.total) * 100}%` }}
                  title={`Pending: ${reconSummary.pending}`}
                />
              )}
              {reconSummary.failed > 0 && (
                <div
                  className="bg-slate-500"
                  style={{ width: `${(reconSummary.failed / reconSummary.total) * 100}%` }}
                  title={`Failed: ${reconSummary.failed}`}
                />
              )}
              {reconSummary.amountMismatch > 0 && (
                <div
                  className="bg-orange-500"
                  style={{ width: `${(reconSummary.amountMismatch / reconSummary.total) * 100}%` }}
                  title={`Amount Mismatch: ${reconSummary.amountMismatch}`}
                />
              )}
              {reconSummary.missingExternal > 0 && (
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(reconSummary.missingExternal / reconSummary.total) * 100}%` }}
                  title={`No Callback: ${reconSummary.missingExternal}`}
                />
              )}
              {reconSummary.duplicate > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(reconSummary.duplicate / reconSummary.total) * 100}%` }}
                  title={`Duplicate: ${reconSummary.duplicate}`}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-blue-300">
              {reconSummary.matched > 0        && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Matched ({reconSummary.matched})</span>}
              {reconSummary.pending > 0        && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Pending ({reconSummary.pending})</span>}
              {reconSummary.failed > 0         && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Failed ({reconSummary.failed})</span>}
              {reconSummary.amountMismatch > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Amount Mismatch ({reconSummary.amountMismatch})</span>}
              {reconSummary.missingExternal > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> No Callback ({reconSummary.missingExternal})</span>}
              {reconSummary.duplicate > 0      && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Duplicate ({reconSummary.duplicate})</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Exceptions Panel ────────────────────────────────────────────────── */}
      {totalExceptions > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-orange-500/30 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BadgeAlert className="h-5 w-5 text-orange-300" />
            <h2 className="text-sm font-semibold text-white">Exceptions Panel</h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300">
              {totalExceptions}
            </span>
            <span className="text-xs text-blue-300 ml-1">in {periodLabel[period]}</span>
          </div>

          {/* Exception type tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {([
              ['all', `All (${totalExceptions})`, null],
              ['amount_mismatch', `Amount Mismatch (${exceptionCountByType.amount_mismatch})`, 'text-orange-300'],
              ['missing_external', `No Callback (${exceptionCountByType.missing_external})`, 'text-yellow-300'],
              ['missing_internal', `No STK Record (${exceptionCountByType.missing_internal})`, 'text-purple-300'],
              ['duplicate', `Duplicate (${exceptionCountByType.duplicate})`, 'text-red-300'],
              ['orphaned', `Orphaned (${exceptionCountByType.orphaned})`, 'text-rose-300'],
            ] as [string, string, string | null][]).map(([key, label]) => (
              <Link
                key={key}
                href={exceptionTabLink(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  exceptionsTab === key
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-200'
                    : 'bg-white/5 border-white/10 text-blue-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {filteredExceptions.length === 0 ? (
            <p className="text-sm text-blue-200">No exceptions of this type in the current period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-blue-200 border-b border-white/10">
                    <th className="py-2 pr-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-left font-medium">Waiter</th>
                    <th className="py-2 px-3 text-left font-medium">Phone</th>
                    <th className="py-2 px-3 text-right font-medium">Expected</th>
                    <th className="py-2 px-3 text-right font-medium">M-Pesa</th>
                    <th className="py-2 px-3 text-left font-medium">Receipt</th>
                    <th className="py-2 px-3 text-left font-medium">Ref</th>
                    <th className="py-2 pl-3 text-left font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExceptions.map((ex) => (
                    <tr key={ex.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2.5 pr-3">{matchStatusBadge(ex.matchStatus)}</td>
                      <td className="py-2.5 px-3 text-blue-100">{ex.waiterName}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-200">{fmtPhone(ex.phoneNumber)}</td>
                      <td className="py-2.5 px-3 text-right text-white font-medium">
                        {ex.amount > 0 ? ex.amount.toLocaleString() : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        ex.mpesaAmount != null && ex.mpesaAmount !== ex.amount
                          ? 'text-orange-300'
                          : 'text-blue-200'
                      }`}>
                        {ex.mpesaAmount != null ? ex.mpesaAmount.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-300">
                        {ex.mpesaReceiptNumber ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-blue-300">{ex.tableRef ?? '—'}</td>
                      <td className="py-2.5 pl-3 text-blue-400 max-w-[200px] truncate" title={ex.matchNote}>
                        {ex.matchNote ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-xs mb-1">
            <TrendingUp className="h-4 w-4" />
            Total Collected
          </div>
          <p className="text-2xl font-bold text-white">KES {totalCollected.toLocaleString()}</p>
          <p className="text-xs text-blue-300 mt-0.5">{successDocs.length} successful payments</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-xs mb-1">
            <Receipt className="h-4 w-4" />
            Total Prompts
          </div>
          <p className="text-2xl font-bold text-white">{baseDocs.length}</p>
          <p className="text-xs text-blue-300 mt-0.5">
            {failedDocs.length} failed · {pendingDocs.length} pending
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-xs mb-1">
            <BarChart3 className="h-4 w-4" />
            Avg per Payment
          </div>
          <p className="text-2xl font-bold text-white">KES {Math.round(avgTx).toLocaleString()}</p>
          <p className="text-xs text-blue-300 mt-0.5">successful only</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center gap-2 text-blue-200 text-xs mb-1">
            <Users className="h-4 w-4" />
            Active Waiters
          </div>
          <p className="text-2xl font-bold text-white">{waiterRows.filter((w) => w.successCount > 0).length}</p>
          <p className="text-xs text-blue-300 mt-0.5">with successful collections</p>
        </div>
      </div>

      {/* ── Per-waiter breakdown ─────────────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-semibold text-white">Per-Waiter Breakdown</h2>
          {waiterFilter && (
            <Link
              href={`/dashboard/services/mpesa/reconciliation?period=${period}`}
              className="ml-auto text-xs text-blue-300 hover:text-white underline-offset-2 hover:underline"
            >
              Show all waiters
            </Link>
          )}
        </div>

        {waiterRows.length === 0 ? (
          <p className="text-sm text-blue-200">No activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-4 text-left font-medium">Waiter</th>
                  <th className="py-2 px-4 text-right font-medium">Collected (KES)</th>
                  <th className="py-2 px-4 text-right font-medium">Successful</th>
                  <th className="py-2 px-4 text-right font-medium">Failed</th>
                  <th className="py-2 px-4 text-right font-medium">Avg (KES)</th>
                  <th className="py-2 pl-4 text-right font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {waiterRows.map((w) => (
                  <tr
                    key={w.id}
                    className={`border-b border-white/5 ${waiterFilter === w.id ? 'bg-blue-500/10' : ''}`}
                  >
                    <td className="py-2.5 pr-4">
                      <p className="text-blue-100 font-medium">{w.name}</p>
                      {w.email && <p className="text-blue-300 text-xs">{w.email}</p>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-white">
                      {w.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-emerald-300 font-medium">{w.successCount}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={w.failedCount > 0 ? 'text-red-300' : 'text-blue-300'}>
                        {w.failedCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-blue-200">
                      {Math.round(w.avgAmount).toLocaleString()}
                    </td>
                    <td className="py-2.5 pl-4 text-right text-xs space-x-3">
                      <Link
                        href={`/dashboard/services/mpesa/reconciliation?period=${period}&waiter=${w.id}`}
                        className="text-blue-300 hover:text-white underline-offset-2 hover:underline"
                      >
                        Filter
                      </Link>
                      <Link
                        href={`/dashboard/services/mpesa/waiter/${w.id}`}
                        className="text-blue-300 hover:text-white underline-offset-2 hover:underline"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/20">
                  <td className="py-2.5 pr-4 text-white font-semibold text-xs uppercase tracking-wide">Total</td>
                  <td className="py-2.5 px-4 text-right font-bold text-white">{totalCollected.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-emerald-300">{successDocs.length}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-red-300">{failedDocs.length}</td>
                  <td className="py-2.5 px-4" />
                  <td className="py-2.5 pl-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Per-table breakdown ──────────────────────────────────────────────── */}
      {tableRows.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Table2 className="h-5 w-5 text-blue-300" />
            <h2 className="text-sm font-semibold text-white">Per-Table / Reference Breakdown</h2>
            <span className="text-xs text-blue-300">(successful only)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-4 text-left font-medium">Table / Ref</th>
                  <th className="py-2 px-4 text-right font-medium">Collected (KES)</th>
                  <th className="py-2 px-4 text-right font-medium">Payments</th>
                  <th className="py-2 px-4 text-right font-medium">Avg (KES)</th>
                  <th className="py-2 pl-4 text-right font-medium">Waiters</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((t) => (
                  <tr key={t.ref} className="border-b border-white/5">
                    <td className="py-2.5 pr-4 text-blue-100 font-medium">{t.ref}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-white">{t.totalAmount.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-blue-100">{t.count}</td>
                    <td className="py-2.5 px-4 text-right text-blue-200">{Math.round(t.avgAmount).toLocaleString()}</td>
                    <td className="py-2.5 pl-4 text-right text-blue-300">{t.waiters.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transaction log ──────────────────────────────────────────────────── */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-300" />
            <h2 className="text-sm font-semibold text-white">Transaction Log</h2>
            <span className="text-xs text-blue-300">
              {txAll.length} {statusFilter !== 'all' ? statusFilter : ''} transaction{txAll.length !== 1 ? 's' : ''}
              {searchQ && <> matching &ldquo;{searchQ}&rdquo;</>}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {currentPage > 1 && (
              <Link href={paginationLink(currentPage - 1)} className="text-blue-300 hover:text-white underline-offset-2 hover:underline">
                ← Prev
              </Link>
            )}
            {totalTxPages > 1 && (
              <span className="text-blue-300">{currentPage} / {totalTxPages}</span>
            )}
            {currentPage < totalTxPages && (
              <Link href={paginationLink(currentPage + 1)} className="text-blue-300 hover:text-white underline-offset-2 hover:underline">
                Next →
              </Link>
            )}
          </div>
        </div>

        <div className="mb-4">
          <Suspense>
            <ReconciliationFilters
              waiters={waiterOptions}
              currentStatus={statusFilter}
              currentWaiter={waiterFilter}
              currentQ={searchQ}
              currentPeriod={period}
            />
          </Suspense>
        </div>

        {txPage.length === 0 ? (
          <p className="text-sm text-blue-200">
            {searchQ || statusFilter !== 'all'
              ? 'No transactions match the current filters.'
              : 'No transactions in this period.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-3 text-left font-medium">Date & Time</th>
                  <th className="py-2 px-3 text-left font-medium">Waiter</th>
                  <th className="py-2 px-3 text-left font-medium">Table / Ref</th>
                  <th className="py-2 px-3 text-left font-medium">Phone</th>
                  <th className="py-2 px-3 text-right font-medium">Expected</th>
                  <th className="py-2 px-3 text-right font-medium">Confirmed</th>
                  <th className="py-2 px-3 text-left font-medium">STK Status</th>
                  <th className="py-2 px-3 text-left font-medium">Recon</th>
                  <th className="py-2 pl-3 text-left font-medium">Tx Ref</th>
                </tr>
              </thead>
              <tbody>
                {txPage.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-2.5 pr-3 text-blue-200 whitespace-nowrap">{fmtDate(tx.date)}</td>
                    <td className="py-2.5 px-3">
                      <p className="text-blue-100 font-medium">{tx.waiterName}</p>
                    </td>
                    <td className="py-2.5 px-3 text-blue-200">{tx.tableRef}</td>
                    <td className="py-2.5 px-3 text-blue-200 font-mono">{fmtPhone(tx.phoneNumber)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-white">{tx.amount.toLocaleString()}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${
                      tx.confirmedAmount != null && tx.confirmedAmount !== tx.amount
                        ? 'text-orange-300'
                        : 'text-blue-200'
                    }`}>
                      {tx.confirmedAmount != null ? tx.confirmedAmount.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : tx.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3" title={tx.matchNote ?? undefined}>
                      {matchStatusBadge(tx.matchStatus)}
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-blue-300 group-hover:text-white transition-colors">
                      {tx.mpesaReceiptNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalTxPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs">
            {currentPage > 1 && (
              <Link href={paginationLink(currentPage - 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-300 hover:text-white hover:bg-white/10 transition-colors">
                ← Prev
              </Link>
            )}
            <span className="text-blue-300 px-2">Page {currentPage} of {totalTxPages}</span>
            {currentPage < totalTxPages && (
              <Link href={paginationLink(currentPage + 1)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-300 hover:text-white hover:bg-white/10 transition-colors">
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
