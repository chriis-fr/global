'use client';

import { useState, useTransition, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { sendWaiterStkPush } from '@/app/actions/mpesa-stk';

const MESSAGE_DISMISS_MS = 5000;

/**
 * Set to true once the C2B Confirmation URL has been registered with Safaricom
 * (via POST /api/mpesa/c2b-register). Until then, customer name is never fetched
 * and the success modal shows only the STK callback data (transaction ref, amount, phone).
 */
const C2B_ENABLED = false;

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
  const [successDetails, setSuccessDetails] = useState<{
    amount: number;
    phoneNumber: string;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    customerName?: string;
  } | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAwaitingCallback, setIsAwaitingCallback] = useState(false);
  // Tracks the specific session ID returned when a prompt is sent.
  // Polling uses this ID so feedback always maps to the exact prompt this component initiated.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!errorMessage && !statusMessage) return;
    const id = setTimeout(() => {
      setErrorMessage(null);
      setStatusMessage(null);
    }, MESSAGE_DISMISS_MS);
    return () => clearTimeout(id);
  }, [errorMessage, statusMessage]);

  // Poll the specific session this component initiated — not "whatever is latest".
  // This prevents feedback from going to the wrong prompt when multiple waiters
  // (or the same waiter in multiple tabs/devices) are active simultaneously.
  useEffect(() => {
    if (!isAwaitingCallback || !pendingSessionId) return;

    let cancelled = false;
    const start = Date.now();

    const poll = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - start;
      // Keep waiting for up to ~90s to match M-Pesa behaviour
      if (elapsed > 90000) {
        setIsAwaitingCallback(false);
        setPendingSessionId(null);
        setStatusMessage(
          'We have not received a response from M-Pesa yet. Check the recent prompts list below for any update; if nothing appears after a short while, you can try again.'
        );
        return;
      }

      try {
        const res = await fetch(`/api/mpesa/prompt-status/${pendingSessionId}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          success: boolean;
          prompt?: {
            status: 'pending' | 'success' | 'failed';
            resultCode?: string;
            resultDescription?: string;
            amount: number;
            phoneNumber: string;
            mpesaReceiptNumber?: string;
            transactionDate?: string;
            customerName?: string | null;
            nameReady?: boolean;
          };
        };
        if (!data.success || !data.prompt) {
          setTimeout(poll, 3000);
          return;
        }

        const p = data.prompt;
        if (p.status === 'pending') {
          setTimeout(poll, 3000);
          return;
        }

        // Payment failed — stop immediately
        if (p.status !== 'success') {
          setIsAwaitingCallback(false);
          setPendingSessionId(null);
          if (p.resultCode === '1032' && p.resultDescription?.includes('Request Cancelled by user')) {
            setStatusMessage('The request was cancelled by the customer.');
          } else {
            setStatusMessage('The request failed. Ask the customer to try again.');
          }
          return;
        }

        const finishSuccess = (
          amount: number,
          phoneNumber: string,
          receipt?: string,
          transactionDate?: string,
          customerName?: string,
        ) => {
          setIsAwaitingCallback(false);
          setPendingSessionId(null);
          setStatusMessage('Payment successful.');
          setSuccessDetails({ amount, phoneNumber, mpesaReceiptNumber: receipt, transactionDate, customerName });
          setIsSuccessModalOpen(true);
          setTimeout(() => {
            setIsSuccessModalOpen(false);
            setSuccessDetails(null);
            setStatusMessage(null);
          }, 60000);
        };

        // C2B_ENABLED: when true, we briefly poll for the customer name that arrives via
        // Safaricom's C2B Confirmation callback (a few seconds after the STK callback).
        // Until C2B URLs are registered with Safaricom, skip this and show success immediately.
        if (!C2B_ENABLED) {
          finishSuccess(p.amount, p.phoneNumber, p.mpesaReceiptNumber, p.transactionDate, undefined);
          return;
        }

        // C2B is active — wait up to 8 s for the name then show modal either way.
        const successAt = Date.now();
        const NAME_WAIT_MS = 8000;

        const pollForName = async () => {
          if (cancelled) return;
          if (p.nameReady) {
            finishSuccess(p.amount, p.phoneNumber, p.mpesaReceiptNumber, p.transactionDate, p.customerName ?? undefined);
            return;
          }
          if (Date.now() - successAt >= NAME_WAIT_MS) {
            finishSuccess(p.amount, p.phoneNumber, p.mpesaReceiptNumber, p.transactionDate, undefined);
            return;
          }
          try {
            const r2 = await fetch(`/api/mpesa/prompt-status/${pendingSessionId}`, { cache: 'no-store' });
            const d2 = (await r2.json()) as typeof data;
            if (d2.success && d2.prompt?.nameReady) {
              finishSuccess(d2.prompt.amount, d2.prompt.phoneNumber, d2.prompt.mpesaReceiptNumber, d2.prompt.transactionDate, d2.prompt.customerName ?? undefined);
            } else {
              setTimeout(pollForName, 1500);
            }
          } catch {
            setTimeout(pollForName, 1500);
          }
        };

        pollForName();
      } catch {
        setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [isAwaitingCallback, pendingSessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setIsAwaitingCallback(false);
    setPendingSessionId(null);

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
        setIsAwaitingCallback(false);
        setPendingSessionId(null);
        return;
      }

      setStatusMessage(
        result.message ||
          'STK push sent. Waiting for M-Pesa response on the customer phone...'
      );
      setPendingSessionId(result.sessionId ?? null);
      setIsAwaitingCallback(true);
      setPhone('');
      setAmount('');
      setTableRef('');
    });
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Prompt via M-pesa</h2>
        {session?.user?.id && (
          <Link
            href={`/dashboard/services/mpesa/waiter/${session.user.id}`}
            className="text-xs font-medium text-blue-300 hover:text-white underline-offset-2 hover:underline"
          >
            View all
          </Link>
        )}
      </div>
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
            disabled={isPending || isAwaitingCallback}
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
            disabled={isPending || isAwaitingCallback}
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
            disabled={isPending || isAwaitingCallback}
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
          disabled={isPending || isAwaitingCallback}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-white transition-colors"
        >
          {isPending
            ? 'Sending...'
            : isAwaitingCallback
            ? 'Waiting for response...'
            : 'Send prompt'}
        </button>
      </form>
      {isAwaitingCallback && (
        <div className="mt-2 text-xs text-blue-200">
          Pending M-Pesa response. Ask the customer to check their phone and enter their PIN.
        </div>
      )}
      {isSuccessModalOpen && successDetails && (() => {
        // Format phone: ensure it starts with +254
        const rawPhone = successDetails.phoneNumber;
        const displayPhone = rawPhone.startsWith('+')
          ? rawPhone
          : `+${rawPhone}`;

        // Format transaction date: "19 Mar 2026 · 15:46"
        let displayDate: string | null = null;
        if (successDetails.transactionDate) {
          const d = new Date(successDetails.transactionDate);
          if (!isNaN(d.getTime())) {
            displayDate = d.toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
            }) + ' · ' + d.toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit',
            });
          }
        }

        const dismiss = () => {
          setIsSuccessModalOpen(false);
          setSuccessDetails(null);
          setStatusMessage(null);
        };

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-lg max-w-xs w-full overflow-hidden">

              {/* Close */}
              <button
                type="button"
                onClick={dismiss}
                className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="px-6 pt-7 pb-6 space-y-4">

                {/* Logo + check icon */}
                <div className="flex items-center justify-between">
                  <div className="border border-gray-200 rounded-lg px-3 py-1.5">
                    <Image
                      src="/mpesalogo.png"
                      alt="M-Pesa"
                      width={68}
                      height={24}
                      className="object-contain h-5 w-auto"
                    />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-blue-600" strokeWidth={2} />
                  </div>
                </div>

                {/* Transaction Ref — prominent at top */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-1">
                    Transaction Ref
                  </p>
                  <p className="font-mono font-bold text-blue-700 text-lg tracking-wider">
                    {successDetails.mpesaReceiptNumber || '—'}
                  </p>
                </div>

                {/* Confirmed label + amount */}
                <div className="border-b border-gray-100 pb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                    Payment Confirmed
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    KES {successDetails.amount.toLocaleString()}
                  </p>
                </div>

                {/* Customer name (C2B only) */}
                {successDetails.customerName && (
                  <div className="border-b border-gray-100 pb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Customer</p>
                    <p className="text-base font-semibold text-gray-900 capitalize">
                      {successDetails.customerName.toLowerCase()}
                    </p>
                  </div>
                )}

                {/* Detail rows */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</span>
                    <span className="text-sm font-medium text-gray-900">{displayPhone}</span>
                  </div>
                  {displayDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date & Time</span>
                      <span className="text-sm font-medium text-gray-900">{displayDate}</span>
                    </div>
                  )}
                </div>

                {/* Done */}
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold transition-colors text-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

