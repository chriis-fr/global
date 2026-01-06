'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { getUserSubscription, SubscriptionData } from '@/lib/actions/subscription';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  // Initialize with cached data if available to avoid loading state
  const cachedSubscription = session?.user?.id ? getCachedSubscription(session.user.id) : null;
  const [subscription, setSubscription] = useState<SubscriptionData | null>(cachedSubscription);
  const [loading, setLoading] = useState(!cachedSubscription && status === 'loading');
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Check if we're on the landing page - don't show loader there
  const isLandingPage = pathname === '/';

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

  useEffect(() => {
    const userId = session?.user?.id;
    
    // Start fetching subscription as soon as we have a session, even during loading phase
    // This ensures subscription is ready by the time dashboard loads
    if (userId) {
      // Check if we need to initialize for this user
      if (!hasInitialized.current || lastUserIdRef.current !== userId) {
        hasInitialized.current = true;
        lastUserIdRef.current = userId;
        
        // Check cache first
        const cached = getCachedSubscription(userId);
        if (cached) {
          // We have cache, use it immediately
          setSubscription(cached);
          setLoading(false);
          // Refresh in background silently (happens during auth loading phase)
          fetchSubscription(false, false);
        } else {
          // No cache, fetch immediately (happens during auth loading phase)
          // This runs in parallel with authentication, so it's ready when dashboard loads
          fetchSubscription(false, false);
        }
      }
    } else if (status === 'unauthenticated') {
      // Clear subscription data and cache for unauthenticated users
      setSubscription(null);
      setLoading(false);
      setError(null);
      hasInitialized.current = false;
      lastUserIdRef.current = null;
      clearCache(); // Clear cache on logout
    }
  }, [session?.user?.id, status, fetchSubscription, clearCache]);

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
    fetchSubscription(true);
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