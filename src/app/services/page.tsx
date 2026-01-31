'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LockKeyhole, 
  History, 
  Banknote, 
  Network,
  ShieldCheck,
  Fingerprint,
  FileText,
  Receipt,
  Users,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Coins,
  Code,
  Globe2,
  Check,
  X,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { getServices, getUserServiceData, toggleService, updateUserPlan } from '@/lib/actions/services';
import { BILLING_PLANS } from '@/data/billingPlans';
import type { ToggleServiceResult } from '@/lib/actions/services';

interface ServiceDefinition {
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  ready: boolean;
  subscriptionRequired?: {
    plans: string[];
    minTier: string;
  };
}

interface User {
  _id: string;
  email: string;
  name: string;
  services: Record<string, boolean>;
  subscription: {
    planId: string;
    status: string;
  };
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  LockKeyhole,
  History,
  Banknote,
  Network,
  ShieldCheck,
  Fingerprint,
  Receipt,
  Users,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Coins,
  Code,
  Globe2
};

export default function ServicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [services, setServices] = useState<Record<string, ServiceDefinition>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    show: boolean;
    serviceKey: string;
    serviceTitle: string;
    requiredPlans: string[];
    recommendedPlan: string;
  } | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // Load services data (public)
  useEffect(() => {
    loadServices();
  }, []);

  const loadUserData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const result = await getUserServiceData();
      if (result.success && result.data) {
        setUser(result.data);
      }
    } catch (error) {
      console.error('❌ [Services] Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Check authentication only when session status changes
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'authenticated' && session?.user?.id) {
      loadUserData();
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [status, session, loadUserData]);

  const loadServices = async () => {
    try {
      const result = await getServices();
      if (result.success && result.data) {
        setServices(result.data.services || {});
        setCategories(result.data.categories || []);
      } else {
        console.error('Failed to load services:', result.error);
        setServices({});
        setCategories([]);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices({});
      setCategories([]);
    }
  };

  const handleToggleService = async (serviceKey: string) => {
    if (!user || !isAuthenticated) {
      router.push('/auth');
      return;
    }

    setUpdating(serviceKey);
    try {
      const action = user.services?.[serviceKey] ? 'disable' : 'enable';
      const result: ToggleServiceResult = await toggleService(serviceKey, action);
      
      if (result.success && result.user) {
        setUser(result.user);
        // Refresh the page to update subscription context
        window.location.reload();
      } else if (result.requiresUpgrade) {
        // Show upgrade modal
        setUpgradeModal({
          show: true,
          serviceKey: result.requiresUpgrade.serviceKey,
          serviceTitle: result.requiresUpgrade.serviceTitle,
          requiredPlans: result.requiresUpgrade.requiredPlans,
          recommendedPlan: result.requiresUpgrade.recommendedPlan
        });
      } else {
        alert(`Error: ${result.error || 'Failed to update service'}`);
      }
    } catch (error) {
      console.error('Failed to toggle service:', error);
      alert('Failed to update service');
    } finally {
      setUpdating(null);
    }
  };

  const handleUpgrade = async () => {
    if (!upgradeModal) return;

    setUpgrading(true);
    try {
      const result = await updateUserPlan(upgradeModal.recommendedPlan, 'monthly');
      
      if (result.success) {
        // Close modal and refresh user data
        setUpgradeModal(null);
        await loadUserData();
        // Try to enable the service again
        await handleToggleService(upgradeModal.serviceKey);
        // Refresh the page to update subscription context
        window.location.reload();
      } else {
        alert(`Error: ${result.error || 'Failed to upgrade plan'}`);
      }
    } catch (error) {
      console.error('Failed to upgrade plan:', error);
      alert('Failed to upgrade plan');
    } finally {
      setUpgrading(false);
    }
  };

  const handleAuthRedirect = () => {
    router.push('/auth');
  };

  const getPlanName = (planId: string) => {
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    return plan ? plan.name : planId;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
            <div></div> {/* Spacer for centering */}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {isAuthenticated ? 'Manage Your Services' : 'Our Services'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            {isAuthenticated 
              ? 'Enable or disable the blockchain-powered services you need for your business operations.'
              : 'Explore our blockchain-powered services. Sign in to manage and enable services for your business.'
            }
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Ready & Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <LockKeyhole className="h-4 w-4 text-yellow-500" />
              <span>Coming Soon</span>
            </div>
            <div className="flex items-center space-x-2">
              <X className="h-4 w-4 text-gray-400" />
              <span>Disabled</span>
            </div>
          </div>
          {isAuthenticated && user && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block">
              <p className="text-blue-800">
                <strong>Welcome back, {user.name}!</strong>
              </p>
              <div className="mt-2 text-xs text-blue-600">
                Current Plan: <strong>{getPlanName(user.subscription.planId)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Services by Category */}
        {categories.map((category, categoryIndex) => (
          <div key={category} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">
              {category}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(services)
                .filter(([, service]) => service.category === category)
                .map(([serviceKey, service], index) => {
                  const Icon = iconMap[service.icon];
                  const isEnabled = isAuthenticated && user?.services ? (user.services[serviceKey] === true) : false;
                  const isUpdating = updating === serviceKey;
                  const isNotReady = !service.ready;

                  // Check if service requires upgrade
                  const currentPlanId = user?.subscription?.planId || 'receivables-free';
                  const requiresUpgrade = service.subscriptionRequired && 
                    !service.subscriptionRequired.plans.includes(currentPlanId);

                  return (
                    <motion.div
                      key={serviceKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (categoryIndex * 0.1) + (index * 0.05) }}
                      className={`p-6 rounded-xl border-2 transition-all ${
                        isNotReady
                          ? 'cursor-not-allowed opacity-50 bg-gray-100 border-gray-200'
                          : service.ready 
                            ? 'cursor-pointer' 
                            : 'cursor-not-allowed opacity-60'
                      } ${
                        !isNotReady && isEnabled 
                          ? 'bg-green-50 border-green-200 hover:border-green-300' 
                          : !isNotReady
                            ? 'bg-white border-gray-200 hover:border-gray-300'
                            : ''
                      } ${requiresUpgrade && !isNotReady ? 'border-yellow-300 bg-yellow-50' : ''}`}
                      onClick={() => {
                        if (isNotReady) {
                          return;
                        }
                        if (!isAuthenticated && service.ready) {
                          handleAuthRedirect();
                        } else if (service.ready) {
                          handleToggleService(serviceKey);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isNotReady 
                            ? 'bg-gray-300' 
                            : isEnabled 
                              ? 'bg-green-500' 
                              : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-6 w-6 ${
                            isNotReady 
                              ? 'text-gray-500' 
                              : isEnabled 
                                ? 'text-white' 
                                : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex items-center space-x-2">
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          ) : isNotReady ? (
                            <LockKeyhole className="h-5 w-5 text-gray-400" />
                          ) : !service.ready ? (
                            <LockKeyhole className="h-5 w-5 text-yellow-500" />
                          ) : requiresUpgrade ? (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          ) : isAuthenticated && isEnabled ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      <h3 className={`text-lg font-semibold mb-2 ${
                        isNotReady ? 'text-gray-500' : 'text-gray-900'
                      }`}>
                        {service.title}
                        {isNotReady && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                            Not Available
                          </span>
                        )}
                        {!isNotReady && !service.ready && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Coming Soon
                          </span>
                        )}
                        {requiresUpgrade && !isNotReady && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Upgrade Required
                          </span>
                        )}
                      </h3>
                      <p className={`text-sm mb-4 ${
                        isNotReady ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {service.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isNotReady
                            ? 'bg-gray-200 text-gray-500'
                            : !service.ready
                              ? 'bg-yellow-100 text-yellow-800'
                              : requiresUpgrade
                              ? 'bg-yellow-100 text-yellow-800'
                              : isAuthenticated && isEnabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isNotReady ? 'Not Available' :
                           !service.ready ? 'Coming Soon' : 
                           requiresUpgrade ? 'Upgrade Required' :
                           (isAuthenticated && isEnabled ? 'Enabled' : 'Available')}
                        </span>
                        {isNotReady ? (
                          <span className="px-4 py-2 rounded-md text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed">
                            Not Available
                          </span>
                        ) : !service.ready ? (
                          <span className="px-4 py-2 rounded-md text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed">
                            Not Available
                          </span>
                        ) : !isAuthenticated ? (
                          <button
                            onClick={handleAuthRedirect}
                            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          >
                            Sign In to Enable
                          </button>
                        ) : requiresUpgrade ? (
                          <button
                            onClick={() => handleToggleService(serviceKey)}
                            className="px-4 py-2 rounded-md text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors flex items-center space-x-1"
                          >
                            <Sparkles className="h-4 w-4" />
                            <span>Upgrade to Enable</span>
                          </button>
                        ) : (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleToggleService(serviceKey)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              isEnabled
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            } disabled:opacity-50`}
                          >
                            {isUpdating ? 'Updating...' : (isEnabled ? 'Disable' : 'Enable')}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Summary - Only show for authenticated users */}
        {isAuthenticated && user && user.services && (
          <div className="mt-12 p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Service Summary</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Enabled Services</h4>
                <div className="space-y-1">
                  {Object.entries(user.services)
                    .filter(([, enabled]) => enabled)
                    .map(([serviceKey]) => (
                      <div key={serviceKey} className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">
                          {services[serviceKey]?.title || serviceKey}
                        </span>
                      </div>
                    ))}
                  {Object.values(user.services).every(enabled => !enabled) && (
                    <p className="text-sm text-gray-500 italic">No services enabled</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Service Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Services:</span>
                    <span className="text-sm font-medium">{Object.keys(services).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Enabled:</span>
                    <span className="text-sm font-medium text-green-600">
                      {Object.values(user.services).filter(enabled => enabled).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Disabled:</span>
                    <span className="text-sm font-medium text-gray-600">
                      {Object.values(user.services).filter(enabled => !enabled).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Modal */}
        {upgradeModal && upgradeModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Upgrade Required</h3>
                  <p className="text-sm text-gray-600">To enable this service</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  To enable <strong>{upgradeModal.serviceTitle}</strong>, you need to upgrade your plan.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Recommended Plan:</p>
                  <p className="text-lg font-bold text-blue-600">
                    {getPlanName(upgradeModal.recommendedPlan)}
                  </p>
                  {BILLING_PLANS.find(p => p.planId === upgradeModal.recommendedPlan) && (
                    <p className="text-sm text-blue-700 mt-1">
                      ${BILLING_PLANS.find(p => p.planId === upgradeModal.recommendedPlan)?.monthlyPrice}/month
                    </p>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  Note: Since Stripe checkout is not available, your plan will be updated directly in the database.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setUpgradeModal(null)}
                  disabled={upgrading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {upgrading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Upgrading...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Upgrade Now</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
} 
