'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { getInvoiceStats } from '@/app/actions/invoice-actions';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface InvoiceStatCardProps {
  type: 'total' | 'revenue' | 'pending' | 'paid';
  className?: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export default function InvoiceStatCard({ type, className = '' }: InvoiceStatCardProps) {
  const [value, setValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const loadStat = async () => {
      // Check localStorage cache first
      const cacheKey = `invoice_stat_${type}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 5 minutes old
          if ((now - parsed.timestamp) < CACHE_DURATION) {
            setValue(parsed.data);
            setLoading(false);
            return;
          }
        } catch {
          // If cache is corrupted, remove it and fetch fresh
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        setLoading(true);
        setError(null);
        
        const result = await getInvoiceStats();
        
        if (result.success && result.data) {
          let statValue = 0;
          
          switch (type) {
            case 'total':
              statValue = result.data.totalInvoices || 0;
              break;
            case 'revenue':
              statValue = result.data.totalRevenue || 0;
              break;
            case 'pending':
              statValue = (result.data.statusCounts?.sent || 0) + (result.data.statusCounts?.pending || 0);
              break;
            case 'paid':
              statValue = result.data.statusCounts?.paid || 0;
              break;
          }
          
          setValue(statValue);
          
          // Cache in localStorage
          const cacheData = {
            data: statValue,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          setError(result.error || 'Failed to load stat');
        }
      } catch {
        setError('Failed to load stat');
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadStat();
    }
  }, [type]);

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

