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
  Calendar, 
  TrendingUp,
  ArrowRight,
  Settings,
  Users,
  List,
  Building2,
  LayoutDashboard,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  Edit3,
  Trash2,
  FileText
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';

// Cache key for localStorage
const CACHE_KEY = 'payables-cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface Payable {
  _id: string;
  payableNumber: string;
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
    if (!session?.user) return;
    
    // Try to load from cache first (unless force refresh)
    if (!forceRefresh && loadCachedData()) {
      return;
    }
    
    // Don't reload if we already have data and not forcing refresh
    if (dataLoaded && !forceRefresh) return;
    
    try {
      setLoading(true);
      
      // Load payables with stats and check onboarding status in parallel
      const [payablesResponse, onboardingResponse] = await Promise.all([
        fetch('/api/payables?convertToPreferred=true'),
        fetch('/api/onboarding/service?service=accountsPayable')
      ]);
      
      const payablesData = await payablesResponse.json();
      
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

  const handleCreatePayable = () => {
    // Only check onboarding if we have the data, otherwise assume it's completed
    if (dataLoaded && isOnboardingCompleted === false) {
      router.push('/dashboard/services/payables/onboarding');
    } else {
      router.push('/dashboard/services/payables/create');
    }
  };

  const handleDeletePayable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payable?')) return;
    
    try {
      const response = await fetch(`/api/payables/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh data
        loadAllData(true);
      } else {
        alert('Failed to delete payable');
      }
    } catch (error) {
      console.error('Error deleting payable:', error);
      alert('Error deleting payable');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && !dataLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Receipt className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Accounts Payable</h1>
                <p className="text-sm text-gray-500">Manage your business payments and vendor relationships</p>
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
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Payables</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPayables}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Paid</p>
                <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  <FormattedNumberDisplay value={stats.totalAmount} />
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Payables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Payables</h2>
              <Link
                href="/dashboard/services/payables/payables"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {payables.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payables yet</h3>
                <p className="text-gray-500 mb-6">Get started by creating your first payable.</p>
                <button
                  onClick={handleCreatePayable}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Payable</span>
                </button>
              </div>
            ) : (
              payables.slice(0, 5).map((payable) => (
                <div key={payable._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {payable.vendorCompany || payable.vendorName}
                          </p>
                          <p className="text-sm text-gray-500">#{payable.payableNumber}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payable.status)}`}>
                          {payable.status}
                        </span>
                        {payable.priority && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(payable.priority)}`}>
                            {payable.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          <FormattedNumberDisplay value={payable.total} />
                        </p>
                        <p className="text-sm text-gray-500">{payable.currency}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => router.push(`/dashboard/services/payables/payables/${payable._id}`)}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded-lg hover:bg-white/10"
                          title="View Payable"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {payable.status === 'draft' && (
                          <button
                            onClick={() => router.push(`/dashboard/services/payables/create?id=${payable._id}`)}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded-lg hover:bg-white/10"
                            title="Edit Payable"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePayable(payable._id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1 rounded-lg hover:bg-white/10"
                          title="Delete Payable"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Link
            href="/dashboard/services/payables/create"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Payable</h3>
                <p className="text-gray-500">Add a new bill or expense</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/vendors"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Vendors</h3>
                <p className="text-gray-500">View and edit vendor information</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/services/payables/payables"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">All Payables</h3>
                <p className="text-gray-500">View complete payable history</p>
              </div>
            </div>
          </Link>
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
