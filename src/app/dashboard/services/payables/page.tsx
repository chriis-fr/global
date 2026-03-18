'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Receipt,
  DollarSign, 
  Users,
  Building2,
  ArrowRight,
  RotateCcw,
  FileText,
  CheckCircle,
  Clock,
  ChevronDown
} from 'lucide-react';
import PayableStatCard from '@/components/payables/PayableStatCard';
import PayablesList from '@/components/payables/PayablesList';
import PayablesOnboardingStatus from '@/components/payables/PayablesOnboardingStatus';
import { getVendorsWithPayableCounts } from '@/app/actions/payable-actions';

type VendorWithCounts = {
  vendor: { _id: string; name?: string; email?: string; company?: string };
  pendingCount: number;
  paidCount: number;
  totalCount: number;
  pendingAmount: number;
};

export default function AccountsPayablePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'bills' | 'direct-payments' | 'vendors'>('bills');
  const [vendorStats, setVendorStats] = useState<VendorWithCounts[]>([]);
  const [vendorStatsLoading, setVendorStatsLoading] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const loadVendorStats = useCallback(async () => {
    setVendorStatsLoading(true);
    try {
      const result = await getVendorsWithPayableCounts();
      if (result.success && result.data) {
        setVendorStats(result.data);
      } else {
        setVendorStats([]);
      }
    } catch {
      setVendorStats([]);
    } finally {
      setVendorStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'vendors') {
      loadVendorStats();
    }
  }, [activeTab, loadVendorStats]);

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

        {/* Quick Actions - Collapsible, hidden by default (matches Smart Invoicing) */}
        <button
          type="button"
          onClick={() => setQuickActionsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors text-left mb-4"
        >
          <span className="text-white font-medium">Quick actions</span>
          <ChevronDown
            className={`h-5 w-5 text-blue-400 flex-shrink-0 transition-transform duration-200 ${quickActionsOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {quickActionsOpen && (
          <div className="mb-8">
            <div className="flex md:grid gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar md:grid-cols-2 lg:grid-cols-3 snap-x snap-mandatory md:snap-none">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex-shrink-0 w-[calc(50%-8px)] min-w-[150px] md:w-auto md:min-w-0 h-[108px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-2.5 md:p-3.5 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                onClick={handleManagePayablesInfo}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
                  <div className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-orange-500/20">
                    <Building2 className="h-4.5 w-4.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="text-sm md:text-[15px] font-semibold text-white line-clamp-2 break-words leading-tight">Manage Payables Settings</h3>
                    <p className="text-blue-200/90 text-[11px] line-clamp-2 break-words leading-snug mt-0.5">Configure business information and payment settings</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
                </div>
                <div className="h-7 flex-shrink-0" aria-hidden />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex-shrink-0 w-[calc(50%-8px)] min-w-[150px] md:w-auto md:min-w-0 h-[108px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-2.5 md:p-3.5 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                onClick={() => router.push('/dashboard/vendors')}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
                  <div className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-green-500/20">
                    <Users className="h-4.5 w-4.5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="text-sm md:text-[15px] font-semibold text-white line-clamp-2 break-words leading-tight">Manage Vendors</h3>
                    <p className="text-blue-200/90 text-[11px] line-clamp-2 break-words leading-snug mt-0.5">Add and organize your vendors</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
                </div>
                <div className="h-7 flex-shrink-0" aria-hidden />
              </motion.div>
            </div>
          </div>
        )}

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
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add / Manage Vendors</span>
                  </button>
                </div>

                {vendorStatsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg animate-pulse">
                        <div className="h-4 bg-white/20 rounded w-32" />
                        <div className="h-4 bg-white/20 rounded w-24" />
                      </div>
                    ))}
                  </div>
                ) : vendorStats.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No vendors yet</h3>
                    <p className="text-blue-200 mb-6">Add vendors to see an overview of payables per vendor here.</p>
                    <button
                      onClick={() => router.push('/dashboard/vendors')}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Manage Vendors</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-blue-200 mb-4">
                      Overview of each vendor and their payables. Open Manage Vendors to edit details or send submission links.
                    </p>
                    {vendorStats.map(({ vendor, pendingCount, paidCount, totalCount, pendingAmount }) => (
                      <div
                        key={vendor._id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">
                            {vendor.name || vendor.company || 'Vendor'}
                          </div>
                          {(vendor.company || vendor.email) && (
                            <div className="text-sm text-blue-200 truncate">
                              {[vendor.company, vendor.email].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1.5 text-blue-200" title="Total payables">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-medium">{totalCount}</span>
                            <span>total</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-amber-200" title="Pending">
                            <Clock className="h-4 w-4 text-amber-400" />
                            <span className="text-white font-medium">{pendingCount}</span>
                            <span>pending</span>
                            {pendingAmount > 0 && (
                              <span className="text-amber-300 font-medium">
                                ({typeof pendingAmount === 'number' ? pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : pendingAmount})
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5 text-green-200" title="Paid">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-white font-medium">{paidCount}</span>
                            <span>paid</span>
                          </span>
                        </div>
                        <button
                          onClick={() => router.push('/dashboard/vendors')}
                          className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Manage →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
