'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Plus, 
  Receipt, 
  DollarSign, 
  Users,
  LayoutDashboard,
  Clock,
  CheckCircle,
  Eye,
  Edit3
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';

// Cache key for localStorage
const CACHE_KEY = 'payables-cache';
const CACHE_DURATION = 30 * 1000; // 30 seconds - short cache for real-time updates

interface Payable {
  _id: string;
  payableNumber: string;
  companyName?: string; // Sender's company name (who sent the invoice)
  vendorName: string;
  vendorCompany?: string;
  vendorEmail: string;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  dueDate: string;
  issueDate: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface PayableStats {
  totalPayables: number;
  pendingCount: number;
  paidCount: number;
  totalAmount: number;
}

interface CachedData {
  payables: Payable[];
  stats: PayableStats;
  isOnboardingCompleted: boolean | null;
  timestamp: number;
}

export default function AccountsPayablePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  console.log('🔍 [Payables Page] Component loaded');
  console.log('🔍 [Payables Page] Session:', session);

  const [payables, setPayables] = useState<Payable[]>([]);
  const [stats, setStats] = useState<PayableStats>({
    totalPayables: 0,
    pendingCount: 0,
    paidCount: 0,
    totalAmount: 0
  });
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'bills' | 'direct-payments' | 'vendors'>('bills');

  // Load cached data from localStorage
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const now = Date.now();
        
        if (now - data.timestamp < CACHE_DURATION) {
          setPayables(data.payables);
          setStats(data.stats);
          setIsOnboardingCompleted(data.isOnboardingCompleted);
          setDataLoaded(true);
          return true;
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.error('❌ [Accounts Payable] Error loading cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
    return false;
  }, []);

