'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Search, UserPlus, Users, Wallet, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type PeriodKey = '30m' | '1h' | '90m' | '2h' | '6h' | '12h' | '24h' | '48h' | 'today' | 'week' | 'month' | 'all';

type WaiterOption = { id: string; name: string; email: string };
type ClaimedTo = { type: 'waiter' | 'external'; waiterUserId?: string; name: string } | null;

type Tx = {
  id: string;
  mpesaReceiptNumber: string;
  phoneNumber: string;
  tableRef: string;
  status: string;
  matchStatus: string;
  amount: number;
  expectedAmount: number | null;
  mpesaAmount: number | null;
  timestamp: string | null;
  claimedTo: ClaimedTo;
  claimedAt: string | null;
  initiatedBy: string | null;
};

type DataPayload = {
  period: PeriodKey;
  filters?: {
    q?: string;
    code?: string;
    phone?: string;
    minAmount?: number | null;
    maxAmount?: number | null;
  };
  totals: {
    totalAmount: number;
    totalTransactions: number;
    claimedCount: number;
    unclaimedCount: number;
  };
  waiterStats: Array<{ name: string; type: 'waiter' | 'external' | 'unclaimed'; count: number; total: number }>;
  waiters: WaiterOption[];
  transactions: Tx[];
  unclaimedTransactions: Tx[];
  promptSummary: {
    total: number;
    count: number;
    success: number;
    failed: number;
    pending: number;
  };
  promptTransactions: Array<{
    id: string;
    waiterName: string;
    phoneNumber: string;
    amount: number;
    status: string;
    receipt: string;
    tableRef: string;
    timestamp: string | null;
  }>;
  waiterPromptSummary?: {
    totalBalance: number;
    totalTransactions: number;
    failedTransactions: number;
    claimedByWaiters: number;
    adminInitiated: number;
  };
};

type PullMeta = {
  fetched: number;
  updatedSessions: number;
  createdRecon: number;
  at: string;
  range?: { start?: string; end?: string };
};

