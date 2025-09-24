'use client';

import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { FileText, TrendingUp, Users, Crown } from 'lucide-react';

export function UsageDisplay() {
  const { subscription, loading } = useSubscription();

  if (loading || !subscription) {
    return null;
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-white" />
        <h3 className="font-semibold text-white">Usage This Month</h3>
      </div>

      <div className="space-y-4">
        {/* Invoice Usage */}
        {subscription.limits.invoicesPerMonth > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-200">Invoices</span>
              </div>
              <span className="text-sm text-white">
                {subscription.usage.invoicesThisMonth} / {subscription.limits.invoicesPerMonth}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${getUsagePercentage(subscription.usage.invoicesThisMonth, subscription.limits.invoicesPerMonth)}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Monthly Volume Usage */}
        {subscription.limits.monthlyVolume > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm text-blue-200">Monthly Volume</span>
              </div>
              <span className="text-sm text-white">
                ${subscription.usage.monthlyVolume.toLocaleString()} / ${subscription.limits.monthlyVolume.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${getUsagePercentage(subscription.usage.monthlyVolume, subscription.limits.monthlyVolume)}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Feature Access Summary */}
        <div className="pt-4 border-t border-white/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              {subscription.canCreateOrganization ? (
                <Users className="h-4 w-4 text-green-400" />
              ) : (
                <Users className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs text-blue-200">Organizations</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canAccessPayables ? (
                <FileText className="h-4 w-4 text-green-400" />
              ) : (
                <FileText className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs text-blue-200">Payables</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canCreateInvoice ? (
                <FileText className="h-4 w-4 text-green-400" />
              ) : (
                <FileText className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs text-blue-200">Invoicing</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscription.canUseAdvancedFeatures ? (
                <Crown className="h-4 w-4 text-green-400" />
              ) : (
                <Crown className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-xs text-blue-200">Advanced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
