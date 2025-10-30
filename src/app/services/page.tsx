'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
  X
} from 'lucide-react';

interface ServiceDefinition {
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  ready: boolean;
}

interface User {
  _id: string;
  email: string;
  name: string;
  services: Record<string, boolean>;
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

  // Load services data (public)
  useEffect(() => {
    loadServices();
  }, []);

  const loadUserData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      console.log('🔍 [Services] Loading user data for:', session.user.id);
      const response = await fetch('/api/users/profile');
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.success) {
          console.log('✅ [Services] User data loaded:', userData.data);
          console.log('🔍 [Services] User services:', userData.data.services);
          setUser(userData.data);
        } else {
          console.log('❌ [Services] Failed to load user data:', userData.error);
        }
      } else {
        console.log('❌ [Services] HTTP error loading user data:', response.status);
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
      // User is logged in, load their data
      loadUserData();
      setIsAuthenticated(true);
    } else {
      // User is not logged in
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [status, session, loadUserData]);

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services');
      const data = await response.json();
      if (data.success) {
        setServices(data.data.services);
        setCategories(data.data.categories);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const toggleService = async (serviceKey: string) => {
    if (!user || !isAuthenticated) {
      // Redirect to auth if not logged in
      router.push('/auth');
      return;
    }

    setUpdating(serviceKey);
    try {
      const action = user.services?.[serviceKey] ? 'disable' : 'enable';
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user._id,
          serviceKey,
          action
        }),
      });

      const data = await response.json();
      if (data.success) {
        setUser(data.data.user);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to toggle service:', error);
      alert('Failed to update service');
    } finally {
      setUpdating(null);
    }
  };

  const handleAuthRedirect = () => {
    router.push('/auth');
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
              onClick={() => window.location.href = '/dashboard'}
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
              {/* Debug info - remove this later */}
              <div className="mt-2 text-xs text-blue-600">
                Enabled services: {Object.entries(user.services || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'None'}
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
                  // Fix: Properly check if service is enabled
                  const isEnabled = isAuthenticated && user?.services ? (user.services[serviceKey] === true) : false;
                  const isUpdating = updating === serviceKey;
                  const isNotReady = !service.ready;

                  console.log(` [Services] Service ${serviceKey}:`, {
                    isAuthenticated,
                    userServices: user?.services,
                    serviceValue: user?.services?.[serviceKey],
                    isEnabled
                  });

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
                      }`}
                      onClick={() => {
                        if (isNotReady) {
                          // Do nothing - service is not ready
                          return;
                        }
                        if (!isAuthenticated && service.ready) {
                          handleAuthRedirect();
                        } else if (service.ready) {
                          toggleService(serviceKey);
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
                              : isAuthenticated && isEnabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isNotReady ? 'Not Available' :
                           !service.ready ? 'Coming Soon' : 
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
                        ) : (
                          <button
                            disabled={isUpdating}
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
      </div>
    </div>
  );
} 