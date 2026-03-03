'use client'

import { useState } from 'react'
import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { useRouter } from 'next/navigation'
import { Clock, Crown, X, Sparkles } from 'lucide-react'

const TRIAL_ENDED_DISMISS_KEY = 'trial_ended_banner_dismissed'

export function TrialBanner() {
  const { subscription, loading } = useSubscription()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(TRIAL_ENDED_DISMISS_KEY) === '1' : false
  )

  if (loading || !subscription) return null

  const planId = subscription.plan?.planId
  const isTrialActive = subscription.isTrialActive
  const trialEnded = planId === 'trial-premium' && !isTrialActive
  const orgReadOnlyTrialEnd = subscription.orgReadOnlyDueToTrialEnd === true
  const orgReadOnlyOverdue = subscription.orgReadOnlyDueToOverdue === true
  const orgReadOnly = orgReadOnlyTrialEnd || orgReadOnlyOverdue

  const handleUpgrade = () => {
    router.push('/pricing')
  }

  const dismissTrialEnded = () => {
    if (orgReadOnly) return // Do not allow dismissing for org read-only
    setDismissed(true)
    try {
      sessionStorage.setItem(TRIAL_ENDED_DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  // Organization: subscription overdue (past_due or 3+ days past period) → show "update subscription"
  if (orgReadOnlyOverdue) {
    return (
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-6 w-6 text-amber-100 shrink-0" />
            <div>
              <h3 className="font-semibold">Update your subscription</h3>
              <p className="text-sm opacity-95">
                Your subscription is overdue. You can view your data only; create and edit actions are disabled until you update your subscription payment.
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-white text-orange-600 px-5 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors flex items-center gap-2 shrink-0"
          >
            <Crown className="h-4 w-4" />
            <span>Update subscription</span>
          </button>
        </div>
      </div>
    )
  }

  // Organization: trial ended → view-only until they pay (non-dismissible, clear CTA)
  if (orgReadOnlyTrialEnd) {
    return (
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-6 w-6 text-amber-100 shrink-0" />
            <div>
              <h3 className="font-semibold">Trial ended — upgrade to continue</h3>
              <p className="text-sm opacity-95">
                Organization accounts require a paid plan. You can view your data only; create and edit actions are disabled until you upgrade.
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-white text-orange-600 px-5 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors flex items-center gap-2 shrink-0"
          >
            <Crown className="h-4 w-4" />
            <span>Upgrade to paid plan</span>
          </button>
        </div>
      </div>
    )
  }

  // Trial ended (individual): non-blocking reminder (dismissible)
  if (trialEnded && !dismissed) {
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 shadow-lg relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between pr-8">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-6 w-6 text-amber-100" />
            <div>
              <h3 className="font-semibold">Your trial has ended</h3>
              <p className="text-sm opacity-95">
                Upgrade to keep full access and your team. You can continue using the app — upgrade when you&apos;re ready.
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-white text-orange-600 px-5 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors flex items-center gap-2 shrink-0"
          >
            <Crown className="h-4 w-4" />
            <span>Upgrade</span>
          </button>
        </div>
        <button
          type="button"
          onClick={dismissTrialEnded}
          className="absolute top-3 right-3 p-1 rounded hover:bg-white/20 text-white/90"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    )
  }

  // Trial active
  if (!isTrialActive) return null

  return (
    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Trial Period Active</h3>
            <p className="text-sm opacity-90">
              {subscription.trialDaysRemaining} days remaining in your free trial
            </p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2"
        >
          <Crown className="h-4 w-4" />
          <span>Upgrade Now</span>
        </button>
      </div>
    </div>
  )
}
