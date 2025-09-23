'use client'

import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { useRouter } from 'next/navigation'
import { Clock, Crown } from 'lucide-react'

export function TrialBanner() {
  const { subscription, loading } = useSubscription()
  const router = useRouter()

  if (loading || !subscription || !subscription.isTrialActive) {
    return null
  }

  const handleUpgrade = () => {
    router.push('/pricing')
  }

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
