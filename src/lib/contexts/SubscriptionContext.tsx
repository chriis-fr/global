'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getUserSubscription, SubscriptionData } from '@/lib/actions/subscription';

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Check if we have recent cached data
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION) {
      console.log('📦 [SubscriptionContext] Using cached subscription data');
      setLoading(false);
      return;
    }

    console.log('🔄 [SubscriptionContext] Fetching subscription data via server action...');
    setLoading(true);
    setError(null);

    try {
      const subscriptionData = await getUserSubscription();
      
      if (subscriptionData) {
        setSubscription(subscriptionData);
        setLastFetch(now);
        console.log('✅ [SubscriptionContext] Subscription data received:', subscriptionData);
      } else {
        throw new Error('Failed to fetch subscription data');
      }
    } catch (err) {
      console.error('❌ [SubscriptionContext] Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      
      // Provide fallback subscription for free plan users
      if (session?.user?.id) {
        console.log('🔄 [SubscriptionContext] Providing fallback free plan subscription');
        setSubscription({
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
        });
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, lastFetch]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Refetch on window focus if cache is older than 30 minutes
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetch > 30 * 60 * 1000) { // 30 minutes
        console.log('🔄 [SubscriptionContext] Window focused, refetching subscription data');
        fetchSubscription();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSubscription, lastFetch]);

  const refetch = useCallback(() => {
    setLastFetch(0); // Reset cache to force refetch
    fetchSubscription();
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refetch }}>
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