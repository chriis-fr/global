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
          <p className="text-2xl font-bold text-white">
            {type === 'revenue' ? (
              <FormattedNumberDisplay value={value} usePreferredCurrency={true} />
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

