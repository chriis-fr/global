'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/lib/auth-client';
import { 
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
  Globe2,
  Check,
  ArrowRightCircle,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Image from 'next/image';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';

interface User {
  _id: string;
  email: string;
  name: string;
  userType: 'individual' | 'business';
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  taxId?: string;
  onboarding: {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    serviceOnboarding: Record<string, unknown>;
  };
  services: Record<string, boolean>;
}

interface ServiceDefinition {
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  ready: boolean;
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
  Globe2,
  Settings
};

const ONBOARDING_STEPS = [
  { id: 1, title: 'Welcome', description: 'Get started with your account' },
  { id: 2, title: 'Service Selection', description: 'Choose the services you need' },
  { id: 3, title: 'Service Setup', description: 'Configure your selected services' },
  { id: 4, title: 'Complete', description: 'You\'re all set!' }
];

export default function OnboardingPage() {
  const { data: session, status, update: updateSession } = useSession();
  const { onboarding, services: storeServices, setOnboarding, updateOnboarding } = useOnboardingStore();
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Record<string, ServiceDefinition>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [taxID, setTaxID] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Core Invoicing & Payments': true, // Expanded by default
    'Business Operations': false // Collapsed by default
  });
  const hasInitializedRef = useRef(false);
  const isCheckingStatusRef = useRef(false);
  const onboardingRef = useRef(onboarding);
  const redirectingRef = useRef(false);
  
  // Keep ref in sync with onboarding state
  useEffect(() => {
    onboardingRef.current = onboarding;
  }, [onboarding]);

  const loadUserAndServices = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isCheckingStatusRef.current) {
      return;
    }
    
    try {
      if (!session?.user) {
        window.location.href = '/auth';
        return;
      }

      // Double-check onboarding status from API to catch stale sessions (only once)
      if (!hasInitializedRef.current) {
        isCheckingStatusRef.current = true;
        try {
          const statusResponse = await fetch('/api/onboarding/status');
          const statusData = await statusResponse.json();
          
          if (statusData.success && statusData.data?.completed) {
            console.log('✅ [Onboarding] API shows onboarding completed, redirecting to dashboard');
            // Force session refresh
            await updateSession();
            
            // Redirect to dashboard
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 500);
            isCheckingStatusRef.current = false;
            return;
          }
        } catch (error) {
          console.error('❌ [Onboarding] Error checking onboarding status:', error);
          // Continue with normal flow if status check fails
        } finally {
          isCheckingStatusRef.current = false;
        }
      }

      // Create user object from session
      const userObj: User = {
        _id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        userType: session.user.userType || 'individual',
        address: session.user.address || {
          street: '',
          city: '',
          country: '',
          postalCode: ''
        },
        taxId: session.user.taxId || '',
        onboarding: onboardingRef.current || session.user.onboarding || {
          completed: false,
          currentStep: 1,
          completedSteps: [],
          serviceOnboarding: {}
        },
        services: storeServices || session.user.services || {}
      };
      setUser(userObj);
      
      // Initialize tax ID from user data
      setTaxID(userObj.taxId || '');

      // Load services definitions (not user services)
      const servicesResponse = await fetch('/api/services');
      const servicesData = await servicesResponse.json();
      if (servicesData.success) {
        setServices(servicesData.data.services);
        setCategories(servicesData.data.categories);
      }

      // Use onboarding from store or session (only initialize once)
      if (!hasInitializedRef.current) {
        const currentOnboarding = onboardingRef.current;
        if (currentOnboarding && currentOnboarding.currentStep) {
          setCurrentStep(currentOnboarding.currentStep);
        } else if (session.user.onboarding) {
          setCurrentStep(session.user.onboarding.currentStep || 1);
          // Initialize store from session only if not already initialized
          if (!currentOnboarding || !currentOnboarding.currentStep) {
            setOnboarding(
              {
                completed: session.user.onboarding.completed || false,
                currentStep: session.user.onboarding.currentStep || 1,
                completedSteps: session.user.onboarding.completedSteps || [],
                serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
              },
              session.user.services as Record<string, boolean> || {}
            );
          }
        }
        hasInitializedRef.current = true;
      } else {
        // If already initialized, just update current step from store (only if different)
        const storeStep = onboardingRef.current?.currentStep;
        if (storeStep && storeStep !== currentStep) {
          setCurrentStep(storeStep);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, storeServices, setOnboarding, updateSession]); // Removed 'onboarding' and 'currentStep' from deps to prevent infinite loop

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      window.location.href = '/auth';
      return;
    }

    if (session?.user) {
      // Check session data FIRST (fastest, no API call)
      // Consider completed if: completed === true OR currentStep === 4 (final step)
      const sessionCompleted = session.user.onboarding?.completed || session.user.onboarding?.currentStep === 4;
      
      // If session shows onboarding is completed, redirect immediately
      if (sessionCompleted && !redirectingRef.current) {
        redirectingRef.current = true;
        console.log('✅ [Onboarding] Session shows onboarding completed, redirecting to dashboard');
        // Initialize store from session before redirect (only if not already set)
        // Use onboardingRef to check current state without causing re-render
        if (session.user.onboarding && session.user.services && !onboardingRef.current?.completed) {
          setOnboarding(
            {
              completed: true,
              currentStep: session.user.onboarding.currentStep || 4,
              completedSteps: session.user.onboarding.completedSteps || [],
              serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
            },
            session.user.services as Record<string, boolean>
          );
        }
        window.location.href = '/dashboard';
        return;
      }
      
      // If session shows it's not completed, continue with onboarding flow
      // But also check the database directly to catch cases where session is stale
      if (!hasInitializedRef.current && !isCheckingStatusRef.current) {
        loadUserAndServices();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, loadUserAndServices]); // Removed setOnboarding and onboarding from deps to prevent infinite loop

  const updateOnboardingStep = async (step: number, stepData?: Record<string, unknown>) => {
    if (!user) return;

    setUpdating(true);
    try {
      const response = await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.email,
          step,
          stepData,
          completedSteps: [...(user.onboarding.completedSteps || []), step.toString()]
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Check if onboarding is completed from the response
        const isStep4Completed = step === 4;
        const isCompletedFromDB = data.data.onboarding.isCompleted === true;
        const dataCompleted = (data.data.onboarding.data as { completed?: boolean })?.completed;
        const isCompleted = isStep4Completed || isCompletedFromDB || dataCompleted === true;
        
        const updatedOnboarding = {
          completed: isCompleted,
          currentStep: step,
          completedSteps: data.data.onboarding.completedSteps || [],
          serviceOnboarding: data.data.onboarding.serviceOnboarding || {}
        };
        
        console.log('✅ [Onboarding] Step updated:', {
          step,
          isCompleted,
          isCompletedFromDB,
          dataCompleted,
          updatedOnboarding
        });
        
        // Update store
        updateOnboarding(updatedOnboarding);
        
        // Update local state
        setUser(prev => prev ? { ...prev, onboarding: updatedOnboarding } : null);
        setCurrentStep(step);
        
        // If step 4 is completed, refresh session and redirect to dashboard
        if (isStep4Completed || isCompleted) {
          console.log('🔄 [Onboarding] Step 4 completed, refreshing session and redirecting...');
          
          // Force session refresh to update JWT token with new onboarding status
          try {
            await updateSession();
            console.log('✅ [Onboarding] Session refreshed successfully');
          } catch (error) {
            console.error('❌ [Onboarding] Error refreshing session:', error);
          }
          
          // Redirect to dashboard after a short delay to ensure session is updated
          setTimeout(() => {
            console.log('🚀 [Onboarding] Redirecting to dashboard...');
            window.location.href = '/dashboard';
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error updating onboarding step:', error);
    } finally {
      setUpdating(false);
    }
  };

  const toggleService = async (serviceKey: string) => {
    if (!user) return;

    try {
      const action = user.services[serviceKey] ? 'disable' : 'enable';
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceKey,
          action
        }),
      });

      const data = await response.json();
      if (data.success) {
        const updatedServices = data.data.user.services;
        setUser(prev => prev ? { ...prev, services: updatedServices } : null);
        
        // Update store with new services
        if (onboarding) {
          setOnboarding(onboarding, updatedServices);
        }
      } else {
        console.error('Failed to toggle service:', data.message);
      }
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const getEnabledServicesCount = () => {
    if (!user) return 0;
    return Object.entries(user.services)
      .filter(([serviceKey, enabled]) => {
        // Don't count Accounts Receivable separately - it's included with Smart Invoicing
        if (serviceKey === 'accountsReceivable') return false;
        return enabled && services[serviceKey]?.ready;
      })
      .length;
  };

  const getReadyServicesCount = () => {
    // Don't count Accounts Receivable - it's included with Smart Invoicing
    return Object.entries(services)
      .filter(([serviceKey]) => serviceKey !== 'accountsReceivable')
      .filter(([, service]) => service.ready).length;
  };

  // Early redirect check - moved to useEffect to avoid calling setState during render
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !redirectingRef.current) {
      const sessionCompleted = session.user.onboarding?.completed || session.user.onboarding?.currentStep === 4;
      if (sessionCompleted) {
        redirectingRef.current = true;
        // Initialize store from session before redirect
        if (session.user.onboarding && session.user.services && !onboardingRef.current?.completed) {
          setOnboarding(
            {
              completed: true,
              currentStep: session.user.onboarding.currentStep || 4,
              completedSteps: session.user.onboarding.completedSteps || [],
              serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
            },
            session.user.services as Record<string, boolean>
          );
        }
        // Redirect immediately
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]); // Removed setOnboarding from deps to prevent infinite loop

  // Only show loading if we're actually loading data (not during initial status check)
  // Hide loading state during initial status check to avoid irritating UI
  const shouldShowLoading = loading && (hasInitializedRef.current || !isCheckingStatusRef.current);
  
  if (!shouldShowLoading && (status === 'loading' || (loading && !hasInitializedRef.current))) {
    // Return null to hide loading UI during initial status check
    return null;
  }

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Please log in to continue</p>
          <button 
            onClick={() => window.location.href = '/auth'}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <Image
                src="/chainsnobg.png"
                alt="ChainsERP"
                width={40}
                height={40}
                className="bg-white rounded-lg"
              />
              <div className="flex items-center space-x-3">
                <ProfileAvatar
                  src={session?.user?.image}
                  alt={user.name}
                  size="sm"
                  type="user"
                />
                <div>
                  <h1 className="text-lg lg:text-xl font-bold text-white">Welcome, {user.name}!</h1>
                  <p className="text-blue-200 text-sm">Let&apos;s set up your account</p>
                </div>
              </div>
            </div>
            <div className="text-center lg:text-right">
              <div className="flex flex-col items-center lg:items-end space-y-2">
                <div>
                  <p className="text-white text-sm">Step {currentStep} of {ONBOARDING_STEPS.length}</p>
                  <div className="flex justify-center lg:justify-end space-x-1 mt-1">
                    {ONBOARDING_STEPS.map((step) => (
                      <div
                        key={step.id}
                        className={`h-1 w-6 lg:w-8 rounded ${
                          step.id <= currentStep ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center mb-8">
          <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-4 lg:space-y-0">
            {ONBOARDING_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step.id <= currentStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-white/30 text-white/50'
                }`}>
                  {step.id < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    step.id <= currentStep ? 'text-white' : 'text-white/50'
                  }`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${
                    step.id <= currentStep ? 'text-blue-200' : 'text-white/30'
                  }`}>
                    {step.description}
                  </p>
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div className={`hidden lg:block ml-8 w-16 h-0.5 ${
                    step.id < currentStep ? 'bg-blue-600' : 'bg-white/20'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Welcome to Chains ERP!
              </h2>
              <p className="text-lg lg:text-xl text-blue-200 mb-8 max-w-2xl mx-auto px-4">
                You&apos;re about to set up your business management system. 
                Let&apos;s get you started with the services you need.
              </p>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 mb-8 mx-4">
                <h3 className="text-lg font-semibold text-white mb-4">Account Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div>
                    <p className="text-blue-200 text-sm">Account Type</p>
                    <p className="text-white font-medium capitalize">{user.userType || 'Individual'}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Email</p>
                    <p className="text-white font-medium break-all">{user.email}</p>
                  </div>
                </div>
              </div>
              {user.address.country === 'KE' && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 mb-8 mx-4">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    {user.userType === 'business' ? 'Business Tax ID (KRA PIN)' : 'Tax ID (KRA PIN)'}
                  </h3>
                  <p className="text-blue-200 text-sm mb-2">
                    {user.userType === 'business' 
                      ? 'Please enter your business KRA PIN (Personal Identification Number) to verify your business identity.'
                      : 'Please enter your KRA PIN (Personal Identification Number) to verify your identity.'
                    }
                  </p>
                  <input
                    type="text"
                    placeholder={user.userType === 'business' ? 'Enter your business KRA PIN' : 'Enter your KRA PIN'}
                    value={taxID}
                    onChange={(e) => setTaxID(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <button
                onClick={() => updateOnboardingStep(2, { taxId: taxID })}
                disabled={updating}
                className="px-6 lg:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {updating ? 'Loading...' : 'Continue'}
                <ArrowRightCircle className="h-5 w-5" />
              </button>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Choose Your Services
              </h2>
              <p className="text-lg lg:text-xl text-blue-200">
                Select the services you need for your business operations
              </p>

              {/* Services by Category */}
              {categories
                .filter(category => category !== 'Blockchain Benefits' && category !== 'Integrations & APIs')
                .map((category, categoryIndex) => {
                  const isExpanded = expandedCategories[category] ?? true;
                  const isCollapsible = category === 'Business Operations';
                  
                  return (
                    <div key={category} className="mb-8 px-4">
                      <h3 
                        className={`text-lg lg:text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2 flex items-center justify-between ${
                          isCollapsible ? 'cursor-pointer hover:text-blue-300 transition-colors' : ''
                        }`}
                        onClick={() => {
                          if (isCollapsible) {
                            setExpandedCategories(prev => ({
                              ...prev,
                              [category]: !prev[category]
                            }));
                          }
                        }}
                      >
                        <span>{category}</span>
                        {isCollapsible && (
                          <span className="ml-2">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </span>
                        )}
                      </h3>
                      {isExpanded && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(services)
                      .filter(([, service]) => service.category === category)
                      .filter(([serviceKey]) => {
                        // Hide Accounts Receivable - it's automatically enabled with Smart Invoicing
                        return serviceKey !== 'accountsReceivable';
                      })
                      .map(([serviceKey, service]) => {
                        const Icon = iconMap[service.icon] || FileText; // Fallback to FileText if icon not found
                        if (!iconMap[service.icon]) {
                        }
                        const isEnabled = user?.services?.[serviceKey] || false;
                        const isReady = service.ready || false;

                        return (
                          <motion.div
                            key={serviceKey}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: categoryIndex * 0.1 }}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              !isReady 
                                ? 'bg-gray-800/50 border-gray-600 cursor-not-allowed opacity-50' 
                                : isEnabled 
                                  ? 'bg-blue-600/20 border-blue-500 cursor-pointer' 
                                  : 'bg-white/5 border-white/20 hover:border-white/40 cursor-pointer'
                            }`}
                            onClick={() => isReady && toggleService(serviceKey)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isEnabled ? 'bg-blue-600' : isReady ? 'bg-white/10' : 'bg-gray-600'
                              }`}>
                                <Icon className={`h-5 w-5 ${
                                  isEnabled ? 'text-white' : isReady ? 'text-blue-300' : 'text-gray-400'
                                }`} />
                              </div>
                              {!isReady ? (
                                <div className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                                  Coming Soon
                                </div>
                              ) : (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isEnabled 
                                    ? 'bg-blue-600 border-blue-600' 
                                    : 'border-white/30'
                                }`}>
                                  {isEnabled && <Check className="h-3 w-3 text-white" />}
                                </div>
                              )}
                            </div>
                            <h4 className={`font-semibold mb-2 ${
                              isReady ? 'text-white' : 'text-gray-400'
                            }`}>
                              {service.title}
                              {serviceKey === 'smartInvoicing' && (
                                <span className="ml-2 text-xs text-blue-300">(includes Accounts Receivable)</span>
                              )}
                            </h4>
                            <p className={`text-sm ${
                              isReady ? 'text-blue-200' : 'text-gray-500'
                            }`}>
                              {service.description}
                              {serviceKey === 'smartInvoicing' && (
                                <span className="block mt-1 text-xs text-blue-300/80">
                                  Automatically includes Accounts Receivable management
                                </span>
                              )}
                            </p>
                          </motion.div>
                        );
                      })}
                        </div>
                      )}
                    </div>
                  );
                })}

              <div className="text-center mt-8 px-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 inline-block">
                  <p className="text-white">
                    <span className="font-semibold">{getEnabledServicesCount()}</span> of <span className="font-semibold">{getReadyServicesCount()}</span> available services selected
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => updateOnboardingStep(1)}
                    className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => updateOnboardingStep(3)}
                    disabled={getEnabledServicesCount() === 0 || updating}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {getEnabledServicesCount() === 0 ? 'Select at least one service' : 'Continue'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Service Configuration
              </h2>
              <p className="text-lg lg:text-xl text-blue-200 mb-8 px-4">
                Let&apos;s configure your selected services. We&apos;ll start with the most important ones.
              </p>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 mb-8 mx-4">
                <h3 className="text-lg font-semibold text-white mb-4">Selected Services</h3>
                <div className="space-y-2">
                  {Object.entries(user.services)
                    .filter(([serviceKey, enabled]) => {
                      // Don't show Accounts Receivable separately - it's included with Smart Invoicing
                      if (serviceKey === 'accountsReceivable') return false;
                      return enabled && services[serviceKey]?.ready;
                    })
                    .map(([serviceKey]) => (
                      <div key={serviceKey} className="flex items-center space-x-2 text-left">
                        <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-white">
                          {services[serviceKey]?.title || serviceKey}
                          {serviceKey === 'smartInvoicing' && user.services?.accountsReceivable && (
                            <span className="ml-2 text-xs text-blue-300">(includes Accounts Receivable)</span>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="text-center px-4">
                <p className="text-blue-200 mb-6">
                  For now, we&apos;ll focus on setting up your core services. 
                  You can configure additional settings later from your dashboard.
                </p>
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => updateOnboardingStep(2)}
                    className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => updateOnboardingStep(4)}
                    disabled={updating}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Complete Setup
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 lg:p-8 mb-8 mx-4">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                  Welcome to ChainsERP!
                </h2>
                <p className="text-lg lg:text-xl text-blue-200 mb-6">
                  Your account has been successfully set up. You&apos;re ready to go.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-2">Next Steps</h3>
                    <ul className="text-blue-200 text-sm space-y-1 text-left">
                      <li>• Explore your dashboard</li>
                      <li>• Configure your services</li>
                      <li>• Start creating invoices</li>
                      <li>• Connect your crypto wallets</li>
                    </ul>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-2">Selected Services</h3>
                    <p className="text-blue-200 text-sm">
                      You have <span className="font-semibold text-white">{getEnabledServicesCount()}</span> ready services enabled
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => window.location.href = '/services'}
                    className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2 justify-center"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Services
                  </button>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 