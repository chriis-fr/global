'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, ChevronDown } from 'lucide-react';
import {
  getMpesaTotalByPeriod,
  type MpesaTotalPeriod,
} from '@/app/actions/mpesa-waiter-stats';

const PERIODS: { value: MpesaTotalPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
];

export function MpesaTotalAmountCard() {
  const [period, setPeriod] = useState<MpesaTotalPeriod>('1m');
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMpesaTotalByPeriod(period).then((res) => {
      if (!cancelled && res.success && res.data) {
        setAmount(res.data.totalAmount);
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-dropdown="mpesa-period"]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  const handleSelectPeriod = (value: MpesaTotalPeriod) => {
    setPeriod(value);
    setOpen(false);
  };

  const updateRect = () => {
    if (ref.current) setDropdownRect(ref.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (open && ref.current) setDropdownRect(ref.current.getBoundingClientRect());
    if (!open) setDropdownRect(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updateRect();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  const dropdownContent =
    open && dropdownRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-dropdown="mpesa-period"
            className="fixed min-w-[7rem] rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md shadow-xl py-1 z-[9999]"
            role="listbox"
            style={{
              left: dropdownRect.left,
              top: dropdownRect.bottom + 4,
            }}
          >
            {PERIODS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={period === opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectPeriod(opt.value);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  period === opt.value
                    ? 'bg-blue-500/20 text-white font-medium'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center justify-between relative">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-blue-200">Total successful (STK + claimed till)</p>
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 px-2 py-1 text-xs font-medium text-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label="Select period"
            >
              <span>{currentLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-blue-300 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
        {dropdownContent}
        <p className="text-2xl font-semibold text-white mt-1 tabular-nums">
          {loading ? (
            <span className="inline-block w-24 h-8 bg-white/10 rounded animate-pulse" />
          ) : (
            <>KES {amount.toLocaleString()}</>
          )}
        </p>
      </div>
      <CheckCircle className="h-8 w-8 text-emerald-400 flex-shrink-0 ml-2" />
    </div>
  );
}
