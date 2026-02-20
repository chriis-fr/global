'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import {
  Check,
  X,
  Star,
  Zap,
  Building2,
  CreditCard,
  Loader2,
  CheckCircle,
  Users,
  User,
  UsersRound
} from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/landing/header'
import { BILLING_PLANS } from '@/data/billingPlans'
import { BillingPlan, PlanType, BillingPeriod } from '@/models/Billing'
import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { initializePaystackSubscription } from '@/lib/actions/paystack'
import { calculatePlanPrice, getDisplayPrice } from '@/lib/pricingEngine'

export type PricingAudience = 'individual' | 'business'

export default function PricingPage() {
  const { data: session } = useSession()
  const { subscription, refetch } = useSubscription()
  const router = useRouter()
  const [audience, setAudience] = useState<PricingAudience>('individual')
  const [selectedType, setSelectedType] = useState<PlanType>('receivables')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [seatsByPlanId, setSeatsByPlanId] = useState<Record<string, number>>({})

  const plansForAudience = BILLING_PLANS.filter(plan => {
    const a = plan.audience ?? 'both'
    if (audience === 'individual') return a === 'individual' || a === 'both'
    return a === 'business' || a === 'both'
  })
  const filteredPlans = audience === 'individual'
    ? plansForAudience.filter(plan => plan.type === 'receivables')
    : plansForAudience.filter(plan => plan.type === selectedType)

  const getSeatsForPlan = (plan: BillingPlan) => {
    if (plan.dynamicPricing) {
      const defaultSeats = audience === 'individual' ? 1 : (plan.dynamicPricing.includedSeats || 1)
      return seatsByPlanId[plan.planId] ?? defaultSeats
    }
    return 1
  }

  const isIndividualSingleSeat = (plan: BillingPlan) =>
    audience === 'individual' && (plan.planId === 'receivables-growth-individual' || plan.audience === 'individual')

  const setSeatsForPlan = (planId: string, seats: number) => {
    setSeatsByPlanId(prev => ({ ...prev, [planId]: Math.max(1, Math.min(50, seats)) }))
  }

  const handleSubscribe = async (plan: BillingPlan, seats?: number) => {
    if (plan.isEnterprise) {
      window.location.href = 'mailto:sales@globalsolutions.com?subject=Enterprise%20pricing%20inquiry'
      return
    }

    console.log('🚀 [Pricing] Starting subscription process:', {
      planId: plan.planId,
      planName: plan.name,
      billingPeriod,
      seats,
      userEmail: session?.user?.email,
      userId: session?.user?.id
    })

    if (!session) {
      router.push('/auth')
      return
    }

    setLoading(plan.planId)
    try {
      const result = await initializePaystackSubscription(plan.planId, billingPeriod, {
        seats: plan.dynamicPricing ? (seats ?? getSeatsForPlan(plan)) : undefined
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize subscription')
      }

      if (plan.planId === 'receivables-free') {
        refetch()
        setTimeout(() => router.push('/dashboard'), 500)
        return
      }

      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl
      } else {
        throw new Error('No authorization URL received from Paystack')
      }
    } catch (error) {
      console.error('❌ [Pricing] Error initializing subscription:', error)
      alert(error instanceof Error ? error.message : 'Failed to start checkout process. Please try again.')
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
              Start with a 30-day free trial. No credit card required for trial users.
            </motion.p>

            {/* Production Environment Banner */}
            {process.env.NODE_ENV === 'production' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl p-6 max-w-4xl mx-auto"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <CheckCircle className="h-6 w-6" />
                  <h2 className="text-2xl font-bold">30-Day Free Trial Active</h2>
                </div>
                <p className="text-lg opacity-90">
                  All features are available for free during the trial period. Subscriptions will be enabled soon.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Audience: For Individual vs For Business & Teams */}
      <div className="bg-white py-8 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600 mb-4">Choose your plan type</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setAudience('individual')}
              className={`flex items-center justify-center gap-3 px-8 py-5 rounded-xl border-2 transition-all ${audience === 'individual'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
            >
              <User className="h-7 w-7" />
              <div className="text-left">
                <div className="font-semibold">For Individual</div>
                <div className="text-sm opacity-80">Solo invoicer · One seat · Just you</div>
              </div>
            </button>
            <button
              onClick={() => setAudience('business')}
              className={`flex items-center justify-center gap-3 px-8 py-5 rounded-xl border-2 transition-all ${audience === 'business'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
            >
              <UsersRound className="h-7 w-7" />
              <div className="text-left">
                <div className="font-semibold">For growing business & Teams</div>
                <div className="text-sm opacity-80">Organisations · Integrations · Multi-seat</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Billing Period Toggle */}
      <div className="bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'yearly'
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

      {/* Plan Type Selector – only for Business & Teams */}
      {audience === 'business' && (
        <div className="bg-white py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {(['receivables', 'payables', 'combined'] as PlanType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${selectedType === type
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
      )}

      {/* Plans Grid */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {audience === 'individual' && (
            <p className="text-center text-gray-600 mb-8 max-w-xl mx-auto">
              Invoicing for you — one seat, full features. Upgrade to Growth for real-time reconciliation, API access, and more.
            </p>
          )}
          <div className={`grid gap-6 mx-auto ${audience === 'individual' ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl'}`}>
            {filteredPlans.map((plan) => (
              <PlanCard
                key={plan.planId}
                plan={plan}
                billingPeriod={billingPeriod}
                seats={getSeatsForPlan(plan)}
                onSeatsChange={!isIndividualSingleSeat(plan) && plan.dynamicPricing ? (s) => setSeatsForPlan(plan.planId, s) : undefined}
                onSubscribe={handleSubscribe}
                loading={loading === plan.planId}
                isCurrentPlan={session && subscription?.plan?.planId === plan.planId ? true : undefined}
                hideSeatSelector={isIndividualSingleSeat(plan)}
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
            <p className="text-gray-600">We accept all major credit cards through our secure payment system.</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function PlanCard({
  plan,
  billingPeriod,
  seats,
  onSeatsChange,
  onSubscribe,
  loading,
  isCurrentPlan,
  hideSeatSelector = false
}: {
  plan: BillingPlan
  billingPeriod: BillingPeriod
  seats: number
  onSeatsChange?: (seats: number) => void
  onSubscribe: (plan: BillingPlan, seats?: number) => void
  loading: boolean
  isCurrentPlan?: boolean
  hideSeatSelector?: boolean
}) {
  const isEnterprise = plan.isEnterprise
  const calculated = useMemo(() => {
    if (isEnterprise) return null
    return calculatePlanPrice(plan, billingPeriod, seats)
  }, [plan, billingPeriod, seats, isEnterprise])

  const displayPrice = getDisplayPrice(plan)
  const priceLabel = isEnterprise
    ? 'Custom'
    : calculated
      ? billingPeriod === 'yearly'
        ? `$${calculated.totalYearly.toFixed(0)}/year`
        : `$${calculated.totalMonthly.toFixed(2)}/month`
      : displayPrice
        ? `$${displayPrice.monthly}/month`
        : '—'

  return (
    <div className={`relative bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg ${plan.popular ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-gray-200'
      } ${isCurrentPlan ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-blue-500 text-white px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
            <Star className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-3">
          <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Current
          </span>
        </div>
      )}

      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
        <p className="text-gray-600 text-sm mb-3">{plan.description}</p>

        {plan.dynamicPricing && !isEnterprise && !hideSeatSelector && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Seats:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={seats}
              onChange={(e) => onSeatsChange?.(parseInt(e.target.value, 10) || 1)}
              className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-sm"
            />
          </div>
        )}
        {hideSeatSelector && (
          <div className="text-sm text-gray-600 mb-2">1 seat · Individual account</div>
        )}

        <div className="mb-2">
          <span className="text-2xl font-bold text-gray-900">{priceLabel}</span>
          {billingPeriod === 'yearly' && calculated && !isEnterprise && (
            <div className="text-xs text-green-600 mt-0.5">
              ${(calculated.totalYearly / 12).toFixed(2)}/mo billed yearly
            </div>
          )}
          {plan.dynamicPricing && !isEnterprise && !hideSeatSelector && (
            <div className="text-xs text-gray-500 mt-0.5">
              {plan.dynamicPricing.includedSeats > 0
                ? `$${plan.dynamicPricing.seatPrice}/seat after ${plan.dynamicPricing.includedSeats} included`
                : `$${plan.dynamicPricing.seatPrice}/seat`}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
        {plan.features.map((feature) => (
          <div key={feature.id} className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {feature.included ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-400" />
              )}
            </div>
            <div className="text-gray-600 text-sm">
              <span className="font-medium">{feature.name}</span>
              {feature.description && (
                <span className="block text-xs opacity-80">{feature.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isEnterprise ? (
        <a
          href="mailto:sales@globalsolutions.com?subject=Enterprise%20pricing%20inquiry"
          className="w-full py-3 px-4 rounded-xl font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          Contact Sales
        </a>
      ) : (
        <button
          onClick={() => onSubscribe(plan, plan.dynamicPricing ? seats : undefined)}
          disabled={loading || isCurrentPlan}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${isCurrentPlan
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
      )}
    </div>
  )
} 