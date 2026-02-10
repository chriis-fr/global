'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { getInvoiceStats } from '@/app/actions/invoice-actions';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface InvoiceStatCardProps {
  type: 'total' | 'revenue' | 'pending' | 'paid';
  className?: string;
  /** When provided, use this value and skip internal fetch (page-level cache) */
  cachedValue?: number;
  /** When true/false, controls loading state when using cached data */
  cachedLoading?: boolean;
}

const CACHE_KEY = 'smart_invoicing_stats';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getValueFromStats(type: InvoiceStatCardProps['type'], data: { totalInvoices?: number; totalRevenue?: number; statusCounts?: { sent?: number; pending?: number; paid?: number } }): number {
  switch (type) {
    case 'total': return data.totalInvoices ?? 0;
    case 'revenue': return data.totalRevenue ?? 0;
    case 'pending': return (data.statusCounts?.sent ?? 0) + (data.statusCounts?.pending ?? 0);
    case 'paid': return data.statusCounts?.paid ?? 0;
    default: return 0;
  }
}

export default function InvoiceStatCard({ type, className = '', cachedValue, cachedLoading }: InvoiceStatCardProps) {
  const [value, setValue] = useState<number>(() => {
    if (typeof cachedValue === 'number') return cachedValue;
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if ((Date.now() - (parsed?.timestamp ?? 0)) >= CACHE_DURATION) return 0;
      return getValueFromStats(type, parsed?.data ?? {});
    } catch { return 0; }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof cachedLoading === 'boolean') return cachedLoading;
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      return (Date.now() - (parsed?.timestamp ?? 0)) >= CACHE_DURATION;
    } catch { return true; }
  });
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // When parent provides cached data, use it and don't fetch
  useEffect(() => {
    if (typeof cachedValue === 'number' && cachedLoading === false) {
      setValue(cachedValue);
      setLoading(false);
      return;
    }
    if (cachedLoading === true) setLoading(true);
  }, [cachedValue, cachedLoading]);

  useEffect(() => {
    if (cachedLoading !== undefined) return;
    const loadStat = async () => {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        let validCache = false;
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            if ((Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION) {
              setValue(getValueFromStats(type, parsed?.data ?? {}));
              setLoading(false);
              validCache = true;
            }
          } catch { localStorage.removeItem(CACHE_KEY); }
        }
        if (!validCache) setLoading(true);
        setError(null);
        const result = await getInvoiceStats();
        if (result.success && result.data) {
          const v = getValueFromStats(type, result.data);
          setValue(v);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data, timestamp: Date.now() }));
          } catch {}
        } else if (!validCache) setError(result.error || 'Failed to load stat');
      } catch { if (!hasFetchedRef.current) setError('Failed to load stat'); }
      finally { setLoading(false); }
    };
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadStat();
    }
  }, [type, cachedLoading]);

  const getCardConfig = () => {
    switch (type) {
      case 'total':
        return {
          label: 'Total Invoices',
          icon: FileText,
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-400'
        };
      case 'revenue':
        return {
          label: 'Total Revenue',
          icon: DollarSign,
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-400'
        };
      case 'pending':
        return {
          label: 'Pending',
          icon: Calendar,
          iconBg: 'bg-yellow-500/20',
          iconColor: 'text-yellow-400'
        };
      case 'paid':
        return {
          label: 'Paid',
          icon: TrendingUp,
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-400'
        };
    }
  };

  const config = getCardConfig();
  const Icon = config.icon;

  const cardContent = (displayValue: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-blue-200 text-sm font-medium leading-tight truncate">{config.label}</p>
        <p className="text-2xl font-bold text-white leading-tight mt-1 truncate">
          {displayValue}
        </p>
      </div>
      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${config.iconBg}`}>
        <Icon className={`h-5 w-5 ${config.iconColor}`} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 hover:bg-white/15 transition-all duration-200 animate-pulse h-full flex flex-col justify-center ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
            <div className="h-7 w-16 bg-white/20 rounded"></div>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-lg flex-shrink-0"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 h-full flex flex-col justify-center ${className}`}>
        {cardContent('--')}
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 hover:bg-white/15 transition-all duration-200 h-full flex flex-col justify-center ${className}`}>
      {cardContent(
        type === 'revenue' ? (
          <FormattedNumberDisplay value={value} usePreferredCurrency={true} />
        ) : (
          value
        )
      )}
    </div>
  );
}

