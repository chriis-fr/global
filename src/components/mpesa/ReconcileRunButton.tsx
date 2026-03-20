'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  lastRunAt?: string | null;
}

export function ReconcileRunButton({ lastRunAt }: Props) {
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState<string | null>(null);
  const [isError, setIsError]   = useState(false);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  async function run() {
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const res  = await fetch('/api/mpesa/reconcile', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Unknown error');
      const r = data.result;
      setMessage(
        `Done in ${r.durationMs}ms · ${r.processed} sessions · ${r.created} created · ${r.updated} updated`
      );
      // Reload to reflect latest data
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Running…' : 'Run Reconciliation'}
      </button>
      {lastRunAt && !message && (
        <p className="text-blue-300 text-[11px]">Last run: {timeAgo(lastRunAt)}</p>
      )}
      {message && (
        <p className={`text-[11px] ${isError ? 'text-red-300' : 'text-emerald-300'}`}>{message}</p>
      )}
    </div>
  );
}
