'use client';

import { useState, useEffect } from 'react';
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
  const [services, setServices] = useState<Record<string, ServiceDefinition>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication and load user data
  useEffect(() => {
    checkAuth();
    loadServices();
  }, []);

  const checkAuth = async () => {
    try {
      // For now, we'll use a simple approach - you can replace this with your auth logic
      const users = await fetch('/api/users').then(res => res.json());
      if (users.success && users.data.length > 0) {
        setUser(users.data[0]); // Use first user for demo
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

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
    if (!user) return;

    setUpdating(serviceKey);
    try {
      const action = user.services[serviceKey] ? 'disable' : 'enable';
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <LockKeyhole className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              You must be logged in to access and manage services.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.href = '/auth'}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => window.location.href = '/test-db'}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Manage Your Services
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Enable or disable the blockchain-powered services you need for your business operations.
          </p>
          {user && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block">
              <p className="text-blue-800">
                <strong>User:</strong> {user.name} ({user.email})
              </p>
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
                  const isEnabled = user?.services[serviceKey] || false;
                  const isUpdating = updating === serviceKey;

                  return (
                    <motion.div
                      key={serviceKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (categoryIndex * 0.1) + (index * 0.05) }}
                      className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${
                        isEnabled 
                          ? 'bg-green-50 border-green-200 hover:border-green-300' 
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleService(serviceKey)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isEnabled ? 'bg-green-500' : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-6 w-6 ${
                            isEnabled ? 'text-white' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex items-center space-x-2">
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          ) : isEnabled ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4">
                        {service.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isEnabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
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
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Summary */}
        {user && (
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