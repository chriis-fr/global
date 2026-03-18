'use client';

import { useState, useEffect, useRef } from 'react';
import { Receipt, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { getPayablesStats } from '@/app/actions/payable-actions';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface PayableStatCardProps {
  type: 'total' | 'amount' | 'pending' | 'paid';
  className?: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getValueFromData(
  type: PayableStatCardProps['type'],
  data: {
    totalPayables?: number;
    totalAmount?: number;
    currency?: string | null;
    statusCounts?: { pending?: number; approved?: number; paid?: number; submitted?: number };
  }
): number {
  switch (type) {
    case 'total': return data.totalPayables ?? 0;
    case 'amount': return data.totalAmount ?? 0;
    case 'pending':
      return (data.statusCounts?.submitted ?? 0) + (data.statusCounts?.pending ?? 0) + (data.statusCounts?.approved ?? 0);
    case 'paid': return data.statusCounts?.paid ?? 0;
    default: return 0;
  }
}

function readCache(type: PayableStatCardProps['type']): { value: number; currency?: string | null; valid: boolean } {
  if (typeof window === 'undefined') return { value: 0, valid: false };
  try {
    const cacheKey = `payable_stat_${type}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return { value: 0, valid: false };
    const parsed = JSON.parse(raw);
    const valid = (Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION;
    if (typeof parsed?.data === 'number') {
      return { value: parsed.data, valid };
    }
    if (parsed?.data && typeof parsed.data === 'object' && typeof parsed.data.value === 'number') {
      return { value: parsed.data.value, currency: parsed.data.currency ?? null, valid };
    }
    return { value: 0, valid: false };
  } catch {
    return { value: 0, valid: false };
  }
}

export default function PayableStatCard({ type, className = '' }: PayableStatCardProps) {
  // IMPORTANT: avoid hydration mismatch by not reading localStorage in the initial render.
  // Server render can't see localStorage, so it always shows the loading skeleton.
  // We mirror that on the client and then hydrate from cache in an effect.
  const [state, setState] = useState<{ value: number; currency: string | null; loading: boolean; error: string | null }>(
    { value: 0, currency: null, loading: true, error: null }
  );
  const { value, currency, loading, error } = state;
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const load = async (background: boolean) => {
      try {
        if (!background) setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await getPayablesStats();
        if (result.success && result.data) {
          const v = getValueFromData(type, result.data);
          setState(prev => ({ ...prev, value: v, currency: result.data.currency ?? null, loading: false }));
          try {
            const payload = type === 'amount'
              ? { value: v, currency: result.data.currency ?? null }
              : v;
            localStorage.setItem(`payable_stat_${type}`, JSON.stringify({ data: payload, timestamp: Date.now() }));
          } catch {}
        } else if (!background) {
          setState(prev => ({ ...prev, error: result.error || 'Failed to load stat', loading: false }));
        }
      } catch {
        if (!background) setState(prev => ({ ...prev, error: 'Failed to load stat', loading: false }));
      } finally {
        if (!background) setState(prev => ({ ...prev, loading: false }));
      }
    };
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const { value: cachedValue, currency: cachedCurrency, valid } = readCache(type);
      if (valid) {
        setState(prev => ({ ...prev, value: cachedValue, currency: cachedCurrency ?? null, loading: false, error: null }));
      }
      load(valid);
    }
  }, [type]);

  const getCardConfig = () => {
    switch (type) {
      case 'total':
        return {
          label: 'Total Payables',
          icon: Receipt,
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-400',
          valueColor: 'text-white'
        };
      case 'amount':
        return {
          label: 'Total Amount',
          icon: DollarSign,
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-400',
          valueColor: 'text-white'
        };
      case 'pending':
        return {
          label: 'Pending',
          icon: Clock,
          iconBg: 'bg-yellow-500/20',
          iconColor: 'text-yellow-400',
          valueColor: 'text-yellow-400'
        };
      case 'paid':
        return {
          label: 'Paid',
          icon: CheckCircle,
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-400',
          valueColor: 'text-green-400'
        };
    }
  };

  const config = getCardConfig();
  const Icon = config.icon;

  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 animate-pulse ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
            <div className="h-8 w-16 bg-white/20 rounded"></div>
          </div>
          <div className="p-3 bg-white/20 rounded-lg">
            <div className="h-6 w-6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">{config.label}</p>
            <p className="text-2xl font-bold text-white">--</p>
          </div>
          <div className={`p-3 ${config.iconBg} rounded-lg`}>
            <Icon className={`h-6 w-6 ${config.iconColor}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-medium">{config.label}</p>
          <p className={`text-2xl font-bold ${config.valueColor}`}>
            {type === 'amount' ? (
              <FormattedNumberDisplay value={value} currency={currency || 'KES'} usePreferredCurrency={!currency} />
            ) : (
              value
            )}
          </p>
        </div>
        <div className={`p-3 ${config.iconBg} rounded-lg`}>
          <Icon className={`h-6 w-6 ${config.iconColor}`} />
        </div>
      </div>
    </div>
  );
}

