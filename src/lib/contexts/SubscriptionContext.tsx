'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getUserSubscription, SubscriptionData } from '@/lib/actions/subscription';

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  clearCache: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const CACHE_KEY = 'subscription_cache';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCachedData = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < CACHE_DURATION) {
          console.log('📦 [SubscriptionContext] Using cached subscription data');
          return data;
        } else {
          console.log('⏰ [SubscriptionContext] Cache expired, removing');
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.error('❌ [SubscriptionContext] Error reading cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
    
    return null;
  }, []);

  const setCachedData = useCallback((data: SubscriptionData | null) => {
    if (typeof window === 'undefined') return;
    
    try {
      if (data) {
        const cacheData = {
          data,
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log('💾 [SubscriptionContext] Subscription data cached');
      } else {
        // Clear cache for organization members or when no subscription data
        localStorage.removeItem(CACHE_KEY);
        console.log('🗑️ [SubscriptionContext] Cache cleared for organization member');
      }
    } catch (error) {
      console.error('❌ [SubscriptionContext] Error caching data:', error);
    }
  }, []);

  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ [SubscriptionContext] Cache cleared');
  }, []);

  const fetchSubscription = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setSubscription(cachedData);
        setLoading(false);
        return;
      }
    }

    console.log('🔄 [SubscriptionContext] Fetching subscription data via server action...');
    setLoading(true);
    setError(null);

    try {
      const subscriptionData = await getUserSubscription();
      
      if (subscriptionData) {
        setSubscription(subscriptionData);
        setCachedData(subscriptionData);
        console.log('✅ [SubscriptionContext] Subscription data received and cached:', {
          planId: subscriptionData.plan?.planId,
          status: subscriptionData.status,
          canCreateInvoice: subscriptionData.canCreateInvoice,
          canAccessPayables: subscriptionData.canAccessPayables
        });
      } else {
        console.log('⚠️ [SubscriptionContext] No subscription data returned, user may be organization member or not exist in database yet');
        // Don't throw error, just set loading to false and let the fallback handle it
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('❌ [SubscriptionContext] Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      
      // Only provide fallback subscription for individual users, not organization members
      if (session?.user?.id) {
        console.log('🔄 [SubscriptionContext] Checking if user is organization member before providing fallback');
        
        // Check if user is an organization member by making a quick API call
        try {
          const orgResponse = await fetch('/api/organization');
          const orgData = await orgResponse.json();
          
          if (orgData.success && orgData.data.hasOrganization) {
            console.log('🏢 [SubscriptionContext] User is organization member, not providing individual fallback subscription');
            // Organization members should not have individual subscriptions
            setSubscription(null);
            setCachedData(null);
          } else {
            console.log('🔄 [SubscriptionContext] User is individual, providing fallback free plan subscription');
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
            setCachedData(fallbackData);
          }
        } catch (orgError) {
          console.error('❌ [SubscriptionContext] Error checking organization status:', orgError);
          // Fallback to individual subscription if we can't check organization status
          console.log('🔄 [SubscriptionContext] Providing fallback free plan subscription due to error');
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
          setCachedData(fallbackData);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, getCachedData, setCachedData]);

  useEffect(() => {
    // Only fetch subscription if user is authenticated
    if (session?.user?.id) {
      fetchSubscription();
    } else {
      // Clear subscription data for unauthenticated users
      setSubscription(null);
      setLoading(false);
      setError(null);
    }
  }, [session?.user?.id, fetchSubscription]);

  // Refetch on window focus if cache is older than 10 minutes
  useEffect(() => {
    const handleFocus = () => {
      const cached = getCachedData();
      if (cached) {
        const cacheAge = Date.now() - JSON.parse(localStorage.getItem(CACHE_KEY) || '{}').timestamp;
        if (cacheAge > 10 * 60 * 1000) { // 10 minutes
          console.log('🔄 [SubscriptionContext] Window focused, cache is stale, refetching');
          fetchSubscription(true);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSubscription, getCachedData]);

  const refetch = useCallback(() => {
    console.log('🔄 [SubscriptionContext] Manual refetch requested - clearing cache and fetching fresh data');
    clearCache();
    fetchSubscription(true);
  }, [fetchSubscription, clearCache]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refetch, clearCache }}>
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