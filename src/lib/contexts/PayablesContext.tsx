'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { getPayablesStats, getOnboardingStatus } from '@/app/actions/payable-actions';

interface PayableStats {
  totalPayables: number;
  pendingCount: number;
  paidCount: number;
  totalAmount: number;
}

interface PayablesContextType {
  stats: PayableStats | null;
  isOnboardingCompleted: boolean | null;
  isLoading: boolean;
  refetch: () => void;
  clearCache: () => void;
}

const PayablesContext = createContext<PayablesContextType | undefined>(undefined);

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache (session-level)
const STATS_CACHE_KEY = 'payables_stats_cache';
const ONBOARDING_CACHE_KEY = 'payables_onboarding_cache';
const USER_CACHE_KEY = 'payables_user_id';

export function PayablesProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<PayableStats | null>(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const getCachedStats = useCallback((userId?: string) => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(STATS_CACHE_KEY);
      const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
      
      if (cached && cachedUserId) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is for the current user and still valid
        if (cachedUserId === userId && now - timestamp < CACHE_DURATION) {
          return data;
        } else if (cachedUserId !== userId) {
          localStorage.removeItem(STATS_CACHE_KEY);
          localStorage.removeItem(ONBOARDING_CACHE_KEY);
          localStorage.removeItem(USER_CACHE_KEY);
        } else {
          localStorage.removeItem(STATS_CACHE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STATS_CACHE_KEY);
    }
    
    return null;
  }, []);

  const getCachedOnboarding = useCallback((userId?: string) => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(ONBOARDING_CACHE_KEY);
      const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
      
      if (cached && cachedUserId) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (cachedUserId === userId && now - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch {
      localStorage.removeItem(ONBOARDING_CACHE_KEY);
    }
    
    return null;
  }, []);

  const setCachedStats = useCallback((data: PayableStats, userId: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      localStorage.setItem(USER_CACHE_KEY, userId);
    } catch (error) {
      console.error('Error caching payables stats:', error);
    }
  }, []);

  const setCachedOnboarding = useCallback((data: boolean, userId: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      localStorage.setItem(USER_CACHE_KEY, userId);
    } catch (error) {
      console.error('Error caching onboarding status:', error);
    }
  }, []);

  const fetchPayablesData = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // Try to load from cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cachedStats = getCachedStats(userId);
        const cachedOnboarding = getCachedOnboarding(userId);

        if (cachedStats) {
          setStats(cachedStats);
        }
        if (cachedOnboarding !== null) {
          setIsOnboardingCompleted(cachedOnboarding);
        }

        // If we have cached data, check if it's stale and refresh in background
        if (cachedStats || cachedOnboarding !== null) {
          try {
            const statsCache = localStorage.getItem(STATS_CACHE_KEY);
            if (statsCache) {
              const { timestamp } = JSON.parse(statsCache);
              const age = Date.now() - timestamp;
              const staleThreshold = 5 * 60 * 1000; // 5 minutes

              if (age > staleThreshold) {
                // Refresh in background without blocking
                fetchPayablesData(true).catch((err) => {
                  console.error('Background refresh failed:', err);
                });
              }
            }
          } catch (err) {
            console.error('Error checking cache age:', err);
          }
          return;
        }
      } catch (err) {
        console.error('Error loading from cache:', err);
        // Continue to fetch fresh data if cache fails
      }
    }

    // Fetch fresh data
    setIsLoading(true);
    try {
      // Fetch both in parallel for maximum speed
      const [statsResult, onboardingResult] = await Promise.all([
        getPayablesStats().catch((err) => {
          console.error('Error fetching stats:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
        }),
        getOnboardingStatus('accountsPayable').catch((err) => {
          console.error('Error fetching onboarding:', err);
          return { success: false as const, error: err instanceof Error ? err.message : 'Unknown error' };
        })
      ]);

      if (statsResult.success && 'data' in statsResult && statsResult.data) {
        const statsData: PayableStats = {
          totalPayables: statsResult.data.totalPayables || 0,
          pendingCount: (statsResult.data.statusCounts?.pending || 0) + (statsResult.data.statusCounts?.approved || 0),
          paidCount: statsResult.data.statusCounts?.paid || 0,
          totalAmount: statsResult.data.totalAmount || 0
        };
        setStats(statsData);
        try {
          setCachedStats(statsData, userId);
        } catch (err) {
          console.error('Error caching stats:', err);
        }
      }

      if (onboardingResult.success && 'data' in onboardingResult && onboardingResult.data) {
        const isCompleted = onboardingResult.data.isCompleted;
        setIsOnboardingCompleted(isCompleted);
        try {
          setCachedOnboarding(isCompleted, userId);
        } catch (err) {
          console.error('Error caching onboarding:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching payables data:', error);
      // Don't crash the app - just log the error
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, getCachedStats, getCachedOnboarding, setCachedStats, setCachedOnboarding]);

  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STATS_CACHE_KEY);
    localStorage.removeItem(ONBOARDING_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    if (session?.user?.id) {
      if (!hasInitialized) {
        setHasInitialized(true);
        // Load from cache immediately, then fetch in background if stale
        try {
          fetchPayablesData(false);
        } catch (error) {
          console.error('Error initializing payables data:', error);
        }
      }
    } else {
      // Clear data and cache for unauthenticated users
      setStats(null);
      setIsOnboardingCompleted(null);
      setIsLoading(false);
      setHasInitialized(false);
      try {
        clearCache();
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
    }
  }, [session?.user?.id, fetchPayablesData, hasInitialized, clearCache]);

  const refetch = useCallback(() => {
    clearCache();
    fetchPayablesData(true);
  }, [fetchPayablesData, clearCache]);

  return (
    <PayablesContext.Provider
      value={{
        stats,
        isOnboardingCompleted,
        isLoading,
        refetch,
        clearCache
      }}
    >
      {children}
    </PayablesContext.Provider>
  );
}

export function usePayables() {
  const context = useContext(PayablesContext);
  if (context === undefined) {
    throw new Error('usePayables must be used within a PayablesProvider');
  }
  return context;
}

