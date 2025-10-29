'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Users,
  Receipt,
  AlertTriangle,
  Clock,
  Crown,
  Lock
} from 'lucide-react';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import StatsCards from '@/components/dashboard/StatsCards';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import RecentPayables from '@/components/dashboard/RecentPayables';

export default function DashboardPage() {
  const { data: session } = useSession();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');

  // Fetch current user name and organization name
  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user?.email) return;
      
      try {
        const response = await fetch('/api/user/settings');
        const data = await response.json();
        
        if (data.success) {
          if (data.data.profile.name) {
            setUserName(data.data.profile.name);
          }
          if (data.data.organization?.name) {
            setOrganizationName(data.data.organization.name);
          }
        }
      } catch (error) {
      }
    };

    fetchUserData();
  }, [session?.user?.email]);

  useEffect(() => {
    const loadStats = async () => {
      // Don't load data if no session
      if (!session?.user) {
        return;
      }

      try {
        // setLoading(true); // Removed - stats load independently
        
        // Fetch data in parallel like the services pages do - without timeout
        const [invoicesResponse, paidInvoicesResponse, clientsResponse, ledgerResponse] = await Promise.all([
          fetch('/api/invoices?limit=1&convertToPreferred=false'), // Keep original amounts
          fetch('/api/invoices?status=paid&convertToPreferred=false'), // Get only paid invoices - keep original amounts
          fetch('/api/clients'),
          fetch('/api/ledger')
        ]);

        const invoicesData = await invoicesResponse.json();
        const paidInvoicesData = await paidInvoicesResponse.json();
        const clientsData = await clientsResponse.json();
        const ledgerData = await ledgerResponse.json();

        const clients = clientsData.success ? clientsData.data : [];
        
        // Use total revenue from API stats (includes all invoices, not just paginated ones)
        const totalRevenue = invoicesData.success ? invoicesData.data.stats?.totalRevenue || 0 : 0;
        
        // Calculate paid revenue from paid invoices only
        const paidRevenue = paidInvoicesData.success ? paidInvoicesData.data.stats?.totalRevenue || 0 : 0;

        const statusCounts = invoicesData.success ? invoicesData.data.stats?.statusCounts || {} : {};
        const pendingInvoices = (statusCounts.sent || 0) + (statusCounts.pending || 0);
        const paidInvoices = statusCounts.paid || 0;
        
        const totalExpenses = 0; // Will be implemented when expenses service is ready

        // Get unified financial stats from ledger
        const ledgerStats = ledgerData.success ? ledgerData.data.stats : null;

        // Use the correct net balance from ledger: PAID receivables - PAID payables
        const netBalance = ledgerStats?.netBalance || 0;

        setStats({
          totalRevenue,
          totalExpenses,
          pendingInvoices,
          paidInvoices,
          totalClients: clients.length,
          // Net balance = PAID receivables - PAID payables (actual money in/out)
          netBalance: netBalance,
          totalPayables: ledgerStats?.totalPayablesAmount || 0,
          overdueCount: (ledgerStats?.overdueReceivables || 0) + (ledgerStats?.overduePayables || 0)
        });

          totalRevenue,
          paidRevenue,
          pendingInvoices,
          paidInvoices,
          totalClients: clients.length,
          netBalance: netBalance
        });

        // Reset fallback data flag if we successfully loaded data
        setUsingFallbackData(false);

      } catch (error) {
        
        // For any error, show fallback data
        
        setStats({
          totalRevenue: 0,
          totalExpenses: 0,
          pendingInvoices: 0,
          paidInvoices: 0,
          totalClients: 0,
          netBalance: 0,
          totalPayables: 0,
          overdueCount: 0
        });
        
        setUsingFallbackData(true);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [session?.user]);

  // Show loading only if subscription is loading (stats load independently)
  if (subscriptionLoading) {
    return <DashboardSkeleton />;
  }

  const getPlanDisplayName = () => {
    if (!subscription?.plan) return 'Free Plan';
    
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
  
  // Check if user has access to receivables (receivables plans, combined plans, or free plan)
  const hasReceivablesAccess = isReceivablesOnly || isCombined || isFreePlan;
  
  // Check if user has access to payables (payables plans or combined plans)
  const hasPayablesAccess = (isPayablesOnly || isCombined) && subscription?.canAccessPayables;
  
  // Check if user is on a paid plan
  const isPaidUser = subscription?.plan?.planId && subscription.plan.planId !== 'receivables-free';

  // Debug logging
    subscription: subscription?.plan,
    hasReceivablesAccess,
    hasPayablesAccess,
    isFreePlan,
    isReceivablesOnly,
    isPayablesOnly,
    isCombined,
    canCreateInvoice: subscription?.canCreateInvoice
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2">
              {organizationName && (
                <span className="text-blue-300 font-medium">
                  {organizationName} • 
                </span>
              )}
              Overview
              {isPaidUser && (
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                  PRO
                </span>
              )}
            </h1>
            <p className="text-blue-200">Welcome back, {userName || session?.user?.name || 'User'}!</p>
            {usingFallbackData && (
              <div className="mt-2 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <p className="text-orange-400 text-sm">Using offline data - some features may be limited</p>
              </div>
            )}
        </div>
        <div className="text-right">
            <p className="text-sm text-blue-300">Last updated</p>
            <p className="text-sm text-white">{new Date().toLocaleDateString()}</p>
        </div>
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

      {/* Stats Cards - Independent Loading */}
      <StatsCards />

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="flex flex-col space-y-3">
            {/* Show Create Invoice only for receivables plans */}
            {hasReceivablesAccess && (
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
            
            {/* Show Create Payable only for payables plans */}
            {hasPayablesAccess && (
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
            {stats.overdueCount > 0 ? (
              <div className="flex items-center space-x-3 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-orange-400 font-medium">{stats.overdueCount} overdue items</p>
                  <p className="text-orange-300 text-sm">Need immediate attention</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">All up to date</p>
                  <p className="text-green-300 text-sm">No overdue items</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-blue-400 font-medium">{stats.totalClients} clients</p>
                  <p className="text-blue-300 text-sm">Active relationships</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity - Independent Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentInvoices />
        <RecentPayables />
      </div>
    </div>
  );
} 