'use client';

import { useState } from 'react';
import { Check, X, Star, Zap, Building2, CreditCard } from 'lucide-react';
import { BILLING_PLANS } from '@/data/billingPlans';
import { BillingPlan, PlanType, BillingPeriod } from '@/models/Billing';

export default function BillingPage() {
  const [selectedType, setSelectedType] = useState<PlanType>('receivables');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const filteredPlans = BILLING_PLANS.filter(plan => plan.type === selectedType);

  const getTypeIcon = (type: PlanType) => {
    switch (type) {
      case 'receivables': return <CreditCard className="h-6 w-6" />;
      case 'payables': return <Building2 className="h-6 w-6" />;
      case 'combined': return <Zap className="h-6 w-6" />;
    }
  };

  const getTypeDescription = (type: PlanType) => {
    switch (type) {
      case 'receivables': return 'Manage your incoming payments and invoices';
      case 'payables': return 'Handle your outgoing payments and bills';
      case 'combined': return 'Complete receivables and payables solution';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-blue-200 mb-8">
            Select the perfect plan for your business needs
          </p>
          
          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-blue-800/50 rounded-lg p-1 flex">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-blue-900'
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-blue-900'
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                Yearly <span className="text-xs bg-green-500 text-white px-1 rounded ml-1">Save 17%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Plan Type Selector */}
        <div className="flex flex-col sm:flex-row gap-4 mb-12 justify-center">
          {(['receivables', 'payables', 'combined'] as PlanType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
                selectedType === type
                  ? 'border-white bg-white/10 text-white'
                  : 'border-blue-600/50 bg-blue-800/30 text-blue-200 hover:border-blue-400 hover:bg-blue-700/40'
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

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {filteredPlans.map((plan) => (
            <PlanCard key={plan.planId} plan={plan} billingPeriod={billingPeriod} />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-4 text-blue-200">
            <div className="bg-blue-800/30 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">Can I change plans anytime?</h3>
              <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="bg-blue-800/30 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">What happens if I exceed my limits?</h3>
              <p>We&apos;ll notify you when you&apos;re approaching your limits. You can upgrade your plan or pay overage fees.</p>
            </div>
            <div className="bg-blue-800/30 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">Do you offer refunds?</h3>
              <p>We offer a 30-day money-back guarantee for all paid plans.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, billingPeriod }: { plan: BillingPlan; billingPeriod: BillingPeriod }) {
  const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent = billingPeriod === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;

  return (
    <div className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 transition-all hover:scale-105 ${
      plan.popular ? 'border-yellow-400 shadow-2xl shadow-yellow-400/20' : 'border-blue-600/50'
    }`}>
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
            <Star className="h-4 w-4" />
            Most Popular
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
        <p className="text-blue-200 mb-4">{plan.description}</p>
        
        <div className="mb-4">
          <span className="text-4xl font-bold text-white">${price}</span>
          <span className="text-blue-200 ml-2">
            /{billingPeriod === 'yearly' ? 'year' : 'month'}
          </span>
          {billingPeriod === 'yearly' && (
            <div className="text-sm text-green-400 mt-1">
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
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <X className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="text-blue-200">
              <div className="font-medium">{feature.name}</div>
              {feature.description && (
                <div className="text-sm opacity-80">{feature.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
          plan.ctaVariant === 'primary'
            ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
            : plan.ctaVariant === 'secondary'
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'border-2 border-white text-white hover:bg-white hover:text-blue-900'
        }`}
      >
        {plan.ctaText}
      </button>
    </div>
  );
}
