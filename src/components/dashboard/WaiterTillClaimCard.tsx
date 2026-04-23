'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Banknote, X, ChevronRight, Smartphone } from 'lucide-react';
import {
  searchTillPaymentsByReceipt,
  claimTillPaymentAsWaiter,
  type TillPaymentSearchRow,
} from '@/app/actions/mpesa-waiter-till-claim';

/** After a successful claim, clear the receipt field and success copy. */
const CLAIM_SUCCESS_CLEAR_MS = 4500;

type Props = {
  /** False while org role is still resolving — avoids non-waiters hitting search. */
  canClaim: boolean;
  roleLoadingMessage?: string;
};

/** Show payer number like `0723****984` — never full MSISDN to the waiter. */
function maskPhoneForWaiter(phone: string): string {
  const raw = phone.replace(/\D/g, '');
  if (!raw) return '—';
  let d = raw;
  if (d.startsWith('254') && d.length >= 11) {
    d = `0${d.slice(3)}`;
  }
  if (d.length < 7) {
    return `${d.slice(0, 2)}****`;
  }
  const start = d.slice(0, 4);
  const end = d.slice(-3);
  return `${start}****${end}`;
}

function PaymentResultCard({
  row,
  onPick,
  disabled,
  solo,
}: {
  row: TillPaymentSearchRow;
  onPick: () => void;
  disabled: boolean;
  solo: boolean;
}) {
  const claimed = row.claimed;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={[
        'group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/80',
        solo ? 'py-6 sm:py-7' : '',
        claimed
          ? 'border-amber-400/25 bg-gradient-to-br from-amber-500/[0.08] to-white/[0.04] hover:border-amber-400/45 hover:shadow-lg hover:shadow-amber-950/30'
          : 'border-white/15 bg-gradient-to-br from-white/[0.14] to-white/[0.04] hover:border-emerald-400/35 hover:shadow-lg hover:shadow-emerald-950/25',
        disabled ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.01] active:scale-[0.99]',
      ].join(' ')}
    >
      {claimed && (
        <span className="absolute right-4 top-4 rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/95">
          Claimed
        </span>
      )}
      <div className={`flex items-start justify-between gap-4 ${claimed ? 'pr-14' : 'pr-2'}`}>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-3xl">
            KES {row.amount.toLocaleString()}
          </p>
          <p className="font-mono text-sm text-emerald-200/90 sm:text-base">
            {row.mpesaReceiptNumber || '—'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-200/90 sm:text-sm">
            <span className="inline-flex items-center gap-1.5 font-mono tracking-wide text-blue-100/95">
              <Smartphone className="h-3.5 w-3.5 shrink-0 text-blue-400/80" aria-hidden />
              {maskPhoneForWaiter(row.phoneNumber)}
            </span>
            {row.timestamp ? (
              <span className="text-blue-300/85">
                {new Date(row.timestamp).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight
          className={`mt-1 h-6 w-6 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
            claimed ? 'text-amber-300/70' : 'text-emerald-400/70'
          }`}
          aria-hidden
        />
      </div>
    </button>
  );
}

export default function WaiterTillClaimCard({ canClaim, roleLoadingMessage }: Props) {
  const router = useRouter();
  const [fragment, setFragment] = useState('');
  const [results, setResults] = useState<TillPaymentSearchRow[]>([]);
  const [modalPayment, setModalPayment] = useState<TillPaymentSearchRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [claiming, setClaiming] = useState(false);
  const claimSuccessClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (claimSuccessClearRef.current) clearTimeout(claimSuccessClearRef.current);
    };
  }, []);

  useEffect(() => {
    if (!modalPayment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalPayment(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalPayment]);

  const onSearch = () => {
    setError(null);
    setInfo(null);
    setModalPayment(null);
    if (!canClaim) return;
    const q = fragment.trim();
    if (q.length < 3) {
      setError('Enter at least 3 characters (often the last 3–4 of the receipt are enough).');
      return;
    }
    startSearch(async () => {
      const res = await searchTillPaymentsByReceipt(q);
      if (!res.success) {
        setResults([]);
        setError(res.error);
        return;
      }
      setResults(res.data);
      if (res.data.length === 0) {
        setInfo('No payments match that code. Check the receipt or ask your manager.');
      }
    });
  };

  const openPayment = (row: TillPaymentSearchRow) => {
    setError(null);
    setModalPayment(row);
  };

  const closeModal = () => {
    setModalPayment(null);
  };

  const onClaimFromModal = () => {
    const row = modalPayment;
    if (!row || !canClaim || row.claimed) return;
    setError(null);
    setInfo(null);
    setClaiming(true);
    void (async () => {
      try {
        const res = await claimTillPaymentAsWaiter(row.id);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setResults((prev) => prev.filter((r) => r.id !== row.id));
        closeModal();
        setInfo(`Claimed KES ${row.amount.toLocaleString()} (${row.mpesaReceiptNumber}).`);

        if (claimSuccessClearRef.current) clearTimeout(claimSuccessClearRef.current);
        claimSuccessClearRef.current = setTimeout(() => {
          claimSuccessClearRef.current = null;
          setFragment('');
          setInfo(null);
        }, CLAIM_SUCCESS_CLEAR_MS);
        router.refresh();
      } finally {
        setClaiming(false);
      }
    })();
  };

  const solo = results.length === 1;

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
          <Banknote className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Search payment</h3>
          <p className="text-sm text-blue-200/95 mt-1">
            Use mpesa code to search. Tap to confirm or claim the payment.
          </p>
        </div>
      </div>

      {!canClaim && (
        <p className="text-sm text-amber-200/90 mb-4">{roleLoadingMessage ?? 'Unavailable.'}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="Receipt code"
          value={fragment}
          onChange={(e) => setFragment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canClaim && onSearch()}
          disabled={!canClaim || searching}
          className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={!canClaim || searching}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Search className="h-4 w-4" />
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}
      {info && <p className="text-sm text-emerald-300 mb-3">{info}</p>}

      {results.length > 0 && (
        <div
          className={
            solo
              ? 'mt-2 max-w-lg mx-auto'
              : 'mt-2 grid gap-3 sm:grid-cols-2'
          }
          role="list"
          aria-label="Search results"
        >
          {results.map((row) => (
            <div key={row.id} role="listitem">
              <PaymentResultCard
                row={row}
                solo={solo}
                disabled={!canClaim}
                onPick={() => openPayment(row)}
              />
            </div>
          ))}
        </div>
      )}

      {modalPayment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="till-claim-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-xl border border-white/20 bg-slate-900/95 shadow-2xl p-6 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h4 id="till-claim-modal-title" className="text-lg font-semibold text-white pr-2">
                {modalPayment.claimed ? 'Payment details' : 'Claim this payment?'}
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-blue-300 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-blue-300">Amount</dt>
                <dd className="text-white font-semibold tabular-nums">
                  KES {modalPayment.amount.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-blue-300">Payer phone</dt>
                <dd className="text-white font-mono tracking-wide">
                  {maskPhoneForWaiter(modalPayment.phoneNumber)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-blue-300">M-Pesa receipt</dt>
                <dd className="text-white font-mono text-xs break-all text-right">
                  {modalPayment.mpesaReceiptNumber || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-blue-300">Date / time</dt>
                <dd className="text-blue-100 text-right">
                  {modalPayment.timestamp
                    ? new Date(modalPayment.timestamp).toLocaleString()
                    : '—'}
                </dd>
              </div>
              {modalPayment.tableRef ? (
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-blue-300">Note / table</dt>
                  <dd className="text-blue-100 text-right">{modalPayment.tableRef}</dd>
                </div>
              ) : null}
              {modalPayment.matchStatus ? (
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-blue-300">Match status</dt>
                  <dd className="text-blue-200 text-right text-xs">{modalPayment.matchStatus}</dd>
                </div>
              ) : null}
              {modalPayment.claimed ? (
                <>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-blue-300">Recorded as</dt>
                    <dd className="text-amber-200/95 text-right text-sm font-medium">
                      {modalPayment.claimedAsLabel ?? 'Already claimed'}
                    </dd>
                  </div>
                  {modalPayment.claimedAt ? (
                    <div className="flex justify-between gap-4 pb-1">
                      <dt className="text-blue-300">Claimed at</dt>
                      <dd className="text-blue-100 text-right text-xs">
                        {new Date(modalPayment.claimedAt).toLocaleString()}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>

            {!modalPayment.claimed ? (
              <p className="text-xs text-blue-300">
                By claiming, you confirm this till payment should be recorded against you. This cannot be
                undone from here.
              </p>
            ) : (
              <p className="text-xs text-blue-300/90">
                This payment is already assigned. You can review the details above; it cannot be claimed
                again.
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
              {modalPayment.claimed ? (
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={claiming}
                    className="px-4 py-2.5 rounded-lg border border-white/20 text-blue-100 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onClaimFromModal}
                    disabled={!canClaim || claiming}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
                  >
                    {claiming ? 'Saving…' : 'Claim payment'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
