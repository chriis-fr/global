'use client';

import { useState, useTransition, useEffect } from 'react';
import { sendWaiterStkPush } from '@/app/actions/mpesa-stk';

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

  useEffect(() => {
    if (!errorMessage && !statusMessage) return;
    const id = setTimeout(() => {
      setErrorMessage(null);
      setStatusMessage(null);
    }, MESSAGE_DISMISS_MS);
    return () => clearTimeout(id);
  }, [errorMessage, statusMessage]);

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
        return;
      }

      setStatusMessage(result.message || 'STK push sent.');
      setPhone('');
      setAmount('');
      setTableRef('');
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
          {isPending ? 'Sending...' : 'Send prompt'}
        </button>
      </form>
    </div>
  );
}

