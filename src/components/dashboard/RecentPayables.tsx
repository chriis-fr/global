'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getRecentPayables, RecentPayable } from '@/lib/actions/dashboard';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import CurrencyAmount from '@/components/CurrencyAmount';

interface RecentPayablesProps {
  className?: string;
}

export default function RecentPayables({ className = '' }: RecentPayablesProps) {
  const [payables, setPayables] = useState<RecentPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hasInitialized = useRef(false);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for recent data

  useEffect(() => {
    const loadRecentPayables = async () => {
      // Check localStorage cache first
      const cacheKey = 'recent_payables';
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 2 minutes old
          if ((now - parsed.timestamp) < CACHE_DURATION) {
            setPayables(parsed.data);
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
        
        const result = await getRecentPayables(5);
        
        if (result.success && result.data) {
          setPayables(result.data);
          
          // Cache in localStorage
          const cacheData = {
            data: result.data,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          setError(result.error || 'Failed to load recent payables');
        }
      } catch {
        console.error('Error loading recent payables');
        setError('Failed to load recent payables');
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadRecentPayables();
    }
  }, [CACHE_DURATION]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-400" />;
      case 'pending':
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-orange-400" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'draft':
        return <Receipt className="h-4 w-4 text-gray-400" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400';
      case 'approved':
        return 'text-blue-400';
      case 'pending':
      case 'pending_approval':
        return 'text-orange-400';
      case 'overdue':
        return 'text-red-400';
      case 'draft':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-6">
          <Receipt className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Recent Payables</h3>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="h-4 w-4 bg-white/20 rounded"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-white/20 rounded"></div>
                  <div className="h-3 w-24 bg-white/20 rounded"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-4 w-16 bg-white/20 rounded"></div>
                <div className="h-3 w-12 bg-white/20 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-6">
          <Receipt className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Recent Payables</h3>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Failed to load payables</span>
          </div>
          <p className="text-red-300 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Receipt className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Recent Payables</h3>
        </div>
        <button
          onClick={() => router.push('/dashboard/services/payables')}
          className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
        >
          View All
        </button>
      </div>

      {payables.length === 0 ? (
        <div className="text-center py-8">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">No payables yet</p>
          <p className="text-gray-500 text-sm">Your payables will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payables.map((payable) => (
            <div
              key={payable._id}
              className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/services/payables/${payable._id}`)}
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(payable.status)}
                <div>
                  <p className="font-medium text-white">{payable.payableNumber}</p>
                  <p className="text-sm text-gray-400">{payable.vendorName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">
                  <CurrencyAmount 
                    amount={payable.total} 
                    currency={payable.currency || 'USD'}
                    convertedAmount={payable.amountUsd}
                    convertedCurrency="USD"
                  />
                </p>
                <p className={`text-xs font-medium ${getStatusColor(payable.status)}`}>
                  {payable.status.charAt(0).toUpperCase() + payable.status.slice(1).replace('_', ' ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
