'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Users,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Clock,
  Crown
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalClients: number;
  // Unified financial stats (receivables = invoices, payables = bills)
  netBalance: number;
  totalPayables: number;
  overdueCount: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalClients: 0,
    netBalance: 0,
    totalPayables: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [usingFallbackData, setUsingFallbackData] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      // Don't load data if no session
      if (!session?.user) {
        console.log('Dashboard: No session user, skipping data load');
        return;
      }

      try {
        console.log('Dashboard: Loading stats for user:', session.user.email);
        setLoading(true);
        
        // Fetch data in parallel like the services pages do - without timeout
        const [invoicesResponse, paidInvoicesResponse, clientsResponse, ledgerResponse] = await Promise.all([
          fetch('/api/invoices?limit=1&convertToPreferred=true'),
          fetch('/api/invoices?status=paid&convertToPreferred=true'), // Get only paid invoices
          fetch('/api/clients'),
          fetch('/api/ledger')
        ]);

        const invoicesData = await invoicesResponse.json();
        const paidInvoicesData = await paidInvoicesResponse.json();
        const clientsData = await clientsResponse.json();
        const ledgerData = await ledgerResponse.json();

        console.log('Dashboard: API responses:', {
          invoices: invoicesData.success,
          paidInvoices: paidInvoicesData.success,
          clients: clientsData.success,
          ledger: ledgerData.success,
          invoicesStatus: invoicesResponse.status,
          paidInvoicesStatus: paidInvoicesResponse.status,
          clientsStatus: clientsResponse.status,
          ledgerStatus: ledgerResponse.status
        });

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

        // Calculate net balance from paid revenue only
        const netBalance = paidRevenue - totalExpenses;

        setStats({
          totalRevenue,
          totalExpenses,
          pendingInvoices,
          paidInvoices,
          totalClients: clients.length,
          // Net balance = received payments (paid invoices) - payables (bills)
          netBalance: netBalance,
          totalPayables: ledgerStats?.totalPayablesAmount || 0,
          overdueCount: (ledgerStats?.overdueReceivables || 0) + (ledgerStats?.overduePayables || 0)
        });

        console.log('✅ Dashboard: Stats loaded successfully', {
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
        console.error('Error loading dashboard stats:', error);
        
        // For any error, show fallback data
        console.log('⚠️ Dashboard: Using fallback data due to API error');
        
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

  // Show loading only if both dashboard and subscription are loading
  if (loading || subscriptionLoading) {
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
    const limit = subscription.limits.invoicesPerMonth;
    if (limit === -1) return 'Unlimited';
    return Math.max(0, limit - subscription.usage.invoicesThisMonth);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Overview</h1>
            <p className="text-blue-200">Welcome back, {session?.user?.name || 'User'}!</p>
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

      {/* Plan Status Banner */}
      {subscription && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {subscription.isTrialActive ? (
                <Clock className="h-5 w-5 text-yellow-400" />
              ) : (
                <Crown className="h-5 w-5 text-blue-400" />
              )}
              <div>
                <h3 className="font-semibold text-white">{getPlanDisplayName()}</h3>
                <p className="text-sm text-blue-200">
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
              <p className="text-sm text-blue-200">Invoices this month</p>
              <p className="text-lg font-semibold text-white">
                {subscription.usage.invoicesThisMonth} / {subscription.limits.invoicesPerMonth === -1 ? '∞' : subscription.limits.invoicesPerMonth}
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

      {/* Financial Overview - Minimalistic Request Finance Style */}
      <div className={`grid gap-6 ${subscription?.canAccessPayables ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Net Balance - Primary metric */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Net Balance</p>
              <p className={`text-3xl font-bold ${stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.netBalance >= 0 ? '+' : ''}
                <FormattedNumberDisplay value={Math.abs(stats.netBalance)} />
              </p>
              <p className="text-xs text-blue-300 mt-1">
                {stats.netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stats.netBalance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {stats.netBalance >= 0 ? 
                <TrendingUp className="h-6 w-6 text-green-400" /> : 
                <TrendingDown className="h-6 w-6 text-red-400" />
              }
            </div>
          </div>
        </div>

        {/* Receivables (Invoices) */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Receivables</p>
              <p className="text-2xl font-bold text-white">
                <FormattedNumberDisplay value={stats.totalRevenue} />
              </p>
              <p className="text-xs text-blue-300 mt-1">{stats.pendingInvoices} pending invoices</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <ArrowUpRight className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Payables (Bills) - Only show if user has access */}
        {subscription?.canAccessPayables && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Payables</p>
                <p className="text-2xl font-bold text-white">
                  <FormattedNumberDisplay value={stats.totalPayables} />
                </p>
                <p className="text-xs text-blue-300 mt-1">Bills to pay</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <ArrowDownLeft className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>
        )}
        </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="flex flex-col space-y-3">
            {subscription?.canCreateInvoice && (
              <button
                onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
                className="flex items-center space-x-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="h-5 w-5" />
                <span>Create Invoice</span>
              </button>
            )}
            
            {subscription?.canAccessPayables && (
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

      {/* Recent Activity */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
            View all
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FileText className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Smart Invoicing service active</p>
              <p className="text-blue-300 text-xs">Service • Just now</p>
            </div>
            <span className="text-green-400 text-sm font-medium">Active</span>
          </div>
          
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Account created</p>
              <p className="text-blue-300 text-xs">System • {new Date().toLocaleDateString()}</p>
            </div>
            <span className="text-blue-400 text-sm font-medium">Welcome!</span>
          </div>
        </div>
      </div>
    </div>
  );
} 