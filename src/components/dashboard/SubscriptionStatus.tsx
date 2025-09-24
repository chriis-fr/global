'use client';

import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { useRouter } from 'next/navigation';
import { Crown, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SubscriptionStatus() {
  const { subscription, loading } = useSubscription();
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const getStatusIcon = () => {
    if (subscription.isTrialActive) {
      return <Clock className="h-5 w-5 text-blue-400" />;
    }
    if (subscription.status === 'active') {
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    }
    return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
  };

  const getStatusText = () => {
    if (subscription.isTrialActive) {
      return `${subscription.trialDaysRemaining} days left in trial`;
    }
    if (subscription.status === 'active') {
      return 'Active subscription';
    }
    return 'Trial expired - Choose a plan';
  };

  const getStatusColor = () => {
    if (subscription.isTrialActive) {
      return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    }
    if (subscription.status === 'active') {
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    }
    return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
  };

  const getPlanDisplayName = () => {
    if (!subscription.plan) return 'No Plan';
    
    const { type, tier } = subscription.plan;
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    
    return `${typeName} ${tierName}`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-white" />
          <h3 className="font-semibold text-white">Subscription Status</h3>
        </div>
        {getStatusIcon()}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-200">Plan:</span>
          <span className="font-medium text-white">
            {getPlanDisplayName()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-200">Status:</span>
          <span className={`text-sm px-3 py-1 rounded-full border ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {subscription.plan && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-200">Invoices this month:</span>
            <span className="font-medium text-white">
              {subscription.usage.invoicesThisMonth}
              {subscription.limits.invoicesPerMonth > 0 && (
                <span className="text-blue-300 text-xs ml-1">
                  / {subscription.limits.invoicesPerMonth === -1 ? '∞' : subscription.limits.invoicesPerMonth}
                </span>
              )}
            </span>
          </div>
        )}

        {subscription.plan && subscription.limits.monthlyVolume > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-200">Monthly volume:</span>
            <span className="font-medium text-white">
              ${subscription.usage.monthlyVolume.toLocaleString()}
              <span className="text-blue-300 text-xs ml-1">
                / ${subscription.limits.monthlyVolume.toLocaleString()}
              </span>
            </span>
          </div>
        )}

        {/* Feature Access Indicators */}
        <div className="pt-3 border-t border-white/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              {subscription.canCreateOrganization ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              <span className="text-xs text-blue-200">Organizations</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canAccessPayables ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              <span className="text-xs text-blue-200">Payables</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canCreateInvoice ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              <span className="text-xs text-blue-200">Invoicing</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canUseAdvancedFeatures ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              <span className="text-xs text-blue-200">Advanced</span>
            </div>
          </div>
        </div>

        {(!subscription.isTrialActive && subscription.status === 'trial') && (
          <button
            onClick={() => router.push('/pricing')}
            className="w-full mt-4 bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Choose a Plan
          </button>
        )}

        {subscription.isTrialActive && (
          <button
            onClick={() => router.push('/pricing')}
            className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-center py-2 px-4 rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-colors text-sm font-medium"
          >
            Upgrade Now
          </button>
        )}
      </div>
    </div>
  );
}
