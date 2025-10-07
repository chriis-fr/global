'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Check, 
  X,
  Star,
  Zap,
  Building2,
  CreditCard,
  Loader2,
  CheckCircle
} from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/landing/header'
import { BILLING_PLANS } from '@/data/billingPlans'
import { BillingPlan, PlanType, BillingPeriod } from '@/models/Billing'
import { useSubscription } from '@/lib/contexts/SubscriptionContext'

export default function PricingPage() {
  const { data: session } = useSession()
  const { subscription } = useSubscription()
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<PlanType>('receivables')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const filteredPlans = BILLING_PLANS.filter(plan => plan.type === selectedType)

  const handleSubscribe = async (plan: BillingPlan) => {
    console.log('🚀 [Pricing] Starting subscription process:', {
      planId: plan.planId,
      planName: plan.name,
      billingPeriod,
      userEmail: session?.user?.email,
      userId: session?.user?.id
    })

    if (!session) {
      console.log('❌ [Pricing] User not authenticated, redirecting to auth')
      router.push('/auth')
      return
    }

    if (plan.planId === 'receivables-free') {
      console.log('✅ [Pricing] Free plan selected, redirecting to dashboard')
      router.push('/dashboard')
      return
    }

    setLoading(plan.planId)
    console.log('⏳ [Pricing] Creating checkout session...')

    try {
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.planId,
          billingPeriod,
        }),
      })

      console.log('📡 [Pricing] Checkout session response:', {
        status: response.status,
        statusText: response.statusText
      })

      const data = await response.json()
      console.log('📦 [Pricing] Checkout session data:', data)

      if (data.success && data.checkoutUrl) {
        console.log('✅ [Pricing] Checkout session created successfully, redirecting to:', data.checkoutUrl)
        window.location.href = data.checkoutUrl
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('❌ [Pricing] Error creating checkout session:', error)
      alert('Failed to start checkout process. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const getTypeIcon = (type: PlanType) => {
    switch (type) {
      case 'receivables': return <CreditCard className="h-6 w-6" />
      case 'payables': return <Building2 className="h-6 w-6" />
      case 'combined': return <Zap className="h-6 w-6" />
    }
  }

  const getTypeDescription = (type: PlanType) => {
    switch (type) {
      case 'receivables': return 'Manage your incoming payments and invoices'
      case 'payables': return 'Handle your outgoing payments and bills'
      case 'combined': return 'Complete receivables and payables solution'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <div className="pt-16 bg-gradient-to-br from-blue-900 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-6"
            >
              <Image
                src="/chainsnobg.png"
                alt="Global Solutions"
                width={80}
                height={80}
                className="bg-white rounded-xl"
              />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold mb-6"
            >
              Choose Your Perfect Plan
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-blue-100 max-w-3xl mx-auto"
            >
              Start with a 10-day free trial. No credit card required for trial users.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Billing Period Toggle */}
      <div className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly <span className="text-xs bg-green-500 text-white px-1 rounded ml-1">Save 17%</span>
              </button>
                  </div>
                    </div>
                    </div>
                  </div>
                  
      {/* Plan Type Selector */}
      <div className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {(['receivables', 'payables', 'combined'] as PlanType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
                  selectedType === type
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {getTypeIcon(type)}
                <div className="text-left">
                  <div className="font-semibold capitalize">{type}</div>
                  <div className="text-sm opacity-80">{getTypeDescription(type)}</div>
                </div>
              </button>
            ))}
                    </div>
                  </div>
                </div>

      {/* Plans Grid */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {filteredPlans.map((plan) => (
              <PlanCard 
                key={plan.planId} 
                plan={plan} 
                billingPeriod={billingPeriod}
                onSubscribe={handleSubscribe}
                loading={loading === plan.planId}
                isCurrentPlan={session && subscription?.plan?.planId === plan.planId ? true : undefined}
              />
            ))}
                  </div>
                </div>
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h3>
              <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">What happens if I exceed my limits?</h3>
            <p className="text-gray-600">We&apos;ll notify you when you&apos;re approaching your limits. You can upgrade your plan or pay overage fees.</p>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">Can I create organizations on free plan?</h3>
            <p className="text-gray-600">No, organization creation requires a paid plan. Upgrade to Pro to create teams and organizations.</p>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
            <p className="text-gray-600">We accept all major credit cards through our secure Stripe payment system.</p>
            </div>
          </div>
        </motion.div>
    </div>
  )
}

function PlanCard({ 
  plan, 
  billingPeriod, 
  onSubscribe, 
  loading,
  isCurrentPlan
}: { 
  plan: BillingPlan
  billingPeriod: BillingPeriod
  onSubscribe: (plan: BillingPlan) => void
  loading: boolean
  isCurrentPlan?: boolean
}) {
  const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
  const monthlyEquivalent = billingPeriod === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice

  return (
    <div className={`relative bg-white rounded-2xl p-8 border-2 transition-all hover:scale-105 ${
      plan.popular ? 'border-blue-500 shadow-2xl shadow-blue-500/20' : 'border-gray-200'
    } ${isCurrentPlan ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
            <Star className="h-4 w-4" />
            Most Popular
          </div>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-4 right-4">
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Current
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
        <p className="text-gray-600 mb-4">{plan.description}</p>
        
        <div className="mb-4">
          <span className="text-4xl font-bold text-gray-900">${price}</span>
          <span className="text-gray-600 ml-2">
            /{billingPeriod === 'yearly' ? 'year' : 'month'}
          </span>
          {billingPeriod === 'yearly' && (
            <div className="text-sm text-green-600 mt-1">
              ${monthlyEquivalent.toFixed(2)}/month
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {plan.features.map((feature) => (
          <div key={feature.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {feature.included ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="text-gray-600">
              <div className="font-medium">{feature.name}</div>
              {feature.description && (
                <div className="text-sm opacity-80">{feature.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubscribe(plan)}
        disabled={loading || isCurrentPlan}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? 'bg-green-100 text-green-700 cursor-not-allowed'
            : plan.ctaVariant === 'primary'
            ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
            : plan.ctaVariant === 'secondary'
            ? 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400'
            : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : isCurrentPlan ? (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Current Plan</span>
          </>
        ) : (
          plan.ctaText
        )}
            </button>
    </div>
  )
} 