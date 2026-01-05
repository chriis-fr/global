'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Receipt,
  DollarSign, 
  Users,
  Building2,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import PayableStatCard from '@/components/payables/PayableStatCard';
import PayablesList from '@/components/payables/PayablesList';
import PayablesOnboardingStatus from '@/components/payables/PayablesOnboardingStatus';

export default function AccountsPayablePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'bills' | 'direct-payments' | 'vendors'>('bills');

  const handleCreatePayable = () => {
    router.push('/dashboard/services/payables/create');
  };

  const handleManagePayablesInfo = () => {
    router.push('/dashboard/services/payables/onboarding');
  };

  const handleRefresh = () => {
    // Clear all caches to force refresh
    localStorage.removeItem('payable_stat_total');
    localStorage.removeItem('payable_stat_amount');
    localStorage.removeItem('payable_stat_pending');
    localStorage.removeItem('payable_stat_paid');
    localStorage.removeItem('payables_onboarding_status');
    
    // Reload the page to trigger fresh data
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br">
      {/* Header - Always Visible, No Data Dependency */}
      <div className="bg-white/10 backdrop-blur-sm border-b rounded-lg border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-white truncate">Accounts Payable</h1>
                <p className="text-xs sm:text-sm text-blue-200 hidden sm:block">Manage your business payments and vendor relationships</p>
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
              <button
                onClick={handleCreatePayable}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95 text-sm"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Payable</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Onboarding Status - Independent Loading with Suspense */}
        <Suspense fallback={null}>
          <PayablesOnboardingStatus />
        </Suspense>

        {/* Stats Cards - Independent Loading with Suspense */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            <PayableStatCard type="total" />
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
            <PayableStatCard type="amount" />
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
            <PayableStatCard type="pending" />
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
            <PayableStatCard type="paid" />
          </Suspense>
        </div>

        {/* Quick Actions - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer"
            onClick={handleManagePayablesInfo}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Building2 className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white">Manage Payables Settings</h3>
                <p className="text-blue-200 text-sm">Configure business information and payment settings</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200 cursor-pointer"
            onClick={() => router.push('/dashboard/vendors')}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white">Manage Vendors</h3>
                <p className="text-blue-200 text-sm">Add and organize your vendors</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.div>
        </div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20"
        >
          <div className="border-b border-white/20">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('bills')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'bills'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-blue-300 hover:text-white hover:border-blue-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Receipt className="h-4 w-4" />
                  <span>Bills</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('direct-payments')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'direct-payments'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-blue-300 hover:text-white hover:border-blue-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Direct Payments</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'vendors'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-blue-300 hover:text-white hover:border-blue-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Vendors</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'bills' && (
              <Suspense fallback={
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg animate-pulse">
                      <div className="h-4 bg-white/20 rounded w-32"></div>
                      <div className="h-4 bg-white/20 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              }>
                <PayablesList onCreatePayable={handleCreatePayable} />
              </Suspense>
            )}

            {activeTab === 'direct-payments' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Direct Payments</h3>
                  <button
                    onClick={() => router.push('/dashboard/services/payables/create?type=direct')}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Make Payment</span>
                  </button>
                </div>
                
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Direct Payments</h3>
                  <p className="text-blue-200 mb-6">Make direct payments to vendors without creating bills first.</p>
                  <button
                    onClick={() => router.push('/dashboard/services/payables/create?type=direct')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Make Payment</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'vendors' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Vendors</h3>
                  <button
                    onClick={() => router.push('/dashboard/vendors')}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Vendor</span>
                  </button>
                </div>
                
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Manage Vendors</h3>
                  <p className="text-blue-200 mb-6">Add and manage your vendor information for easy payments.</p>
                  <button
                    onClick={() => router.push('/dashboard/vendors')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Manage Vendors</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
