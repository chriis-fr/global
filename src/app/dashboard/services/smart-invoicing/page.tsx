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
  Settings,
  Users,
  List,
  Building2,
  LayoutDashboard,
  AlertCircle
} from 'lucide-react';
import { InvoiceService, InvoiceStats } from '@/lib/services/invoiceService';
import { Invoice } from '@/models/Invoice';

// Cache key for localStorage
const CACHE_KEY = 'smart-invoicing-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  invoices: Invoice[];
  stats: InvoiceStats;
  isOnboardingCompleted: boolean | null;
  timestamp: number;
}

export default function SmartInvoicingPage() {
  const router = useRouter();
  const { data: session } = useSession();
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
      return;
    }
    
    // Don't reload if we already have data and not forcing refresh
    if (dataLoaded && !forceRefresh) return;
    
    try {
      setLoading(true);
      
      // Load invoices and check onboarding status in parallel
      const [invoicesData, onboardingResponse] = await Promise.all([
        forceRefresh ? InvoiceService.refreshInvoices() : InvoiceService.getInvoices(),
        fetch('/api/onboarding/service?service=smartInvoicing')
      ]);
      
      // Process invoices
      setInvoices(invoicesData);
      const calculatedStats = InvoiceService.getStats(invoicesData);
      setStats(calculatedStats);
      
      // Process onboarding status
      const onboardingData = await onboardingResponse.json();
      let onboardingCompleted = null;
      if (onboardingData.success) {
        onboardingCompleted = onboardingData.data.isCompleted;
        setIsOnboardingCompleted(onboardingCompleted);

      }
      
      // Save to cache
      saveToCache(invoicesData, calculatedStats, onboardingCompleted);
    } catch (error) {
      console.error('❌ [Smart Invoicing Dashboard] Error loading data:', error);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [session?.user, dataLoaded, loadCachedData, saveToCache]);

  useEffect(() => {
    if (session?.user) {
      // Force refresh on page load to ensure fresh data
      loadAllData(true);
    }
  }, [session?.user, loadAllData]);

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
  }, [loadAllData]);

  const handleCreateInvoice = () => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Smart Invoicing</h1>
          <p className="text-blue-200">
            Create, manage, and get paid with both fiat and blockchain payments seamlessly
          </p>
        </div>
        <div className="flex space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleViewInvoices}
            className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <List className="h-5 w-5" />
            <span>View Invoices</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>
              {!dataLoaded && loading ? 'Loading...' : 
               dataLoaded && isOnboardingCompleted === false ? 'Setup & Create Invoice' : 
               'Create Invoice'}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Service Onboarding Check */}
      {!loading && isOnboardingCompleted === false && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-6"
        >
          <div className="flex items-start space-x-4">
            <AlertCircle className="h-6 w-6 text-yellow-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-100 mb-2">
                Service Setup Required
              </h3>
              <p className="text-yellow-200 mb-4">
                Before you can create invoices, you need to configure your business information and invoice settings. 
                Click &quot;Manage Invoice Info&quot; above or &quot;Complete Setup&quot; below to get started.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSetupService}
                className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span>Complete Setup</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Invoices</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.totalInvoices}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : `$${stats.totalRevenue.toLocaleString()}`}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Pending</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.pendingCount}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Paid</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.paidCount}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-400" />
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={handleCreateInvoice}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create New Invoice</h3>
              <p className="text-blue-200 text-sm">Start with our guided walkthrough</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={handleManageInvoiceInfo}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Manage Invoice Info</h3>
              <p className="text-blue-200 text-sm">Configure business information and settings</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          onClick={handleManageClients}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Manage Clients</h3>
              <p className="text-blue-200 text-sm">Add and organize your clients</p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
          </div>
        </motion.div>

        {/* Only show Team Settings for business users with organizations */}
        {session?.user?.userType === 'business' && session?.user?.organizationId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
            onClick={() => router.push('/dashboard/settings/organization')}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Team Settings</h3>
                <p className="text-blue-200 text-sm">Configure team permissions</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-400 ml-auto" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Recent Activity */}
      {invoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
            <button
              onClick={handleViewInvoices}
              className="text-blue-400 hover:text-blue-300 text-sm"
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
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{invoice.invoiceNumber || 'Invoice'}</p>
                    <p className="text-blue-200 text-sm">
                      {invoice.clientDetails?.companyName || invoice.clientDetails?.email || 'Client'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">
                    ${(invoice.totalAmount || 0).toLocaleString()}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {invoice.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {invoices.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center"
        >
          <FileText className="h-16 w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No invoices yet</h3>
          <p className="text-blue-200 mb-6">
            Create your first invoice to get started with our comprehensive invoicing system.
          </p>
          <button
            onClick={handleCreateInvoice}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Invoice</span>
          </button>
        </motion.div>
      )}

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
} 