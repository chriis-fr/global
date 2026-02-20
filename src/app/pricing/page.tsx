'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from '@/lib/auth-client'
import { useRouter, useSearchParams } from 'next/navigation'
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
  UsersRound,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/landing/header'
import { BILLING_PLANS } from '@/data/billingPlans'
import { BillingPlan, PlanType, BillingPeriod } from '@/models/Billing'
import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { initializePaystackSubscription } from '@/lib/actions/paystack'
import { calculatePlanPrice, getDisplayPrice } from '@/lib/pricingEngine'
import { getOrganizationSeatInfo } from '@/lib/actions/organization'

export type PricingAudience = 'individual' | 'business'

const ORGANIZATION_SETTINGS_PATH = '/dashboard/settings/organization'

export default function PricingPage() {
  const { data: session } = useSession()
  const { subscription, refetch } = useSubscription()
  const router = useRouter()
  const searchParams = useSearchParams()
  const createOrg = searchParams?.get('createOrg') === 'true'
  const hasOrganization = Boolean(session?.user?.organizationId)
  // If user has an organization, automatically show business plans only
  const [audience, setAudience] = useState<PricingAudience>(hasOrganization ? 'business' : 'individual')
  const [selectedType, setSelectedType] = useState<PlanType>('receivables')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [seatsByPlanId, setSeatsByPlanId] = useState<Record<string, number>>({})
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [hasPendingOrgData, setHasPendingOrgData] = useState(false)
  const [currentPlanSeats, setCurrentPlanSeats] = useState<number | null>(null)

  const needsOrgForBusiness = audience === 'business' && session && !hasOrganization

  // Update audience to business if user has organization
  useEffect(() => {
    if (hasOrganization && audience === 'individual') {
      setAudience('business')
    }
  }, [hasOrganization, audience])

  // Check for pending organization data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem('pending_organization_data');
      setHasPendingOrgData(!!pending);
    }
  }, []);

  // Fetch current plan seats if user has organization
  useEffect(() => {
    const fetchCurrentSeats = async () => {
      if (hasOrganization && subscription?.plan?.planId) {
        try {
          const result = await getOrganizationSeatInfo();
          if (result.success && result.data) {
            setCurrentPlanSeats(result.data.paidSeats);
          }
        } catch (error) {
          console.error('Error fetching current plan seats:', error);
        }
      } else {
        setCurrentPlanSeats(null);
      }
    };

    fetchCurrentSeats();
  }, [hasOrganization, subscription?.plan?.planId]);

  // Clear pending org data if user navigates away without paying (cleanup on unmount or when they cancel)
  useEffect(() => {
    return () => {
      // Only clear if they're leaving pricing without a paid plan
      if (typeof window !== 'undefined' && createOrg) {
        const planId = subscription?.plan?.planId;
        const isPaidPlan = planId && planId !== 'receivables-free' && planId !== 'trial-premium';
        if (!isPaidPlan) {
          // User is leaving without paying - keep data for now, will expire after 1 hour
          // Or clear if they explicitly cancel - we'll handle that separately
        }
      }
    };
  }, [createOrg, subscription]);

  // If user has organization, only show business plans
  const effectiveAudience = hasOrganization ? 'business' : audience
  
  const plansForAudience = BILLING_PLANS.filter(plan => {
    const a = plan.audience ?? 'both'
    if (effectiveAudience === 'individual') return a === 'individual' || a === 'both'
    return a === 'business' || a === 'both'
  })
  // Filter plans based on audience and type
  // For individuals: only show growth tier (not scale or enterprise) for payables and combined
  const filteredPlans = plansForAudience.filter(plan => {
    if (plan.type !== selectedType) return false;
    
    // For individual users, exclude scale and enterprise tiers for payables and combined
    if (effectiveAudience === 'individual') {
      if (plan.type === 'payables' || plan.type === 'combined') {
        // Only show growth tier for individuals
        return plan.tier === 'growth';
      }
    }
    
    return true;
  })

  const getSeatsForPlan = (plan: BillingPlan) => {
    if (plan.dynamicPricing) {
      // If this is the current plan, default to current seats, otherwise use plan defaults
      const isCurrentPlan = session && subscription?.plan?.planId === plan.planId;
      if (isCurrentPlan && currentPlanSeats) {
        // Use current seats as default, but allow user to change
        return seatsByPlanId[plan.planId] ?? currentPlanSeats;
      }
      const defaultSeats = effectiveAudience === 'individual' ? 1 : (plan.dynamicPricing.includedSeats || 1)
      return seatsByPlanId[plan.planId] ?? defaultSeats
    }
    return 1
  }

  // Individual users should have single seat (no seat selector) for:
  // 1. receivables-growth-individual plan
  // 2. Any plan with audience === 'individual'
  // 3. Payables and combined plans (individuals only get 1 seat)
  const isIndividualSingleSeat = (plan: BillingPlan) => {
    if (effectiveAudience !== 'individual') return false;
    
    // Individual-specific receivables plan
    if (plan.planId === 'receivables-growth-individual' || plan.audience === 'individual') {
      return true;
    }
    
    // For payables and combined plans, individuals always get 1 seat
    if (plan.type === 'payables' || plan.type === 'combined') {
      return true;
    }
    
    return false;
  }

  const setSeatsForPlan = (planId: string, seats: number) => {
    setSeatsByPlanId(prev => ({ ...prev, [planId]: Math.max(1, Math.min(50, seats)) }))
  }

  const goToCreateOrganization = () => {
    router.push(`${ORGANIZATION_SETTINGS_PATH}?from=pricing`)
    setShowCreateOrgModal(false)
  }

  const handleSubscribe = async (plan: BillingPlan, seats?: number) => {
    if (plan.isEnterprise) {
      window.location.href = 'mailto:sales@globalsolutions.com?subject=Enterprise%20pricing%20inquiry'
      return
    }

    if (!session) {
      router.push('/auth')
      return
    }

    const planAudience = (plan as { audience?: string }).audience ?? 'both'
    // Only require organization for business-only plans (not 'both' or 'individual')
    const isBusinessOnlyPlan = planAudience === 'business'
    if (isBusinessOnlyPlan && !hasOrganization) {
      setShowCreateOrgModal(true)
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
              Start with a 15-day free trial. No credit card required for trial users.
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
                  <h2 className="text-2xl font-bold">15-Day Free Trial Active</h2>
                </div>
                <p className="text-lg opacity-90">
                  All features are available for free during the trial period. Subscriptions will be enabled soon.
                </p>
              </motion.div>
            )}

            {/* Pending Organization Creation Banner */}
            {createOrg && hasPendingOrgData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl p-6 max-w-4xl mx-auto"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Building2 className="h-6 w-6" />
                  <h2 className="text-2xl font-bold">Complete Your Organization Setup</h2>
                </div>
                <p className="text-lg opacity-90 text-center">
                  Your organization details are saved. Please subscribe to a paid plan to complete the organization creation. After payment, your organization will be created automatically.
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem('pending_organization_data');
                    setHasPendingOrgData(false);
                    router.push('/dashboard/settings/organization');
                  }}
                  className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                >
                  Cancel and return to organization settings
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Audience: For Individual vs For Business & Teams */}
      {/* Hide audience selector if user has an organization - show only business plans */}
      {!hasOrganization && (
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
      )}

      {/* Show organization plans header if user has organization */}
      {hasOrganization && (
        <div className="bg-blue-50 py-6 border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-3">
              <Building2 className="h-6 w-6 text-blue-600" />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Organization Plans</h2>
                <p className="text-sm text-gray-600 mt-1">Choose a plan for your organization</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual user on Business plans: must create organisation first */}
      {needsOrgForBusiness && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">Create an organisation first</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Team and business plans are billed per organisation. Create an organisation to choose seats and complete billing.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={goToCreateOrganization}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                  Create organisation
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('individual')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <User className="h-4 w-4" />
                  Continue with individual plans
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Plan Type Selector – Available for both Individual and Business */}
      <div className="bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {(['receivables', 'payables', 'combined'] as PlanType[]).map((type) => {
              return (
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
              );
            })}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {effectiveAudience === 'individual' && (
            <p className="text-center text-gray-600 mb-8 max-w-xl mx-auto">
              Invoicing for you — one seat, full features. Upgrade to Growth for real-time reconciliation, API access, and more.
            </p>
          )}
          <div className={`grid gap-6 mx-auto ${effectiveAudience === 'individual' ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl'}`}>
            {filteredPlans.map((plan) => {
              const isCurrentPlan = session && subscription?.plan?.planId === plan.planId;
              return (
                <PlanCard
                  key={plan.planId}
                  plan={plan}
                  billingPeriod={billingPeriod}
                  seats={getSeatsForPlan(plan)}
                  onSeatsChange={!isIndividualSingleSeat(plan) && plan.dynamicPricing ? (s) => setSeatsForPlan(plan.planId, s) : undefined}
                  onSubscribe={handleSubscribe}
                  loading={loading === plan.planId}
                  isCurrentPlan={isCurrentPlan ? true : undefined}
                  hideSeatSelector={isIndividualSingleSeat(plan)}
                  currentPlanSeats={isCurrentPlan ? currentPlanSeats : undefined}
                  allowSeatUpgrade={isCurrentPlan && plan.dynamicPricing ? true : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Create organisation before purchasing team plan */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="create-org-modal-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 id="create-org-modal-title" className="text-lg font-semibold text-gray-900">Organisation required</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Team plans are billed per organisation. Create an organisation first, then return here to choose your plan and number of seats.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateOrgModal(false)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={goToCreateOrganization}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                <Building2 className="h-4 w-4" />
                Go to Create organisation
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
  hideSeatSelector = false,
  currentPlanSeats,
  allowSeatUpgrade
}: {
  plan: BillingPlan
  billingPeriod: BillingPeriod
  seats: number
  onSeatsChange?: (seats: number) => void
  onSubscribe: (plan: BillingPlan, seats?: number) => void
  loading: boolean
  isCurrentPlan?: boolean
  hideSeatSelector?: boolean
  currentPlanSeats?: number | null
  allowSeatUpgrade?: boolean
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
            {isCurrentPlan && currentPlanSeats && seats > currentPlanSeats && (
              <span className="text-xs text-blue-600 font-medium">+{seats - currentPlanSeats} more</span>
            )}
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
        {plan.features.map((feature) => {
          // For individual users, update seat-related feature wording
          let displayName = feature.name;
          let displayDescription = feature.description;
          
          if (hideSeatSelector && feature.id === 'seats') {
            // Individual users: show "1 seat" instead of "X seats included"
            displayName = '1 seat';
            displayDescription = 'Individual account';
          } else if (hideSeatSelector && feature.id === 'integrations') {
            // Individual users: update integrations description (remove "team" reference)
            displayDescription = 'Connect your tools';
          } else if (hideSeatSelector && feature.id === 'receivables-payables') {
            // Individual users: keep the same but ensure description is appropriate
            displayDescription = 'Full suite for your account';
          }
          
          return (
            <div key={feature.id} className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {feature.included ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className="text-gray-600 text-sm">
                <span className="font-medium">{displayName}</span>
                {displayDescription && (
                  <span className="block text-xs opacity-80">{displayDescription}</span>
                )}
              </div>
            </div>
          );
        })}
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
          disabled={loading || (isCurrentPlan && !allowSeatUpgrade) || (isCurrentPlan && allowSeatUpgrade && currentPlanSeats !== null && currentPlanSeats !== undefined && seats <= currentPlanSeats)}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            isCurrentPlan && allowSeatUpgrade && currentPlanSeats !== null && currentPlanSeats !== undefined && seats > currentPlanSeats
              ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
              : isCurrentPlan && (!allowSeatUpgrade || (currentPlanSeats !== null && currentPlanSeats !== undefined && seats <= currentPlanSeats))
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
          ) : isCurrentPlan && allowSeatUpgrade && currentPlanSeats !== null && currentPlanSeats !== undefined && seats > currentPlanSeats ? (
            <>
              <Users className="h-4 w-4" />
              <span>Upgrade to {seats} Seats</span>
            </>
          ) : isCurrentPlan ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>
                Current Plan
                {currentPlanSeats && plan.dynamicPricing && (
                  <span className="ml-1 text-xs opacity-90">({currentPlanSeats} seat{currentPlanSeats === 1 ? '' : 's'})</span>
                )}
              </span>
            </>
          ) : (
            plan.ctaText
          )}
        </button>
      )}
    </div>
  )
} 