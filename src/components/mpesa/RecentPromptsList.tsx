'use client';

import { useState, useEffect } from 'react';
import { getWaiterRecentPrompts, type WaiterPromptSummary } from '@/app/actions/mpesa-waiter-stats';
import { Receipt } from 'lucide-react';

const LIMIT = 10;
const POLL_INTERVAL_MS = 8000;

/** Recent prompts for the logged-in user (same as below STK push). */
export function RecentPromptsList() {
  const [prompts, setPrompts] = useState<WaiterPromptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getWaiterRecentPrompts(LIMIT);
      if (res.success && res.data) setPrompts(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const hasPending = prompts.some((p) => p.status === 'pending');
    if (!hasPending) return;
    const id = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [prompts]);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-300" />
          <h2 className="text-sm font-semibold text-white">Recent prompts</h2>
        </div>
        {loading && (
          <span className="text-xs text-blue-300">Updating…</span>
        )}
      </div>
      {prompts.length === 0 ? (
        <p className="text-sm text-blue-200">
          Your recent M-Pesa activity will appear here after you send prompts.
        </p>
      ) : (
        <ul className="space-y-2 text-xs text-blue-100 max-h-64 overflow-y-auto">
          {prompts.map((p) => {
            let statusLabel = 'Pending';
            let statusColor = 'text-amber-300';
            if (p.status === 'success') {
              statusLabel = 'Success';
              statusColor = 'text-emerald-300';
            } else if (p.status === 'failed') {
              statusLabel = 'Failed';
              statusColor = 'text-red-300';
            }

            const description =
              p.resultDescription ||
              (p.status === 'success'
                ? 'Payment completed.'
                : p.status === 'failed'
                ? 'Payment failed or cancelled.'
                : 'Awaiting response…');

            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 border border-white/10 rounded-lg px-2 py-1.5 bg-slate-900/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    KES {p.amount.toLocaleString()} • {p.phoneNumber}
                  </p>
                  {p.tableRef && (
                    <p className="text-[11px] text-blue-300 truncate">
                      Table: {p.tableRef}
                    </p>
                  )}
                  <p className="text-[11px] text-blue-300 truncate">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-blue-200 truncate">
                    {description}
                  </p>
                  {p.mpesaReceiptNumber && (
                    <p className="text-[11px] text-emerald-300 truncate">
                      Receipt: {p.mpesaReceiptNumber}
                    </p>
                  )}
                </div>
                <span className={`text-[11px] font-semibold flex-shrink-0 ${statusColor}`}>
                  {statusLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
