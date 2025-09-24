'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Plus, 
  FileText, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  ArrowRight,
  RotateCcw,
  Users,
  List,
  Building2,
  LayoutDashboard,
  AlertCircle,
  Lock
} from 'lucide-react';
import { InvoiceService, InvoiceStats } from '@/lib/services/invoiceService';
import { Invoice } from '@/models/Invoice';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import InvoicingSkeleton from '@/components/ui/InvoicingSkeleton';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

// Cache key for localStorage
const CACHE_KEY = 'smart-invoicing-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - stable cache for good UX

interface CachedData {
  invoices: Invoice[];
  stats: InvoiceStats;
  isOnboardingCompleted: boolean | null;
  timestamp: number;
}

export default function SmartInvoicingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { subscription } = useSubscription();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoices: 0,
    pendingCount: 0,
    paidCount: 0,
    totalRevenue: 0
  });
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load cached data from localStorage
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid (less than 5 minutes old)
        if (now - data.timestamp < CACHE_DURATION) {
          setInvoices(data.invoices);
          setStats(data.stats);
          setIsOnboardingCompleted(data.isOnboardingCompleted);
          setDataLoaded(true);
          return true;
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.error('❌ [Smart Invoicing] Error loading cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
    return false;
  }, []);

  // Save data to cache
  const saveToCache = useCallback((invoices: Invoice[], stats: InvoiceStats, isOnboardingCompleted: boolean | null) => {
    try {
      const cacheData: CachedData = {
        invoices,
        stats,
        isOnboardingCompleted,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('❌ [Smart Invoicing] Error saving to cache:', error);
    }
  }, []);

  // Load all data in parallel
  const loadAllData = useCallback(async (forceRefresh = false) => {
    if (!session?.user) return;
    
    // Try to load from cache first (unless force refresh)
    if (!forceRefresh && loadCachedData()) {
      // If we have cached data, check if it's stale and refresh in background
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        const staleThreshold = 2 * 60 * 1000; // 2 minutes
        
        if (age > staleThreshold) {
          console.log('🔄 [Smart Invoicing] Background refresh - cache is stale');
          setRefreshing(true);
          // Don't await - let it refresh in background
          loadAllData(true).finally(() => setRefreshing(false));
        }
      }
      return;
    }
    
    // Don't reload if we already have data and not forcing refresh
    if (dataLoaded && !forceRefresh) return;
    
    try {
      setLoading(true);
      
      // Load invoices with stats and check onboarding status in parallel
      const [invoicesResponse, onboardingResponse] = await Promise.all([
        fetch('/api/invoices?convertToPreferred=true'),
        fetch('/api/onboarding/service?service=smartInvoicing')
      ]);
      
      const invoicesData = await invoicesResponse.json();
      
      // Process invoices and stats from API
      let currentInvoices: Invoice[] = [];
      let currentStats: InvoiceStats = {
        totalInvoices: 0,
        pendingCount: 0,
        paidCount: 0,
        totalRevenue: 0
      };
      
      if (invoicesData.success) {
        currentInvoices = invoicesData.data.invoices || [];
        const apiStats = invoicesData.data.stats;
        
        
        setInvoices(currentInvoices);
        currentStats = {
          totalInvoices: apiStats.totalInvoices || 0,
          // Use API stats counts (calculated from total database count, not paginated results)
          pendingCount: (apiStats.statusCounts?.sent || 0) + (apiStats.statusCounts?.pending || 0),
          paidCount: apiStats.statusCounts?.paid || 0,
          totalRevenue: apiStats.totalRevenue || 0
        };
        setStats(currentStats);
      } else {
        // Fallback to local calculation if API fails
        currentInvoices = forceRefresh ? await InvoiceService.refreshInvoices() : await InvoiceService.getInvoices();
        setInvoices(currentInvoices);
        currentStats = InvoiceService.getStats(currentInvoices);
        setStats(currentStats);
      }
      
      // Process onboarding status
      const onboardingData = await onboardingResponse.json();
      let onboardingCompleted = null;
      if (onboardingData.success) {
        onboardingCompleted = onboardingData.data.isCompleted;
        setIsOnboardingCompleted(onboardingCompleted);
      }
      
      // Save to cache
      saveToCache(currentInvoices, currentStats, onboardingCompleted);
    } catch (error) {
      console.error('❌ [Smart Invoicing Dashboard] Error loading data:', error);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [session?.user, dataLoaded, loadCachedData, saveToCache]);

  useEffect(() => {
    if (session?.user) {
      // Load data (will use cache if available and valid)
      loadAllData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]); // Intentionally exclude loadAllData to prevent infinite loops

  // Refresh completion status when returning from onboarding or payment actions
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('refresh') === 'true') {
      // Remove the refresh parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Force refresh data immediately (bypass cache)
      loadAllData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally exclude loadAllData to prevent infinite loops

  // Smart refresh when returning from specific actions
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && dataLoaded) {
        // Check if we're returning from a payment-related action
        const lastAction = sessionStorage.getItem('lastPaymentAction');
        const now = Date.now();
        
        if (lastAction) {
          const actionTime = parseInt(lastAction);
          // If last payment action was within last 2 minutes, force refresh
          if (now - actionTime < 2 * 60 * 1000) {
            console.log('🔄 [Smart Invoicing] Force refresh due to recent payment action');
            loadAllData(true);
            sessionStorage.removeItem('lastPaymentAction');
            return;
          }
        }
        
        // Otherwise, only refresh if cache is expired (5+ minutes old)
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          if (now - data.timestamp > CACHE_DURATION) {
            loadAllData(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]);

  const handleCreateInvoice = () => {
    // Check if user can create invoice (limit reached)
    if (!subscription?.canCreateInvoice) {
      // Don't navigate if limit is reached
      return;
    }
    
    // Only check onboarding if we have the data, otherwise assume it's completed
    if (dataLoaded && isOnboardingCompleted === false) {
      router.push('/dashboard/services/smart-invoicing/onboarding');
    } else {
      router.push('/dashboard/services/smart-invoicing/create');
    }
  };

  const handleManageInvoiceInfo = () => {
    router.push('/dashboard/services/smart-invoicing/onboarding');
  };

  const handleSetupService = () => {
    router.push('/dashboard/services/smart-invoicing/onboarding');
  };


  const handleViewInvoices = () => {
    router.push('/dashboard/services/smart-invoicing/invoices');
  };

  const handleManageClients = () => {
    router.push('/dashboard/clients');
  };

  // Show skeleton while loading initial data
  if (loading && !dataLoaded) {
    return <InvoicingSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Smart Invoicing</h1>
          <p className="text-blue-200 text-sm sm:text-base">
            Create, manage, and get paid with both fiat and blockchain payments seamlessly
            {refreshing && (
              <span className="ml-2 text-xs text-blue-300">
                🔄 Updating...
              </span>
            )}
          </p>
        </div>
        
        {/* Mobile Action Buttons */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 text-blue-300 hover:text-blue-200 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 self-end sm:self-auto"
            title={refreshing ? "Refreshing..." : "Refresh data"}
          >
            <RotateCcw className={`h-4 w-4 sm:h-3 sm:w-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleViewInvoices}
              className="flex items-center justify-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-4 py-3 sm:px-4 sm:py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20 text-sm sm:text-base min-h-[44px] sm:min-h-auto"
            >
              <List className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>View Invoices</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: subscription?.canCreateInvoice ? 1.05 : 1 }}
              whileTap={{ scale: subscription?.canCreateInvoice ? 0.95 : 1 }}
              onClick={handleCreateInvoice}
              disabled={!subscription?.canCreateInvoice}
              className={`flex items-center justify-center space-x-2 px-4 py-3 sm:px-4 sm:py-2 rounded-lg transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-auto ${
                subscription?.canCreateInvoice
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-center">
                {!subscription?.canCreateInvoice ? 'Limit Reached' :
                 !dataLoaded && loading ? 'Loading...' : 
                 dataLoaded && isOnboardingCompleted === false ? 'Setup & Create' : 
                 'Create Invoice'}
              </span>
              {!subscription?.canCreateInvoice && (
                <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Service Onboarding Check */}
      {!loading && isOnboardingCompleted === false && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-start space-x-3 sm:space-x-4">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-yellow-100 mb-2">
                Service Setup Required
              </h3>
              <p className="text-yellow-200 mb-4 text-sm sm:text-base">
                Before you can create invoices, you need to configure your business information and invoice settings. 
                Click &quot;Manage Invoice Info&quot; above or &quot;Complete Setup&quot; below to get started.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSetupService}
                className="flex items-center justify-center space-x-2 bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 transition-colors min-h-[44px] w-full sm:w-auto"
              >
                <ArrowRight className="h-4 w-4" />
                <span>Complete Setup</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
               <p className="text-blue-200 text-xs sm:text-sm">Total Invoices</p>
               <p className="text-lg sm:text-2xl font-bold text-white">
                 {stats.totalInvoices}
               </p>
            </div>
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
               <p className="text-blue-200 text-xs sm:text-sm">Total Revenue</p>
               <p className="text-lg sm:text-2xl font-bold text-white">
                 <FormattedNumberDisplay value={stats.totalRevenue} usePreferredCurrency={true} />
               </p>
            </div>
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 flex-shrink-0" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
               <p className="text-blue-200 text-xs sm:text-sm">Pending</p>
               <p className="text-lg sm:text-2xl font-bold text-white">
                 {stats.pendingCount}
               </p>
            </div>
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
               <p className="text-blue-200 text-xs sm:text-sm">Paid</p>
               <p className="text-lg sm:text-2xl font-bold text-white">
                 {stats.paidCount}
               </p>
            </div>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 flex-shrink-0" />
          </div>
        </motion.div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Only show Create New Invoice card when onboarding is not completed */}
        {(!dataLoaded || isOnboardingCompleted === false) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 transition-colors cursor-pointer min-h-[120px] sm:min-h-auto ${
              subscription?.canCreateInvoice 
                ? 'bg-white/10 hover:bg-white/20' 
                : 'bg-gray-500/20 cursor-not-allowed'
            }`}
            onClick={subscription?.canCreateInvoice ? handleCreateInvoice : undefined}
          >
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                subscription?.canCreateInvoice ? 'bg-blue-600' : 'bg-gray-500'
              }`}>
                {subscription?.canCreateInvoice ? (
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                ) : (
                  <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  {subscription?.canCreateInvoice ? 'Create New Invoice' : 'Invoice Limit Reached'}
                </h3>
                <p className="text-blue-200 text-xs sm:text-sm">
                  {subscription?.canCreateInvoice 
                    ? 'Start with our guided walkthrough' 
                    : 'Upgrade to create more invoices'
                  }
                </p>
              </div>
              {subscription?.canCreateInvoice && (
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer min-h-[120px] sm:min-h-auto"
          onClick={handleManageInvoiceInfo}
        >
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white">Manage Invoice Info</h3>
              <p className="text-blue-200 text-xs sm:text-sm">Configure business information and settings</p>
            </div>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer min-h-[120px] sm:min-h-auto sm:col-span-2 lg:col-span-1"
          onClick={handleManageClients}
        >
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white">Manage Clients</h3>
              <p className="text-blue-200 text-xs sm:text-sm">Add and organize your clients</p>
            </div>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
          </div>
        </motion.div>

        {/* Only show Team Settings for business users with organizations */}
        {session?.user?.userType === 'business' && session?.user?.organizationId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer min-h-[120px] sm:min-h-auto sm:col-span-2 lg:col-span-1"
            onClick={() => router.push('/dashboard/settings/organization')}
          >
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-white">Team Settings</h3>
                <p className="text-blue-200 text-xs sm:text-sm">Configure team permissions</p>
              </div>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Recent Activity - Mobile Optimized */}
      {invoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-white">Recent Invoices</h3>
            <button
              onClick={handleViewInvoices}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice, index) => (
              <motion.div
                key={invoice._id?.toString() || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-h-[60px]"
                onClick={() => {
                  if (invoice.status === 'draft') {
                    router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`);
                  } else {
                    router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id}`);
                  }
                }}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm sm:text-base truncate">{invoice.invoiceNumber || 'Invoice'}</p>
                    <p className="text-blue-200 text-xs sm:text-sm truncate">
                      {invoice.clientDetails?.companyName || 
                       [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 
                       invoice.clientDetails?.email || 'Client'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-white font-semibold text-sm sm:text-base">
                    <FormattedNumberDisplay value={invoice.totalAmount || 0} />
                  </p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'sent' || invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {invoice.status === 'sent' ? 'pending' : invoice.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State - Mobile Optimized */}
      {invoices.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-8 sm:p-12 border border-white/20 text-center"
        >
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No invoices yet</h3>
          <p className="text-blue-200 mb-6 text-sm sm:text-base">
            Create your first invoice to get started with our comprehensive invoicing system.
          </p>
          <button
            onClick={handleCreateInvoice}
            disabled={!subscription?.canCreateInvoice}
            className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-colors mx-auto min-h-[44px] ${
              subscription?.canCreateInvoice
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed'
            }`}
          >
            {subscription?.canCreateInvoice ? (
              <>
                <Plus className="h-5 w-5" />
                <span>Create Your First Invoice</span>
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                <span>Limit Reached</span>
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
        title="View Financial Overview"
      >
        <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6" />
      </Link>
    </div>
  );
} 