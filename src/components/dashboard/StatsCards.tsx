'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { usePathname } from 'next/navigation';
import { 
  TrendingUp, 
  TrendingDown, 
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { getDashboardStats, DashboardStats } from '@/lib/actions/dashboard';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

interface StatsCardsProps {
  className?: string;
}

// Move CACHE_DURATION outside component to avoid dependency issues
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const CACHE_KEY = 'dashboard_stats';

// Return any cached stats (even stale) for immediate display when navigating back
function readCache(): { data: DashboardStats | null; valid: boolean } {
  if (typeof window === 'undefined') return { data: null, valid: false };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: null, valid: false };
    const parsed = JSON.parse(raw);
    const data = parsed?.data ?? null;
    const valid = data && (Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION;
    return { data, valid };
  } catch {
    return { data: null, valid: false };
  }
}

export default function StatsCards({ className = '' }: StatsCardsProps) {
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  const pathname = usePathname();
  
  // Only fetch data when on the dashboard page
  const isOnDashboardPage = pathname === '/dashboard';

  // Sync init from cache (any cache, even stale) so returning to dashboard shows data immediately
  const [stats, setStats] = useState<DashboardStats>(() => {
    const { data } = readCache();
    return data || {
      totalReceivables: 0,
      totalPaidRevenue: 0,
      totalExpenses: 0,
      pendingInvoices: 0,
      paidInvoices: 0,
      totalClients: 0,
      netBalance: 0,
      totalPayables: 0,
      overdueCount: 0
    };
  });
  const [loading, setLoading] = useState(() => !readCache().data); // No loading if we have any cache to show
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

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

  // Calculate number of cards to show (needed for scroll indicator check)
  const cardCount = 1 + // Net Balance (always shown)
    (canShowReceivables ? 1 : 0) + // Receivables
    (canShowPayables ? 1 : 0) + // Payables
    1; // Total Clients (always shown)

  useEffect(() => {
    // Only fetch data when on the dashboard page
    if (!isOnDashboardPage) {
      return;
    }

    const loadStats = async () => {
      const { data: cachedData } = readCache();

      // If we have cache (valid or stale), show it and don't show loading; revalidate in background
      if (cachedData) {
        setStats(cachedData);
        setLoading(false);
        hasInitialized.current = true;
        getDashboardStats().then((result) => {
          if (result.success && result.data) {
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data, timestamp: Date.now() }));
              setStats(result.data);
            } catch {}
          }
        }).catch(() => {});
        return;
      }

      // No cache at all - fetch and show loading
      try {
        setLoading(true);
        setError(null);
        const result = await getDashboardStats();
        if (result.success && result.data) {
          setStats(result.data);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data, timestamp: Date.now() }));
          } catch {}
        } else {
          setError(result.error || 'Failed to load stats');
        }
      } catch {
        setError('Failed to load stats');
      } finally {
        setLoading(false);
        hasInitialized.current = true;
      }
    };

    // Only load once on mount, or if session/subscription changes
    if (!hasInitialized.current) {
      loadStats();
    }
  }, [isOnDashboardPage, session?.user?.id, subscription?.plan?.planId]); // Re-fetch only if user or plan changes, or when navigating to/from dashboard

  // Check if there's more content to scroll (mobile only)
  useEffect(() => {
    const checkScrollable = () => {
      if (!scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10; // 10px threshold
      
      // Only show indicator on mobile and if there's more content to scroll
      const isMobile = window.innerWidth < 768;
      setShowScrollIndicator(isMobile && hasHorizontalScroll && !isAtEnd);
    };

    checkScrollable();
    
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollable);
      window.addEventListener('resize', checkScrollable);
      
      return () => {
        container.removeEventListener('scroll', checkScrollable);
        window.removeEventListener('resize', checkScrollable);
      };
    }
  }, [cardCount, loading]); // Re-check when cards change or loading completes

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className={`flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse flex-shrink-0 w-[calc(50%-12px)] md:w-auto min-h-[180px] md:min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="h-8 w-8 bg-white/20 rounded-lg"></div>
              <div className="h-4 w-16 bg-white/20 rounded"></div>
            </div>
            <div className="h-8 w-24 bg-white/20 rounded mb-2"></div>
            <div className="h-4 w-20 bg-white/20 rounded"></div>
          </div>
        ))}
        </div>
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

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={scrollContainerRef}
        className={`flex md:grid gap-6 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar ${
          cardCount === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
          cardCount === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
          'md:grid-cols-2'
        }`}
      >
        {/* Net Balance - Show for all plans */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 flex-shrink-0 w-[calc(50%-12px)] md:w-auto min-h-[180px] md:min-h-0">
        <div className="flex flex-col justify-between h-full">
          <div>
            <p className="text-blue-200 text-sm font-medium">Net Balance</p>
            <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'} mt-2`}>
              {stats.netBalance >= 0 ? '+' : ''}
              <FormattedNumberDisplay value={Math.abs(stats.netBalance)} />
            </p>
            <p className="text-xs text-blue-300 mt-2">
              {stats.netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
            </p>
          </div>
          <div className={`p-3 rounded-lg w-fit mt-4 ${stats.netBalance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {stats.netBalance >= 0 ? 
              <TrendingUp className="h-6 w-6 text-green-400" /> : 
              <TrendingDown className="h-6 w-6 text-red-400" />
            }
          </div>
        </div>
      </div>

      {/* Receivables (Invoices) - Show if service is enabled AND user has subscription access */}
      {canShowReceivables && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 flex-shrink-0 w-[calc(50%-12px)] md:w-auto min-h-[180px] md:min-h-0">
          <div className="flex flex-col justify-between h-full">
            <div>
              <p className="text-blue-200 text-sm font-medium">Receivables</p>
              <p className="text-2xl font-bold text-white mt-2">
                <FormattedNumberDisplay value={stats.totalReceivables} />
              </p>
              <p className="text-xs text-blue-300 mt-2">{stats.pendingInvoices} pending invoices</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg w-fit mt-4">
              <ArrowDownLeft className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* Payables (Bills) - Show if service is enabled AND user has subscription access */}
      {canShowPayables && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 flex-shrink-0 w-[calc(50%-12px)] md:w-auto min-h-[180px] md:min-h-0">
          <div className="flex flex-col justify-between h-full">
            <div>
              <p className="text-blue-200 text-sm font-medium">Payables</p>
              <p className="text-2xl font-bold text-white mt-2">
                <FormattedNumberDisplay value={stats.totalPayables} />
              </p>
              <p className="text-xs text-blue-300 mt-2">Bills to pay</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg w-fit mt-4">
              <ArrowUpRight className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Total Clients */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 flex-shrink-0 w-[calc(50%-12px)] md:w-auto min-h-[180px] md:min-h-0">
        <div className="flex flex-col justify-between h-full">
          <div>
            <p className="text-blue-200 text-sm font-medium">Total Clients</p>
            <p className="text-2xl font-bold text-white mt-2">
              {stats.totalClients}
            </p>
            <p className="text-xs text-blue-300 mt-2">Active relationships</p>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-lg w-fit mt-4">
            <Users className="h-6 w-6 text-purple-400" />
          </div>
        </div>
      </div>
      </div>
      
      {/* Scroll Indicator - Only visible on mobile when there's more content */}
      {showScrollIndicator && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 md:hidden pointer-events-none flex items-center justify-end pr-2 z-10">
          <div className="bg-gradient-to-l from-blue-950 via-blue-950/90 to-transparent w-7 h-14 flex items-center justify-end rounded-l-lg">
            <ChevronRight className="h-5 w-5 text-blue-400/80 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