  // Save data to cache
  const saveToCache = useCallback((payables: Payable[], stats: PayableStats, isOnboardingCompleted: boolean | null) => {
    try {
      const cacheData: CachedData = {
        payables,
        stats,
        isOnboardingCompleted,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('❌ [Accounts Payable] Error saving to cache:', error);
    }
  }, []);

  // Load all data in parallel
  const loadAllData = useCallback(async (forceRefresh = false) => {
    console.log('🔍 [Payables Page] loadAllData called, forceRefresh:', forceRefresh);
    if (!session?.user) {
      console.log('🔍 [Payables Page] No session user, returning early');
      return;
    }
    
    // Try to load from cache first (unless force refresh)
    if (!forceRefresh && loadCachedData()) {
      console.log('🔍 [Payables Page] Using cached data, skipping API call');
      return;
    }
    console.log('🔍 [Payables Page] Cache miss or force refresh, calling API');
    
    // Don't reload if we already have data and not forcing refresh
    if (dataLoaded && !forceRefresh) return;
    
    try {
      setLoading(true);
      
      // Load payables with stats and check onboarding status in parallel
      console.log('🔍 [Frontend] Loading payables for user:', session.user.email);
      const [payablesResponse, onboardingResponse] = await Promise.all([
        fetch('/api/payables?convertToPreferred=true'),
        fetch('/api/onboarding/service?service=accountsPayable')
      ]);
      
      console.log('🔍 [Frontend] Payables response status:', payablesResponse.status);
      const payablesData = await payablesResponse.json();
      console.log('🔍 [Frontend] Payables data:', payablesData);
      
      let currentPayables: Payable[] = [];
      let currentStats: PayableStats = {
        totalPayables: 0,
        pendingCount: 0,
        paidCount: 0,
        totalAmount: 0
      };
      
      if (payablesData.success) {
        currentPayables = payablesData.data.payables || [];
        const apiStats = payablesData.data.stats;
        
        setPayables(currentPayables);
        currentStats = {
          totalPayables: apiStats.totalPayables || 0,
          pendingCount: (apiStats.statusCounts?.pending || 0) + (apiStats.statusCounts?.approved || 0),
          paidCount: apiStats.statusCounts?.paid || 0,
          totalAmount: apiStats.totalAmount || 0
        };
        setStats(currentStats);
      }
      
      const onboardingData = await onboardingResponse.json();
      let onboardingCompleted = null;
      if (onboardingData.success) {
        onboardingCompleted = onboardingData.data.isCompleted;
        setIsOnboardingCompleted(onboardingCompleted);
      }
      
      // Save to cache
      saveToCache(currentPayables, currentStats, onboardingCompleted);
    } catch (error) {
      console.error('❌ [Accounts Payable Dashboard] Error loading data:', error);
      console.error('❌ [Accounts Payable Dashboard] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [session?.user, dataLoaded, loadCachedData, saveToCache]);

  useEffect(() => {
    console.log('🔍 [Payables Page] useEffect triggered, session:', session?.user?.email);
    if (session?.user) {
      console.log('🔍 [Payables Page] Loading data for user:', session.user.email);
      // Load data (will use cache if available and valid)
      loadAllData(false);
    } else {
      console.log('🔍 [Payables Page] No session user, skipping data load');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]); // Intentionally exclude loadAllData to prevent infinite loops

  // Refresh completion status when returning from onboarding
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('refresh') === 'true') {
      // Remove the refresh parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Force refresh data
      loadAllData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally exclude loadAllData to prevent infinite loops

  // Refresh data when page becomes visible (e.g., returning from payable detail)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && dataLoaded) {
        // Page became visible and we have data loaded, refresh it
        loadAllData(true);
      }
    };

    const handleFocus = () => {
      if (dataLoaded) {
        // Window gained focus, refresh data
        loadAllData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]); // Only depend on dataLoaded to avoid infinite loops

  const handleCreatePayable = () => {
    // Only check onboarding if we have the data, otherwise assume it's completed
    if (dataLoaded && isOnboardingCompleted === false) {
      router.push('/dashboard/services/payables/onboarding');
    } else {
      router.push('/dashboard/services/payables/create');
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-blue-300 bg-blue-500/20';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-blue-300 bg-blue-500/20';
    }
  };


  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Loading payables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br ">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b rounded-lg border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Receipt className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-xl font-semibold text-white">Accounts Payable</h1>
                <p className="text-sm text-blue-200">Manage your business payments and vendor relationships</p>
              </div>
            </div>
            <button
              onClick={handleCreatePayable}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Payable</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Total Payables</p>
                <p className="text-2xl font-bold text-white">{stats.totalPayables}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Receipt className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Paid</p>
                <p className="text-2xl font-bold text-green-400">{stats.paidCount}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-white">
                  <FormattedNumberDisplay value={stats.totalAmount} />
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-400" />
              </div>
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
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Bills & Invoices</h3>
                  <button
                    onClick={handleCreatePayable}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Bill</span>
                  </button>
                </div>
                
                {payables.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No bills yet</h3>
                    <p className="text-blue-200 mb-6">Get started by adding your first bill or invoice.</p>
                    <button
                      onClick={handleCreatePayable}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Bill</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payables.slice(0, 10).map((payable) => (
                      <div key={payable._id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {payable.companyName || payable.vendorCompany || payable.vendorName}
                              </p>
                              <p className="text-sm text-blue-300">#{payable.payableNumber}</p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payable.status)}`}>
                              {payable.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              <FormattedNumberDisplay value={payable.total} />
                            </p>
                            <p className="text-sm text-blue-300">{payable.currency}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => router.push(`/dashboard/services/payables/payables/${payable._id}`)}
                              className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50"
                              title="View Bill"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {payable.status === 'draft' && (
                              <button
                                onClick={() => router.push(`/dashboard/services/payables/create?id=${payable._id}`)}
                                className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50"
                                title="Edit Bill"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {payables.length > 10 && (
                      <div className="text-center pt-4">
                        <Link
                          href="/dashboard/services/payables/payables"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                        >
                          View all bills →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
        title="View Financial Overview"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
}
