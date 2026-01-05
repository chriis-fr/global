'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  List,
  Building2,
  Lock,
  Users,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import InvoiceStatCard from '@/components/smart-invoicing/InvoiceStatCard';
import RecentInvoicesList from '@/components/smart-invoicing/RecentInvoicesList';
import OnboardingStatus from '@/components/smart-invoicing/OnboardingStatus';

export default function SmartInvoicingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { subscription } = useSubscription();

  const handleCreateInvoice = () => {
    // Check if user can create invoice (limit reached)
    if (!subscription?.canCreateInvoice) {
      // Don't navigate if limit is reached
      return;
    }
    
    router.push('/dashboard/services/smart-invoicing/create');
  };

  const handleManageInvoiceInfo = () => {
    router.push('/dashboard/services/smart-invoicing/onboarding');
  };

  const handleViewInvoices = () => {
    router.push('/dashboard/services/smart-invoicing/invoices');
  };

  const handleManageClients = () => {
    router.push('/dashboard/clients');
  };

  const handleRefresh = () => {
    // Clear all caches to force refresh
    localStorage.removeItem('invoice_stat_total');
    localStorage.removeItem('invoice_stat_revenue');
    localStorage.removeItem('invoice_stat_pending');
    localStorage.removeItem('invoice_stat_paid');
    localStorage.removeItem('smart_invoicing_recent_invoices');
    localStorage.removeItem('smart_invoicing_onboarding_status');
    
    // Reload the page to trigger fresh data
    window.location.reload();
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header - Always Visible, No Data Dependency */}
      <div className="bg-white/10 backdrop-blur-sm border-b rounded-lg border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-white truncate">Smart Invoicing</h1>
                <p className="text-xs sm:text-sm text-blue-200 hidden sm:block">
                  Create, manage, and get paid with both fiat and blockchain payments seamlessly
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <button
                onClick={handleRefresh}
                className="flex items-center justify-center w-8 h-8 text-blue-300 hover:text-blue-200 hover:bg-white/10 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleViewInvoices}
                className="flex items-center space-x-1 sm:space-x-2 bg-white/10 backdrop-blur-sm text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20 text-sm"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">View Invoices</span>
                <span className="sm:hidden">View</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: subscription?.canCreateInvoice ? 1.05 : 1 }}
                whileTap={{ scale: subscription?.canCreateInvoice ? 0.95 : 1 }}
                onClick={handleCreateInvoice}
                disabled={!subscription?.canCreateInvoice}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                  subscription?.canCreateInvoice
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {!subscription?.canCreateInvoice ? 'Limit Reached' : 'Create Invoice'}
                </span>
                <span className="sm:hidden">
                  {!subscription?.canCreateInvoice ? 'Limit' : 'Create'}
                </span>
                {!subscription?.canCreateInvoice && (
                  <Lock className="h-4 w-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Status - Independent Loading with Suspense */}
      <Suspense fallback={null}>
        <OnboardingStatus />
      </Suspense>

      {/* Stats Cards - Independent Loading with Suspense */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Suspense fallback={
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-white/20 rounded"></div>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <div className="h-6 w-6"></div>
                </div>
              </div>
            </div>
          }>
            <InvoiceStatCard type="total" />
          </Suspense>

          <Suspense fallback={
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-white/20 rounded"></div>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <div className="h-6 w-6"></div>
                </div>
              </div>
            </div>
          }>
            <InvoiceStatCard type="revenue" />
          </Suspense>

          <Suspense fallback={
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-white/20 rounded"></div>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <div className="h-6 w-6"></div>
                </div>
              </div>
            </div>
          }>
            <InvoiceStatCard type="pending" />
          </Suspense>

          <Suspense fallback={
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-white/20 rounded"></div>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <div className="h-6 w-6"></div>
                </div>
              </div>
            </div>
          }>
            <InvoiceStatCard type="paid" />
          </Suspense>
        </div>
      </div>

      {/* Quick Actions - Always Visible */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer ${
              !subscription?.canCreateInvoice ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={subscription?.canCreateInvoice ? handleCreateInvoice : undefined}
          >
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${
                subscription?.canCreateInvoice ? 'bg-blue-500/20' : 'bg-gray-500/20'
              }`}>
                {subscription?.canCreateInvoice ? (
                  <Plus className="h-6 w-6 text-blue-400" />
                ) : (
                  <Lock className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white">
                  {subscription?.canCreateInvoice ? 'Create New Invoice' : 'Invoice Limit Reached'}
                </h3>
                <p className="text-blue-200 text-sm">
                  {subscription?.canCreateInvoice 
                    ? 'Start with our guided walkthrough' 
                    : 'Upgrade to create more invoices'
                  }
                </p>
              </div>
              {subscription?.canCreateInvoice && (
                <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer"
            onClick={handleManageInvoiceInfo}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Building2 className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white">Manage Invoice Info</h3>
                <p className="text-blue-200 text-sm">Configure business information and settings</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer"
            onClick={handleManageClients}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white">Manage Clients</h3>
                <p className="text-blue-200 text-sm">Add and organize your clients</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.div>

          {/* Only show Team Settings for business users with organizations */}
          {session?.user?.userType === 'business' && session?.user?.organizationId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer"
              onClick={() => router.push('/dashboard/settings/organization')}
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Users className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white">Team Settings</h3>
                  <p className="text-blue-200 text-sm">Configure team permissions</p>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Recent Activity - Independent Loading with Suspense */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="h-6 w-32 bg-white/20 rounded mb-4 animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        }>
          <RecentInvoicesList />
        </Suspense>
      </div>
    </div>
  );
}
