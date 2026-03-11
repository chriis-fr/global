'use client';

import { useState, useTransition, useEffect } from 'react';
import { sendWaiterStkPush } from '@/app/actions/mpesa-stk';
import {
  getWaiterRecentPrompts,
  type WaiterPromptSummary,
} from '@/app/actions/mpesa-waiter-stats';

const MESSAGE_DISMISS_MS = 5000;

function normalizeKenyanPhone(input: string): string | null {
  const raw = input.replace(/[^\d+]/g, '');

  // Strip leading "+" if present
  const trimmed = raw.startsWith('+') ? raw.slice(1) : raw;

  // Cases:
  // 1. 07XXXXXXXXX -> 2547XXXXXXXX
  if (/^07\d{8}$/.test(trimmed)) {
    return `254${trimmed.slice(1)}`;
  }

  // 2. 2547XXXXXXXX -> already correct
  if (/^2547\d{8}$/.test(trimmed)) {
    return trimmed;
  }

  // 3. +2547XXXXXXXX (after strip +) handled by (2)

  return null;
}

export function WaiterPromptCard() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [tableRef, setTableRef] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recentPrompts, setRecentPrompts] = useState<WaiterPromptSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    if (!errorMessage && !statusMessage) return;
    const id = setTimeout(() => {
      setErrorMessage(null);
      setStatusMessage(null);
    }, MESSAGE_DISMISS_MS);
    return () => clearTimeout(id);
  }, [errorMessage, statusMessage]);

  const refreshRecentPrompts = async () => {
    try {
      setLoadingRecent(true);
      const res = await getWaiterRecentPrompts(5);
      if (res.success && res.data) {
        setRecentPrompts(res.data);
      }
    } catch {
      // ignore; UI will just not update
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    void refreshRecentPrompts();
  }, []);

  // Poll in the background while there are pending prompts,
  // so the UI picks up callback updates without manual refresh.
  useEffect(() => {
    const hasPending = recentPrompts.some((p) => p.status === 'pending');
    if (!hasPending) return;

    const id = setInterval(() => {
      void refreshRecentPrompts();
    }, 8000);

    return () => clearInterval(id);
  }, [recentPrompts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }

    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) {
      setErrorMessage(
        'Enter a valid Kenyan mobile number, e.g. 0705..., 254705..., or +254705...'
      );
      return;
    }

    startTransition(async () => {
      const result = await sendWaiterStkPush({
        phoneNumber: normalizedPhone,
        amount: numericAmount,
        tableRef: tableRef || undefined,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to send M-Pesa STK prompt.');
        void refreshRecentPrompts();
        return;
      }

      setStatusMessage(result.message || 'STK push sent.');
      setPhone('');
      setAmount('');
      setTableRef('');
      void refreshRecentPrompts();
    });
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Prompt Customer via M-pesa</h2>
      <form onSubmit={handleSubmit} className="space-y-4 mb-4">
        <div>
          <label className="block text-sm text-blue-200 mb-1">
            Customer Phone Number
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-blue-200 mb-1">Amount (KES)</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-blue-200 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={tableRef}
            onChange={(e) => setTableRef(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Table 5"
          />
        </div>
        {statusMessage && (
          <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-700/60 rounded-lg px-3 py-2">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-700/60 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-white transition-colors"
        >
          {isPending ? 'Sending...' : 'Send STK Push'}
        </button>
      </form>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-blue-100">Recent prompts</p>
          {loadingRecent && (
            <span className="text-xs text-blue-300">Updating…</span>
          )}
        </div>
        {recentPrompts.length === 0 ? (
          <p className="text-xs text-blue-200">
            Your recent M-Pesa activity will appear here after you send prompts.
          </p>
        ) : (
          <ul className="space-y-2 text-xs text-blue-100 max-h-40 overflow-y-auto">
            {recentPrompts.map((p) => {
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
                  <span className={`text-[11px] font-semibold ${statusColor}`}>
                    {statusLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

