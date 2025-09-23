'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { BillingPlan } from '@/models/Billing'

interface SubscriptionData {
  plan: BillingPlan | null
  status: 'trial' | 'active' | 'cancelled' | 'expired'
  isTrialActive: boolean
  trialDaysRemaining: number
  usage: {
    invoicesThisMonth: number
    monthlyVolume: number
  }
  canCreateOrganization: boolean
  canAccessPayables: boolean
  canCreateInvoice: boolean
  canUseAdvancedFeatures: boolean
  limits: {
    invoicesPerMonth: number
    monthlyVolume: number
    cryptoToCryptoFee: number
  }
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null
  loading: boolean
  error: string | null
  refreshSubscription: () => Promise<void>
  checkFeatureAccess: (feature: string) => boolean
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

interface SubscriptionProviderProps {
  children: ReactNode
}

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { data: session, status } = useSession()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(false) // Start with false to not block UI
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  const fetchSubscription = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    // Check cache first
    const now = Date.now()
    if (!forceRefresh && subscription && (now - lastFetch) < CACHE_DURATION) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch('/api/billing/current', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data')
      }

      const data = await response.json()
      
      if (data.success) {
        setSubscription(data.data)
        setLastFetch(now)
      } else {
        throw new Error(data.error || 'Failed to fetch subscription')
      }
    } catch (err) {
      console.error('Error fetching subscription:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Don't block UI on subscription fetch errors
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, subscription, lastFetch])

  const refreshSubscription = useCallback(async () => {
    await fetchSubscription(true)
  }, [fetchSubscription])

  const checkFeatureAccess = useCallback((feature: string): boolean => {
    if (!subscription) return true // Allow access by default if subscription not loaded yet
    return subscription[feature as keyof SubscriptionData] as boolean
  }, [subscription])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      // Delay subscription fetch to not block initial page load
      const timer = setTimeout(() => {
        fetchSubscription()
      }, 1000) // 1 second delay
      
      return () => clearTimeout(timer)
    } else if (status === 'unauthenticated') {
      setSubscription(null)
      setLoading(false)
    }
  }, [session, status, fetchSubscription])

  // Refresh subscription every 10 minutes
  useEffect(() => {
    if (!session?.user?.id) return

    const interval = setInterval(() => {
      fetchSubscription()
    }, CACHE_DURATION)

    return () => clearInterval(interval)
  }, [session?.user?.id, fetchSubscription])

  const value: SubscriptionContextType = {
    subscription,
    loading,
    error,
    refreshSubscription,
    checkFeatureAccess,
  }

  return (
    <SubscriptionContext.Provider value={value}>
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