type ClaimRowState = {
  waiterUserId: string;
  externalName: string;
  mode: 'waiter' | 'external';
  saving: boolean;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: '30m', label: 'Last 30m' },
  { key: '1h', label: 'Last 1h' },
  { key: '90m', label: 'Last 1h 30m' },
  { key: '2h', label: 'Last 2h' },
  { key: '6h', label: 'Last 6h' },
  { key: '12h', label: 'Last 12h' },
  { key: '24h', label: 'Last 24h' },
  { key: '48h', label: 'Last 48h' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function fmtDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function SimpleReconciliationPage() {
  const TRANSACTIONS_PER_PAGE = 8;
  const [period, setPeriod] = useState<PeriodKey>('30m');
  const [search, setSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [data, setData] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<Record<string, ClaimRowState>>({});
  const [pullMeta, setPullMeta] = useState<PullMeta | null>(null);
  const [txPage, setTxPage] = useState(1);

  const loadData = useCallback(async (opts?: { triggerFetch?: boolean }) => {
    setError(null);
    if (opts?.triggerFetch) setFetching(true);
    else setLoading(true);
    try {
      const res = opts?.triggerFetch
        ? await fetch('/api/mpesa/reconciliation/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              period,
              q: search,
              code: codeFilter,
              phone: phoneFilter,
              minAmount: minAmountFilter || undefined,
              maxAmount: maxAmountFilter || undefined,
            }),
          })
        : await fetch(
            `/api/mpesa/reconciliation/transactions?period=${period}` +
              `&q=${encodeURIComponent(search)}` +
              `&code=${encodeURIComponent(codeFilter)}` +
              `&phone=${encodeURIComponent(phoneFilter)}` +
              `&minAmount=${encodeURIComponent(minAmountFilter)}` +
              `&maxAmount=${encodeURIComponent(maxAmountFilter)}`
          );
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load reconciliation data');
      setData(json.data as DataPayload);
      if (opts?.triggerFetch && json?.pullResult) {
        const pr = json.pullResult as {
          fetched?: number;
          updatedSessions?: number;
          createdRecon?: number;
          range?: { start?: string; end?: string };
        };
        setPullMeta({
          fetched: Number(pr.fetched ?? 0),
          updatedSessions: Number(pr.updatedSessions ?? 0),
          createdRecon: Number(pr.createdRecon ?? 0),
          at: new Date().toISOString(),
          range: pr.range,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [period, search, codeFilter, phoneFilter, minAmountFilter, maxAmountFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setRowState = (txId: string, patch: Partial<ClaimRowState>) => {
    setClaimState((prev) => ({
      ...prev,
      [txId]: {
        waiterUserId: prev[txId]?.waiterUserId ?? '',
        externalName: prev[txId]?.externalName ?? '',
        mode: prev[txId]?.mode ?? 'waiter',
        saving: prev[txId]?.saving ?? false,
        ...patch,
      },
    }));
  };

  const claimToWaiter = async (txId: string) => {
    const state = claimState[txId];
    if (!state?.waiterUserId) return;
    setRowState(txId, { saving: true });
    try {
      const res = await fetch('/api/mpesa/reconciliation/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, waiterUserId: state.waiterUserId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to claim');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim');
    } finally {
      setRowState(txId, { saving: false });
    }
  };

  const claimToExternal = async (txId: string) => {
    const state = claimState[txId];
    if (!state?.externalName?.trim()) return;
    setRowState(txId, { saving: true });
    try {
      const res = await fetch('/api/mpesa/reconciliation/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, externalWaiterName: state.externalName.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to claim');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim');
    } finally {
      setRowState(txId, { saving: false });
    }
  };

  const isBusy = loading || fetching;
  const txs = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const totalTxPages = Math.max(1, Math.ceil(txs.length / TRANSACTIONS_PER_PAGE));
  const pagedTxs = useMemo(() => {
    const start = (txPage - 1) * TRANSACTIONS_PER_PAGE;
    return txs.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [txPage, txs]);

  useEffect(() => {
    setTxPage(1);
  }, [period, search, codeFilter, phoneFilter, minAmountFilter, maxAmountFilter, txs.length]);

  useEffect(() => {
    if (txPage > totalTxPages) setTxPage(totalTxPages);
  }, [txPage, totalTxPages]);

  const totals = useMemo(
    () =>
      data?.totals ?? {
        totalAmount: 0,
        totalTransactions: 0,
        claimedCount: 0,
        unclaimedCount: 0,
      },
    [data]
  );
  const controlBaseClass =
    'h-10 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white';

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-5">
        <Link href="/dashboard/services/mpesa" className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-xs font-medium mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to M-Pesa
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Reconciliation</h1>
            <p className="text-blue-200 text-xs">Fetch transactions, review totals, and attach unclaimed payments.</p>
          </div>
          <div className="flex flex-1 flex-col sm:flex-row gap-2 lg:justify-end">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              className={`${controlBaseClass} min-w-[150px]`}
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key} className="text-black">
                  {p.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-200" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipt, phone, waiter..."
                className={`${controlBaseClass} w-full sm:w-72 pl-9`}
              />
            </div>
            <button
              onClick={() => void loadData()}
              disabled={isBusy}
              className="h-10 px-3 rounded-lg border border-white/20 text-blue-100 hover:text-white hover:bg-white/10 text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              onClick={() => void loadData({ triggerFetch: true })}
              disabled={isBusy}
              className="h-10 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-900/30 border border-blue-300/20"
            >
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Fetch
            </button>
          </div>
        </div>
        <p className="text-[11px] text-blue-200/90 mt-2">
          Source of truth: Safaricom Pull API transactions (not local prompt records). Fetched data is then mapped into reconciliation.
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            placeholder="Filter by transaction code"
            className={`${controlBaseClass} w-full`}
          />
          <input
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            placeholder="Filter by phone"
            className={`${controlBaseClass} w-full`}
          />
          <input
            value={minAmountFilter}
            onChange={(e) => setMinAmountFilter(e.target.value)}
            placeholder="Min amount"
            inputMode="decimal"
            className={`${controlBaseClass} w-full`}
          />
          <input
            value={maxAmountFilter}
            onChange={(e) => setMaxAmountFilter(e.target.value)}
            placeholder="Max amount"
            inputMode="decimal"
            className={`${controlBaseClass} w-full`}
          />
          <button
            onClick={() => {
              setCodeFilter('');
              setPhoneFilter('');
              setMinAmountFilter('');
              setMaxAmountFilter('');
              void loadData();
            }}
            className="h-10 px-3 rounded-lg border border-white/20 text-blue-100 hover:text-white hover:bg-white/10 text-sm inline-flex items-center justify-center"
          >
            Clear filters
          </button>
        </div>
        {pullMeta && (
          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 flex flex-wrap gap-x-4 gap-y-1">
            <span>Fetched: <strong>{pullMeta.fetched}</strong></span>
            <span>Matched STK updates: <strong>{pullMeta.updatedSessions}</strong></span>
            <span>New recon rows: <strong>{pullMeta.createdRecon}</strong></span>
            <span>Fetched at: <strong>{fmtDate(pullMeta.at)}</strong></span>
          </div>
        )}
        {error && <p className="text-red-300 text-xs mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Amount" value={`KES ${totals.totalAmount.toLocaleString()}`} />
        <StatCard label="Transactions" value={String(totals.totalTransactions)} />
        <StatCard label="Claimed" value={String(totals.claimedCount)} />
        <StatCard label="Unclaimed" value={String(totals.unclaimedCount)} />
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Unclaimed Till Payments</h2>
        {!data?.unclaimedTransactions?.length ? (
          <p className="text-sm text-blue-200">No unclaimed till payments in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-3 text-left font-medium">Date</th>
                  <th className="py-2 px-3 text-left font-medium">Receipt</th>
                  <th className="py-2 px-3 text-left font-medium">Phone</th>
                  <th className="py-2 px-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.unclaimedTransactions.slice(0, 120).map((tx) => (
                  <tr key={`unclaimed-${tx.id}`} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 text-blue-200">{fmtDate(tx.timestamp)}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-100">{tx.mpesaReceiptNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-blue-200">{tx.phoneNumber}</td>
                    <td className="py-2.5 px-3 text-right text-white font-medium">{tx.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Waiter Prompt Metrics</h2>
          <span className="text-xs text-blue-200">Waiter-initiated prompt performance</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <MiniStat
            label="Total Waiter Prompts Balance"
            value={`KES ${(data?.waiterPromptSummary?.totalBalance ?? 0).toLocaleString()}`}
          />
          <MiniStat
            label="Total Transactions From Waiters"
            value={String(data?.waiterPromptSummary?.totalTransactions ?? 0)}
          />
          <MiniStat
            label="Failed Transactions"
            value={String(data?.waiterPromptSummary?.failedTransactions ?? 0)}
          />
          <MiniStat
            label="Claimed By Waiters"
            value={String(data?.waiterPromptSummary?.claimedByWaiters ?? 0)}
          />
          <MiniStat
            label="Admin Initiated Prompts"
            value={String(data?.waiterPromptSummary?.adminInitiated ?? 0)}
          />
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-semibold text-white">Waiter Stats</h2>
        </div>
        {data?.waiterStats?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-blue-200 border-b border-white/10">
                  <th className="py-2 pr-4 text-left font-medium">Assignee</th>
                  <th className="py-2 px-4 text-right font-medium">Count</th>
                  <th className="py-2 px-4 text-right font-medium">Total (KES)</th>
                </tr>
              </thead>
              <tbody>
                {data.waiterStats.map((w) => (
                  <tr key={`${w.type}-${w.name}`} className="border-b border-white/5">
                    <td className="py-2.5 pr-4 text-blue-100">{w.name}</td>
                    <td className="py-2.5 px-4 text-right text-blue-200">{w.count}</td>
                    <td className="py-2.5 px-4 text-right text-white font-medium">{w.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-blue-200">No data yet. Fetch transactions first.</p>
        )}
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Transactions</h2>
        {!txs.length ? (
          <p className="text-sm text-blue-200">No transactions for the selected period.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-blue-200 border-b border-white/10">
                    <th className="py-2 pr-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Receipt</th>
                    <th className="py-2 px-3 text-left font-medium">Phone</th>
                    <th className="py-2 px-3 text-right font-medium">Amount</th>
                    <th className="py-2 px-3 text-left font-medium">Claim</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTxs.map((tx) => {
                    const state = claimState[tx.id] ?? { waiterUserId: '', externalName: '', mode: 'waiter' as const, saving: false };
                    return (
                      <tr key={tx.id} className="border-b border-white/5 align-top">
                        <td className="py-2.5 pr-3 text-blue-200 whitespace-nowrap">{fmtDate(tx.timestamp)}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-100">{tx.mpesaReceiptNumber || '—'}</td>
                        <td className="py-2.5 px-3 text-blue-200">{tx.phoneNumber}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-white">{tx.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 min-w-[300px]">
                          {tx.claimedTo ? (
                            <div className="text-blue-100">
                              <div className="font-medium">Claimed to {tx.claimedTo.name}</div>
                              <div className="text-[10px] text-blue-300">
                                by {tx.initiatedBy ?? 'Unknown'} {tx.claimedAt ? `on ${fmtDate(tx.claimedAt)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRowState(tx.id, { mode: 'waiter' })}
                                  className={`px-2 py-1 rounded text-[10px] border ${state.mode === 'waiter' ? 'bg-blue-500/20 border-blue-400 text-blue-100' : 'bg-white/5 border-white/10 text-blue-300'}`}
                                >
                                  App Waiter
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRowState(tx.id, { mode: 'external' })}
                                  className={`px-2 py-1 rounded text-[10px] border ${state.mode === 'external' ? 'bg-blue-500/20 border-blue-400 text-blue-100' : 'bg-white/5 border-white/10 text-blue-300'}`}
                                >
                                  External
                                </button>
                              </div>
                              {state.mode === 'waiter' ? (
                                <div className="flex gap-2">
                                  <select
                                    value={state.waiterUserId}
                                    onChange={(e) => setRowState(tx.id, { waiterUserId: e.target.value })}
                                    className="flex-1 px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-[11px]"
                                  >
                                    <option value="" className="text-black">Select waiter</option>
                                    {(data?.waiters ?? []).map((w) => (
                                      <option value={w.id} key={w.id} className="text-black">
                                        {w.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => void claimToWaiter(tx.id)}
                                    disabled={!state.waiterUserId || state.saving}
                                    className="px-2 py-1.5 rounded bg-blue-600 text-white text-[11px] disabled:opacity-50 inline-flex items-center gap-1"
                                  >
                                    {state.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                    Attach
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <input
                                    value={state.externalName}
                                    onChange={(e) => setRowState(tx.id, { externalName: e.target.value })}
                                    placeholder="External waiter name"
                                    className="flex-1 px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-[11px]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void claimToExternal(tx.id)}
                                    disabled={!state.externalName.trim() || state.saving}
                                    className="px-2 py-1.5 rounded bg-blue-600 text-white text-[11px] disabled:opacity-50 inline-flex items-center gap-1"
                                  >
                                    {state.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                    Attach
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {txs.length > TRANSACTIONS_PER_PAGE && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-blue-200">
                  Page {txPage} of {totalTxPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                    disabled={txPage === 1}
                    className="px-3 py-1.5 rounded border border-white/20 text-blue-100 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                    disabled={txPage === totalTxPages}
                    className="px-3 py-1.5 rounded border border-white/20 text-blue-100 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
      <p className="text-xs text-blue-200">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
      <p className="text-[10px] text-blue-300">{label}</p>
      <p className="text-sm text-white font-semibold">{value}</p>
    </div>
  );
}
