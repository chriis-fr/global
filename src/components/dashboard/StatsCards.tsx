'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { getDashboardStats, DashboardStats } from '@/lib/actions/dashboard';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

interface StatsCardsProps {
  className?: string;
}

// Move CACHE_DURATION outside component to avoid dependency issues
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export default function StatsCards({ className = '' }: StatsCardsProps) {
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  const [stats, setStats] = useState<DashboardStats>({
    totalReceivables: 0,
    totalPaidRevenue: 0,
    totalExpenses: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalClients: 0,
    netBalance: 0,
    totalPayables: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Check if user has access to receivables and payables
  const isPayablesOnly = subscription?.plan?.type === 'payables';
  const isReceivablesOnly = subscription?.plan?.type === 'receivables';
  const isCombined = subscription?.plan?.type === 'combined';
  const isFreePlan = subscription?.plan?.planId === 'receivables-free';
  const isTrialPremium = subscription?.plan?.planId === 'trial-premium';
  
  const hasReceivablesAccess = isReceivablesOnly || isCombined || isFreePlan || isTrialPremium;
  const hasPayablesAccess = (isPayablesOnly || isCombined || isTrialPremium) && subscription?.canAccessPayables;
  
  // Check if services are enabled (must be enabled during onboarding)
  const isSmartInvoicingEnabled = session?.user?.services?.smartInvoicing || false;
  const isAccountsPayableEnabled = session?.user?.services?.accountsPayable || false;
  
  // Stats should only show if BOTH subscription access AND service is enabled
  const canShowReceivables = hasReceivablesAccess && isSmartInvoicingEnabled;
  const canShowPayables = hasPayablesAccess && isAccountsPayableEnabled;


         useEffect(() => {
           const loadStats = async () => {
             // Clear cache to force fresh data with correct receivables calculation
             const cacheKey = 'dashboard_stats';
             localStorage.removeItem(cacheKey);
      
      // Check localStorage cache first
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 5 minutes old
          if ((now - parsed.timestamp) < CACHE_DURATION) {
            setStats(parsed.data);
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
        
        const result = await getDashboardStats();
        
        if (result.success && result.data) {
          setStats(result.data);
          
          // Cache in localStorage
          const cacheData = {
            data: result.data,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          setError(result.error || 'Failed to load stats');
        }
      } catch {
        setError('Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadStats();
    }
  }, []);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-8 w-8 bg-white/20 rounded-lg"></div>
              <div className="h-4 w-16 bg-white/20 rounded"></div>
            </div>
            <div className="h-8 w-24 bg-white/20 rounded mb-2"></div>
            <div className="h-4 w-20 bg-white/20 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-xl p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Failed to load stats</span>
        </div>
        <p className="text-red-300 text-sm mt-2">{error}</p>
      </div>
    );
  }

  // Calculate number of cards to show
  const cardCount = 1 + // Net Balance (always shown)
    (canShowReceivables ? 1 : 0) + // Receivables
    (canShowPayables ? 1 : 0) + // Payables
    1; // Total Clients (always shown)

  return (
    <div className={`grid gap-6 ${
      cardCount === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
      cardCount === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
      'grid-cols-1 md:grid-cols-2'
    } ${className}`}>
      {/* Net Balance - Show for all plans */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Net Balance</p>
            <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.netBalance >= 0 ? '+' : ''}
              <FormattedNumberDisplay value={Math.abs(stats.netBalance)} />
            </p>
            <p className="text-xs text-blue-300 mt-1">
              {stats.netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${stats.netBalance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {stats.netBalance >= 0 ? 
              <TrendingUp className="h-6 w-6 text-green-400" /> : 
              <TrendingDown className="h-6 w-6 text-red-400" />
            }
          </div>
        </div>
      </div>

      {/* Receivables (Invoices) - Show if service is enabled AND user has subscription access */}
      {canShowReceivables && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Receivables</p>
            <p className="text-2xl font-bold text-white">
              <FormattedNumberDisplay value={stats.totalReceivables} />
            </p>
            <p className="text-xs text-blue-300 mt-1">{stats.pendingInvoices} pending invoices</p>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <ArrowUpRight className="h-6 w-6 text-blue-400" />
          </div>
        </div>
        </div>
      )}

      {/* Payables (Bills) - Show if service is enabled AND user has subscription access */}
      {canShowPayables && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Payables</p>
              <p className="text-2xl font-bold text-white">
                <FormattedNumberDisplay value={stats.totalPayables} />
              </p>
              <p className="text-xs text-blue-300 mt-1">Bills to pay</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <ArrowDownLeft className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Total Clients */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Total Clients</p>
            <p className="text-2xl font-bold text-white">
              {stats.totalClients}
            </p>
            <p className="text-xs text-blue-300 mt-1">Active relationships</p>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Users className="h-6 w-6 text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
