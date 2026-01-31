'use client';
import { useState, useEffect, Suspense, startTransition } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Users,
  Receipt,
  Clock,
  Crown,
  Lock,
  BarChart3
} from 'lucide-react';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import StatsCards from '@/components/dashboard/StatsCards';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import RecentPayables from '@/components/dashboard/RecentPayables';
import { getUserSettings } from '@/app/actions/user-actions';

export default function DashboardPage() {
  const { data: session } = useSession();
  const { subscription, refetch } = useSubscription(); // Don't block on loading
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');

  // Refresh subscription on mount to ensure we have the latest data
  useEffect(() => {
    if (session?.user?.id) {
      // Refresh subscription data when dashboard loads to ensure it's up to date
      // This is especially important after plan changes
      const timer = setTimeout(() => {
        refetch();
      }, 1000); // Small delay to avoid blocking initial render
      
      return () => clearTimeout(timer);
    }
  }, [session?.user?.id, refetch]);

  // Fetch user data in background - don't block render
  useEffect(() => {
    if (!session?.user?.email) return;
    
    // Load in background using server action - non-blocking
    startTransition(async () => {
      try {
        const result = await getUserSettings();
        if (result.success && result.data) {
          if (result.data.profile.name) {
            setUserName(result.data.profile.name);
          }
          if (result.data.organization?.name) {
            setOrganizationName(result.data.organization.name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    });
  }, [session?.user?.email]);

  const getPlanDisplayName = () => {
    if (!subscription?.plan) return 'Free Plan';
    
    // Special handling for free plan - show "Free Plan" instead of "Receivables Free"
    if (subscription.plan.planId === 'receivables-free') {
      return 'Free Plan';
    }
    
    const { type, tier } = subscription.plan;
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    
    return `${typeName} ${tierName}`;
  };

  const getRemainingInvoices = () => {
    if (!subscription) return 0;
    
    if (subscription.limits.invoicesPerMonth === -1) return '∞';
    return Math.max(0, subscription.limits.invoicesPerMonth - subscription.usage.invoicesThisMonth);
  };

  const getUsageText = () => {
    if (!subscription) return '';
    
    return `${subscription.usage.invoicesThisMonth} / ${subscription.limits.invoicesPerMonth === -1 ? '∞' : subscription.limits.invoicesPerMonth}`;
  };


  // Check subscription type and access
  const isPayablesOnly = subscription?.plan?.type === 'payables';
  const isReceivablesOnly = subscription?.plan?.type === 'receivables';
  const isCombined = subscription?.plan?.type === 'combined';
  const isFreePlan = subscription?.plan?.planId === 'receivables-free';
  const isTrialPremium = subscription?.plan?.planId === 'trial-premium';
  
  // Check if user has access to receivables (receivables plans, combined plans, free plan, or trial)
  const hasReceivablesAccess = isReceivablesOnly || isCombined || isFreePlan || isTrialPremium;
  
  // Check if user has access to payables (payables plans, combined plans, or trial)
  const hasPayablesAccess = (isPayablesOnly || isCombined || isTrialPremium) && subscription?.canAccessPayables;
  
  // Check if services are enabled (must be enabled during onboarding)
  const isSmartInvoicingEnabled = session?.user?.services?.smartInvoicing || false;
  const isAccountsPayableEnabled = session?.user?.services?.accountsPayable || false;
  
  // Quick Actions should only show if BOTH subscription access AND service is enabled
  const canShowCreateInvoice = hasReceivablesAccess && isSmartInvoicingEnabled;
  const canShowCreatePayable = hasPayablesAccess && isAccountsPayableEnabled;
  
  // Check if user is on a paid plan (non-blocking)
  const isPaidUser = subscription?.plan?.planId && subscription.plan.planId !== 'receivables-free';

  // Use session data immediately - don't wait for API call
  const displayName = userName || session?.user?.name || 'User';
  const displayOrgName = organizationName || ''; // Will be populated from server action

  return (
    <div className="space-y-6">
      {/* Header - Renders immediately with session data */}
      <div className="flex items-center justify-between">
        <div>
            {/* Mobile: Welcome back first, then Overview */}
            <div className="md:hidden">
              <p className="text-blue-200 mb-2">Hi, {displayName}!</p>
              <h1 
                className="text-2xl font-bold text-white flex items-center gap-2"
                style={{ contentVisibility: 'auto' }}
              >
                {displayOrgName && (
                  <span className="text-blue-300 font-medium">
                    {displayOrgName} • 
                  </span>
                )}
                Overview
                {isPaidUser && (
                  <span className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></span>
                )}
              </h1>
            </div>
            
            {/* Desktop: Overview first, then Welcome back */}
            <div className="hidden md:block">
              <h1 
                className="text-3xl font-bold text-white mb-2 flex items-center gap-2"
                style={{ contentVisibility: 'auto' }}
              >
                {displayOrgName && (
                  <span className="text-blue-300 font-medium">
                    {displayOrgName} • 
                  </span>
                )}
                Overview
                {isPaidUser && (
                  <span className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></span>
                )}
              </h1>
              <p className="text-blue-200">Welcome back, {displayName}!</p>
            </div>
        </div>
        {/* <div className="text-right">
            <p className="text-sm text-blue-300">Last updated</p>
            <p className="text-sm text-white">{new Date().toLocaleDateString()}</p>
        </div> */}
      </div>

      {/* Plan Status Banner - Only show for receivables free users */}
      {subscription && subscription.plan?.planId === 'receivables-free' && hasReceivablesAccess && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-3">
              {subscription.isTrialActive ? (
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" />
              ) : (
                <Crown className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
              )}
              <div>
                <h3 className="font-semibold text-white text-sm md:text-base">{getPlanDisplayName()}</h3>
                <p className="text-xs md:text-sm text-blue-200">
                  {subscription.isTrialActive 
                    ? `${subscription.trialDaysRemaining} days left in trial`
                    : subscription.status === 'active' 
                      ? 'Active subscription'
                      : 'Trial expired'
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm text-blue-200">Invoices this month</p>
              <p className="text-sm md:text-lg font-semibold text-white">
                {getUsageText()}
              </p>
              {subscription.limits.invoicesPerMonth !== -1 && (
                <p className="text-xs text-blue-300">
                  {getRemainingInvoices()} remaining
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Independent Loading with Suspense */}
      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
              <div className="h-8 w-24 bg-white/20 rounded mb-2"></div>
              <div className="h-4 w-16 bg-white/20 rounded"></div>
            </div>
          ))}
        </div>
      }>
        <StatsCards />
      </Suspense>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="flex flex-col space-y-3">
            {/* Show Create Invoice only if service is enabled AND user has subscription access */}
            {canShowCreateInvoice && (
              <button
                onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
                disabled={!subscription?.canCreateInvoice}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  subscription?.canCreateInvoice
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span>Create Invoice</span>
                {!subscription?.canCreateInvoice && (
                  <>
                    <span className="text-xs ml-auto">Limit Reached</span>
                    <Lock className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
            
            {/* Show Create Payable only if service is enabled AND user has subscription access */}
            {canShowCreatePayable && (
              <button
                onClick={() => router.push('/dashboard/services/payables/create')}
                className="flex items-center space-x-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Receipt className="h-5 w-5" />
                <span>Create Payable</span>
              </button>
            )}

          </div>
        </div>

        {/* Alerts & Status */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-blue-400 font-medium">System Active</p>
                <p className="text-blue-300 text-sm">All services running</p>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/dashboard/stats')}
              className="flex items-center space-x-3 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors w-full"
            >
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <div className="text-left">
                <p className="text-blue-400 font-medium">View Statistics</p>
                <p className="text-blue-300 text-sm">Financial overview & analytics</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity - Independent Loading with Suspense */}
      <div className={`grid gap-6 ${
        canShowCreateInvoice && canShowCreatePayable 
          ? 'grid-cols-1 lg:grid-cols-2' 
          : 'grid-cols-1'
      }`}>
        {canShowCreateInvoice && (
          <Suspense fallback={
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="h-6 w-32 bg-white/20 rounded mb-4 animate-pulse"></div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
          }>
            <RecentInvoices />
          </Suspense>
        )}
        {canShowCreatePayable && (
          <Suspense fallback={
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="h-6 w-32 bg-white/20 rounded mb-4 animate-pulse"></div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
          }>
            <RecentPayables />
          </Suspense>
        )}
      </div>
    </div>
  );
}
