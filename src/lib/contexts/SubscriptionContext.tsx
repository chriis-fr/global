'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { getUserSubscription, SubscriptionData } from '@/lib/actions/subscription';

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  clearCache: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache (longer for better UX)
const CACHE_KEY = 'subscription_cache';
const USER_CACHE_KEY = 'subscription_user_id'; // Track which user the cache belongs to

// Helper function to get cached subscription immediately (for initial state)
const getCachedSubscription = (userId?: string): SubscriptionData | null => {
  if (typeof window === 'undefined' || !userId) return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
    
    if (cached && cachedUserId === userId) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // Return cached data if it's less than 30 minutes old
      if (now - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  
  return null;
};

type SubscriptionProviderProps = {
  children: React.ReactNode;
  /** Preloaded subscription from server – avoids client fetch on first paint */
  initialSubscription?: SubscriptionData | null;
};

export function SubscriptionProvider({ children, initialSubscription: initialFromServer }: SubscriptionProviderProps) {
  const { data: session, status } = useSession();
  
  // Pre-load: server initial data > localStorage cache > null
  const [subscription, setSubscription] = useState<SubscriptionData | null>(() => {
    if (initialFromServer) return initialFromServer;
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
      if (cached && cachedUserId) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        if (now - timestamp < CACHE_DURATION) return data;
      }
    } catch {
      // Ignore errors
    }
    return null;
  });
  
  const [loading, setLoading] = useState(false); // Start with false - we have cache or server initial
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const hadInitialFromServer = useRef(!!initialFromServer);

  // Check if we're on the landing page - don't show loader there

  const getCachedData = useCallback((userId?: string) => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
      
      if (cached && cachedUserId) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is for the current user and still valid
        if (cachedUserId === userId && now - timestamp < CACHE_DURATION) {
          return data;
        } else if (cachedUserId !== userId) {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(USER_CACHE_KEY);
        } else {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(USER_CACHE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    }
    
    return null;
  }, []);

  const setCachedData = useCallback((data: SubscriptionData | null, userId?: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      if (data && userId) {
        const cacheData = {
          data,
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        localStorage.setItem(USER_CACHE_KEY, userId);
      } else {
        // Clear cache for organization members or when no subscription data
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(USER_CACHE_KEY);
      }
    } catch {
      // Error caching data
    }
  }, []);

  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  }, []);

  const fetchSubscription = useCallback(async (forceRefresh = false, showLoading = true) => {
    if (!session?.user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData(session.user.id);
      if (cachedData) {
        setSubscription(cachedData);
        setLoading(false);
        // Still fetch in background to update cache, but don't show loading
        getUserSubscription().then((subscriptionData) => {
          if (subscriptionData) {
            setCachedData(subscriptionData, session.user.id);
            setSubscription(subscriptionData); // Update silently
          }
        }).catch(() => {
          // Silently fail background refresh
        });
        return;
      }
    }

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const subscriptionData = await getUserSubscription();
      
      if (subscriptionData) {
        setSubscription(subscriptionData);
        setCachedData(subscriptionData, session.user.id);
      } else {
        // Don't throw error, just set loading to false and let the fallback handle it
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      
      // Only provide fallback subscription for individual users, not organization members
      if (session?.user?.id) {
        // Use fallback subscription (most users are individual)
        const fallbackData = {
          plan: {
            planId: 'receivables-free',
            type: 'receivables',
            tier: 'free'
          },
          status: 'active',
          isTrialActive: false,
          trialDaysRemaining: 0,
          usage: {
            invoicesThisMonth: 0,
            monthlyVolume: 0,
            recentInvoiceCount: 0
          },
          canCreateOrganization: false,
          canAccessPayables: false,
          canCreateInvoice: true,
          canUseAdvancedFeatures: false,
          limits: {
            invoicesPerMonth: 5,
            monthlyVolume: 0,
            cryptoToCryptoFee: 0.9
          }
        };
        setSubscription(fallbackData);
        setCachedData(fallbackData, session.user.id);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, getCachedData, setCachedData]);

  // Pre-fetch subscription on mount if we have cached user ID (even before session loads)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if we have a cached user ID from previous session
    const cachedUserId = localStorage.getItem(USER_CACHE_KEY);
    if (cachedUserId && !hasInitialized.current) {
      // We have a cached user, try to use cached subscription immediately
      const cached = getCachedSubscription(cachedUserId);
      if (cached) {
        setSubscription(cached);
        setLoading(false);
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    const userId = session?.user?.id;
    
    if (userId) {
      // If we had preloaded data from server, seed cache and refresh in background (no loading)
      if (hadInitialFromServer.current) {
        hadInitialFromServer.current = false;
        if (subscription) setCachedData(subscription, userId);
        fetchSubscription(false, false); // Background refresh only
        return;
      }
      if (!hasInitialized.current || lastUserIdRef.current !== userId) {
        hasInitialized.current = true;
        lastUserIdRef.current = userId;
        
        const cached = getCachedSubscription(userId);
        if (cached && !subscription) {
          setSubscription(cached);
          setLoading(false);
        }
        
        const hasCache = !!getCachedSubscription(userId);
        fetchSubscription(false, !hasCache);
      }
    } else if (status === 'unauthenticated') {
      // Only clear if we're definitely unauthenticated (not just loading)
      if (lastUserIdRef.current) {
        // Clear subscription data and cache for unauthenticated users
        setSubscription(null);
        setLoading(false);
        setError(null);
        hasInitialized.current = false;
        lastUserIdRef.current = null;
        clearCache(); // Clear cache on logout
      }
    }
  }, [session?.user?.id, status, fetchSubscription, clearCache, setCachedData, subscription]);

  // Refetch on window focus if cache is older than 30 minutes (less aggressive)
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user?.id) {
        const cached = getCachedData(session.user.id);
        if (cached) {
          const cacheAge = Date.now() - JSON.parse(localStorage.getItem(CACHE_KEY) || '{}').timestamp;
          if (cacheAge > 30 * 60 * 1000) { // 30 minutes
            fetchSubscription(true);
          }
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSubscription, getCachedData, session?.user?.id]);

  const refetch = useCallback(() => {
    clearCache();
    // Force refresh with loading indicator
    fetchSubscription(true, true);
  }, [fetchSubscription, clearCache]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refetch, clearCache }}>
      {/* Don't show loader - subscription loads in background during auth */}
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}