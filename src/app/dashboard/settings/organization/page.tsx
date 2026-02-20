'use client';
import { useState, useEffect, startTransition } from 'react';
import { Building2, Users, Edit, User, Plus, Image, Crown, Settings, ChevronDown, Search, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { countries } from '@/data/countries';
import { LogoManager } from '@/components/LogoManager';
import { LogoDisplay } from '@/components/LogoDisplay';
import { ApprovalSettingsComponent } from '@/components/settings/ApprovalSettings';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { BILLING_PLANS } from '@/data/billingPlans';
import { getOrganizationData, createOrganization, updateOrganization } from '@/lib/actions/organization';

interface OrganizationAddress {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface OrganizationServices {
  smartInvoicing?: boolean;
  accountsPayable?: boolean;
}

interface Organization {
  _id: string;
  name: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  memberCount?: number;
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone: string;
  billingEmail: string;
  address: OrganizationAddress;
  taxId?: string;
  registrationNumber?: string;
  status: 'pending' | 'active' | 'suspended';
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  services?: OrganizationServices;
}

interface OrganizationInfo {
  userType: 'individual' | 'business';
  hasOrganization: boolean;
  organization: Organization | null;
  userRole: string | null;
}

interface CreateOrganizationForm {
  name: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone: string;
  billingEmail: string;
  taxId: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
}

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

export default function OrganizationSettingsPage() {
  const { subscription } = useSubscription();
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPricing = searchParams?.get('from') === 'pricing';
  const fromSubscriptionSuccess = searchParams?.get('from') === 'subscription-success';
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [hasPrefilledForm, setHasPrefilledForm] = useState(false);
  const [formData, setFormData] = useState<CreateOrganizationForm>({
    name: '',
    industry: '',
    companySize: '1-10',
    businessType: 'LLC',
    phone: '',
    billingEmail: session?.user?.email || '',
    taxId: '',
    address: {
      street: '',
      city: '',
      country: '',
      postalCode: ''
    }
  });

  // Load organization data using server action - non-blocking, independent loading (like dashboard)
  useEffect(() => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }
    
    // Load in background using server action - don't block render
    startTransition(async () => {
      try {
        const result = await getOrganizationData();
        if (result.success && result.data) {
          setOrgInfo(result.data as unknown as OrganizationInfo);
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to load organization data' });
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
        setMessage({ type: 'error', text: 'Failed to load organization data' });
      } finally {
        setLoading(false);
      }
    });
  }, [session?.user?.email]);

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (message?.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [message]);

  // Prefill form with user data when showing create form
  // Billing email is ALWAYS set from user's account and cannot be changed
  useEffect(() => {
    if (showCreateForm && session?.user?.email) {
      // Always ensure billing email is set from user's account (cannot be edited)
      setFormData(prev => ({
        ...prev,
        billingEmail: session.user.email || prev.billingEmail
      }));

      // Fetch additional user data to prefill other fields if available (only if empty)
      if (!hasPrefilledForm) {
        const fetchUserData = async () => {
          try {
            const response = await fetch('/api/user/settings');
            const data = await response.json();
            
            if (data.success && data.data?.profile) {
              const profile = data.data.profile;
              setFormData(prev => ({
                ...prev,
                billingEmail: session.user.email || prev.billingEmail, // Always use account email
                phone: prev.phone || profile.phone || '',
                address: {
                  street: prev.address.street || profile.address?.street || '',
                  city: prev.address.city || profile.address?.city || '',
                  // Always prefill country if available from user profile (collected during signup)
                  country: profile.address?.country || prev.address.country || '',
                  postalCode: prev.address.postalCode || profile.address?.postalCode || ''
                },
                industry: prev.industry || profile.industry || '',
                taxId: prev.taxId || profile.taxId || ''
              }));
            }
          } catch (error) {
            console.error('Error fetching user data for prefilling:', error);
            // Non-critical error - just ensure email is set from account
            setFormData(prev => ({
              ...prev,
              billingEmail: session.user.email || prev.billingEmail
            }));
          }
        };

        fetchUserData();
        setHasPrefilledForm(true);
      }
    } else if (!showCreateForm) {
      // Reset prefilled flag when form is closed
      setHasPrefilledForm(false);
    }
  }, [showCreateForm, session?.user?.email, hasPrefilledForm]);

  // Check for pending organization data after payment (when user returns from pricing/subscription success with paid plan or trial)
  useEffect(() => {
    const checkPendingOrganization = async () => {
      if (!subscription || loading) return;
      
      const planId = subscription?.plan?.planId;
      const isPaidPlan = planId && planId !== 'receivables-free' && planId !== 'trial-premium';
      const isTrialActive = subscription?.isTrialActive && planId === 'trial-premium';
      
      // Only proceed if user has paid plan or active trial
      if (!isPaidPlan && !isTrialActive) {
        // If they came from subscription success but don't have paid plan or trial, clear pending data
        if (fromSubscriptionSuccess && typeof window !== 'undefined') {
          localStorage.removeItem('pending_organization_data');
        }
        return;
      }
      
      try {
        const pendingDataStr = localStorage.getItem('pending_organization_data');
        if (!pendingDataStr) return;
        
        const pendingData = JSON.parse(pendingDataStr);
        // Check if data is recent (within 1 hour)
        if (Date.now() - (pendingData.timestamp || 0) > 60 * 60 * 1000) {
          localStorage.removeItem('pending_organization_data');
          return;
        }
        
        // User has paid plan or trial and pending org data - create organization
        setCreating(true);
        const { timestamp, ...orgFormData } = pendingData;
        // Ensure billing email is always from user's account, not from pending data
        const finalFormData = {
          ...orgFormData,
          billingEmail: session?.user?.email || orgFormData.billingEmail || ''
        };
        setFormData(finalFormData);
        
        const result = await createOrganization(finalFormData);

        if (result.success) {
          localStorage.removeItem('pending_organization_data');
          const isTrial = subscription?.isTrialActive && subscription?.plan?.planId === 'trial-premium';
          const successMessage = isTrial 
            ? 'Organization created successfully! Remember to upgrade to a paid plan before your trial ends to maintain access.'
            : 'Organization created successfully! Your payment has been processed and your organization is ready.';
          setMessage({ type: 'success', text: successMessage });
          setShowCreateForm(false);
          setShowCountryDropdown(false);
          await fetchOrganizationData();
          // Clean URL
          router.replace('/dashboard/settings/organization', { scroll: false });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to create organization after payment' });
        }
      } catch (error) {
        console.error('Error creating pending organization:', error);
        localStorage.removeItem('pending_organization_data');
        setMessage({ type: 'error', text: 'Failed to create organization. Please try again.' });
      } finally {
        setCreating(false);
      }
    };

    checkPendingOrganization();
  }, [subscription, loading, fromSubscriptionSuccess, router]);

  // Refetch organization data (using server action for faster loading)
  const fetchOrganizationData = async () => {
    try {
      const result = await getOrganizationData();
      if (result.success && result.data) {
        setOrgInfo(result.data as unknown as OrganizationInfo);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load organization data' });
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    }
  };

  const handleCreateOrganization = async () => {
    if (!formData.name?.trim() || !formData.billingEmail?.trim()) {
      setMessage({ type: 'error', text: 'Please fill in Organization Name and Billing Email.' });
      return;
    }

    // Check if user has access (paid plan OR trial)
    const planId = subscription?.plan?.planId;
    const isPaidPlan = planId && planId !== 'receivables-free' && planId !== 'trial-premium';
    const isTrialActive = subscription?.isTrialActive && planId === 'trial-premium';
    
    // Block free plan users (redirect to pricing)
    if (!isPaidPlan && !isTrialActive) {
      // Store form data temporarily and redirect to pricing
      try {
        localStorage.setItem('pending_organization_data', JSON.stringify({
          ...formData,
          timestamp: Date.now()
        }));
        router.push('/pricing?createOrg=true');
        return;
      } catch (err) {
        console.error('Failed to save pending organization data:', err);
        setMessage({ type: 'error', text: 'Failed to save organization data. Please try again.' });
        return;
      }
    }

    // User has paid plan or trial - proceed with creation using server action
    setCreating(true);
    try {
      const result = await createOrganization(formData);

      if (result.success) {
        const isTrial = subscription?.isTrialActive && subscription?.plan?.planId === 'trial-premium';
        const successMessage = isTrial
          ? `Organization created successfully! You can now collaborate with team members. Remember to upgrade to a paid plan before your trial ends (${subscription?.trialDaysRemaining || 0} ${subscription?.trialDaysRemaining === 1 ? 'day' : 'days'} remaining) to maintain access.`
          : 'Organization created successfully! You can now collaborate with team members.';
        setMessage({ type: 'success', text: successMessage });
        setShowCreateForm(false);
        setShowCountryDropdown(false);
        // Refetch using server action
        await fetchOrganizationData();
        if (fromPricing) {
          router.push('/pricing');
          return;
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to create organization' });
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setMessage({ type: 'error', text: 'Failed to create organization. Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CreateOrganizationForm] as Record<string, string>),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleUpgradeToPro = () => {
    router.push('/pricing');
  };

  const startEditingOrg = () => {
    if (!orgInfo?.organization) return;
    const org = orgInfo.organization;
    const addr = org.address || { street: '', city: '', country: '', postalCode: '' };
    setFormData({
      name: org.name || '',
      industry: org.industry || '',
      companySize: org.companySize || '1-10',
      businessType: org.businessType || 'LLC',
      phone: org.phone || '',
      billingEmail: org.billingEmail || '',
      taxId: org.taxId || '',
      address: {
        street: addr.street || '',
        city: addr.city || '',
        country: addr.country || '',
        postalCode: addr.postalCode || ''
      }
    });
    setIsEditingOrg(true);
  };

  const handleUpdateOrganization = async () => {
    if (!orgInfo?.organization) return;
    if (!formData.name?.trim()) {
      setMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    setSavingOrg(true);
    setMessage(null);
    try {
      const result = await updateOrganization({
        name: formData.name.trim(),
        industry: formData.industry || undefined,
        companySize: formData.companySize,
        businessType: formData.businessType,
        phone: formData.phone || undefined,
        taxId: formData.taxId?.trim() || undefined,
        address: formData.address
      });
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Organization updated.' });
        setIsEditingOrg(false);
        setShowCountryDropdown(false);
        await fetchOrganizationData();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update organization' });
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      setMessage({ type: 'error', text: 'Failed to update organization.' });
    } finally {
      setSavingOrg(false);
    }
  };

  // Get current plan name for display
  const getCurrentPlanName = () => {
    if (!subscription?.plan?.planId) return 'Free Plan';
    const plan = BILLING_PLANS.find(p => p.planId === subscription.plan.planId);
    return plan?.name || subscription.plan.planId;
  };

  // Check if user has organization access (paid plans, trial users, or organization membership)
  // Trial users can create organizations but will be downgraded if they don't pay
  const hasOrganizationAccess = subscription?.canCreateOrganization || (orgInfo?.hasOrganization && orgInfo?.organization);
  const isTrialUser = subscription?.isTrialActive && subscription?.plan?.planId === 'trial-premium';
  const isFreePlan = subscription?.plan?.planId === 'receivables-free';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-blue-200">Manage your organization information and business details.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show upgrade prompt for free plan users
  if (!hasOrganizationAccess) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          {fromPricing && (
            <button
              type="button"
              onClick={() => router.push('/pricing')}
              className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to pricing
            </button>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-blue-200">Manage your organization information and business details.</p>
        </div>

        {/* Upgrade Required Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-yellow-500/20 rounded-full">
              <Crown className="h-12 w-12 text-yellow-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">Upgrade Account to Create Organization</h2>
          <p className="text-blue-200 mb-4 max-w-2xl mx-auto">
            You are currently on the <span className="font-semibold text-white">{getCurrentPlanName()}</span> plan.
          </p>
          <p className="text-blue-200 mb-6 max-w-2xl mx-auto">
            Organization management and team collaboration features are available with our paid plans. 
            Upgrade your account to create organizations, manage team members, and collaborate with your business partners.
          </p>

          <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
            <h3 className="text-blue-300 font-medium mb-4">Pro Plan Benefits:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Create and manage organizations</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Add team members and assign roles</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Role-based access control</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Shared client management</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Team analytics and reporting</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Advanced invoice management</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpgradeToPro}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Crown className="h-5 w-5" />
            <span>Upgrade to Create Organization</span>
          </button>
        </div>

      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        {fromPricing && (
          <button
            type="button"
            onClick={() => router.push('/pricing')}
            className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to pricing
          </button>
        )}
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
        <p className="text-blue-200">
          {orgInfo?.hasOrganization 
            ? 'Manage your organization information and team members.'
            : fromPricing
              ? 'Create an organisation to choose team plans and seats on the pricing page.'
              : 'Create an organization or manage your personal business information.'
          }
        </p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg relative ${
          message.type === 'success' 
            ? 'bg-green-600/20 border border-green-500/50 text-green-200' 
            : 'bg-red-600/20 border border-red-500/50 text-red-200'
        }`}>
          <div className="pr-8">
            {message.text}
          </div>
          <button
            onClick={() => setMessage(null)}
            className="absolute top-2 right-2 text-current opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Individual User - No Organization */}
      {orgInfo?.userType === 'individual' && !orgInfo?.hasOrganization && (
        <div className="space-y-6">
          {/* Personal Account Info */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <User className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Personal Account</h2>
              </div>
            </div>
                         <p className="text-blue-200 mb-4">
               You&apos;re currently using a personal account. Create an organization to collaborate with team members and manage business operations together.
             </p>
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-blue-300 font-medium mb-2">Benefits of creating an organization:</h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Collaborate with team members</li>
                <li>• Manage invoices and payments together</li>
                <li>• Role-based access control</li>
                <li>• Shared client management</li>
                <li>• Team analytics and reporting</li>
              </ul>
            </div>
          </div>

          {/* Create Organization Section */}
          {!showCreateForm ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ready to scale your business?</h3>
                <p className="text-blue-200 mb-6">
                  Create an organization to unlock team collaboration features and manage your business operations more effectively.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Organization</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Create Organization</h3>
                <button
                  onClick={() => { setShowCreateForm(false); setShowCountryDropdown(false); }}
                  className="text-blue-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Trial User Warning */}
              {isTrialUser && (
                <div className="mb-6 bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-yellow-300 font-medium mb-1">Free Trial Active</h4>
                      <p className="text-yellow-200 text-sm">
                        You can create an organization during your free trial. However, if you don't upgrade to a paid plan before your trial ends ({subscription?.trialDaysRemaining || 0} {subscription?.trialDaysRemaining === 1 ? 'day' : 'days'} remaining), your account will be downgraded to the free plan and you may lose access to organization features.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter organization name"
                  />
                </div>
                
                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Technology, Healthcare"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Company Size
                  </label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => handleInputChange('companySize', e.target.value as '1-10' | '11-50' | '51-200' | '200+')}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1-10" className="bg-gray-800 text-white">1-10 employees</option>
                    <option value="11-50" className="bg-gray-800 text-white">11-50 employees</option>
                    <option value="51-200" className="bg-gray-800 text-white">51-200 employees</option>
                    <option value="200+" className="bg-gray-800 text-white">200+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => handleInputChange('businessType', e.target.value as 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship')}
                    className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LLC" className="bg-gray-800 text-white">LLC</option>
                    <option value="Corporation" className="bg-gray-800 text-white">Corporation</option>
                    <option value="Partnership" className="bg-gray-800 text-white">Partnership</option>
                    <option value="Sole Proprietorship" className="bg-gray-800 text-white">Sole Proprietorship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => handleInputChange('taxId', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter tax ID"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Billing Email *
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                    placeholder="Enter billing email"
                  />
                  <p className="text-xs text-blue-300/70 mt-1">
                    This will use your account email ({session?.user?.email || 'your email'})
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-blue-300 font-medium mb-3">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => handleInputChange('address.street', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter street address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => handleInputChange('address.city', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter city"
                    />
                  </div>

                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Country
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
                      >
                        <span className={formData.address.country ? 'text-white' : 'text-gray-400'}>
                          {formData.address.country
                            ? `${countries.find(c => c.code === formData.address.country)?.name ?? formData.address.country} (${formData.address.country})`
                            : 'Search and select country'}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-blue-300 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/20 rounded-lg max-h-60 overflow-hidden z-20 shadow-xl">
                          <div className="p-2 border-b border-white/10">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
                              <input
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Search countries..."
                                className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {countries
                              .filter(c =>
                                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.phoneCode.includes(countrySearch)
                              )
                              .map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange('address.country', c.code);
                                    setShowCountryDropdown(false);
                                    setCountrySearch('');
                                  }}
                                  className="w-full px-3 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-b-0"
                                >
                                  <span className="text-sm">{c.name}</span>
                                  <span className="text-blue-300 text-xs font-medium">{c.code}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.address.postalCode}
                      onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter postal code"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    // Clear pending organization data if user cancels
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('pending_organization_data');
                    }
                    // Reset form but preserve email
                    const userEmail = session?.user?.email || '';
                    setFormData({
                      name: '',
                      industry: '',
                      companySize: '1-10',
                      businessType: 'LLC',
                      phone: '',
                      billingEmail: userEmail,
                      taxId: '',
                      address: {
                        street: '',
                        city: '',
                        country: '',
                        postalCode: ''
                      }
                    });
                    setShowCreateForm(false);
                  }}
                  className="px-4 py-2 text-blue-300 hover:text-white transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOrganization}
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4" />
                      <span>Create Organization</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Organization View */}
      {orgInfo?.hasOrganization && orgInfo.organization && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">{orgInfo.organization.name}</h2>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  orgInfo.userRole === 'owner' 
                    ? 'bg-yellow-600/20 text-yellow-300' 
                    : orgInfo.userRole === 'admin'
                    ? 'bg-purple-600/20 text-purple-300'
                    : 'bg-blue-600/20 text-blue-300'
                }`}>
                  {orgInfo.userRole === 'owner' ? 'Owner' : 
                   orgInfo.userRole === 'admin' ? 'Admin' : 
                   orgInfo.userRole === 'member' ? 'Member' : 
                   orgInfo.userRole || 'Unknown'}
                </span>
              </div>
              <div className="flex space-x-2">
                {(orgInfo.userRole === 'owner' || orgInfo.userRole === 'admin') && (
                  <button
                    onClick={startEditingOrg}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
                <a
                  href="/dashboard/settings/organization/members"
                  className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-1"
                >
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                </a>
              </div>
            </div>
            
            {isEditingOrg ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Edit Organization</h3>
                  <button
                    onClick={() => setIsEditingOrg(false)}
                    className="text-blue-300 hover:text-white transition-colors"
                    disabled={savingOrg}
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Organization Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Technology, Healthcare"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Company Size</label>
                    <select
                      value={formData.companySize}
                      onChange={(e) => handleInputChange('companySize', e.target.value as '1-10' | '11-50' | '51-200' | '200+')}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1-10" className="bg-gray-800 text-white">1-10 employees</option>
                      <option value="11-50" className="bg-gray-800 text-white">11-50 employees</option>
                      <option value="51-200" className="bg-gray-800 text-white">51-200 employees</option>
                      <option value="200+" className="bg-gray-800 text-white">200+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Business Type</label>
                    <select
                      value={formData.businessType}
                      onChange={(e) => handleInputChange('businessType', e.target.value as 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship')}
                      className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LLC" className="bg-gray-800 text-white">LLC</option>
                      <option value="Corporation" className="bg-gray-800 text-white">Corporation</option>
                      <option value="Partnership" className="bg-gray-800 text-white">Partnership</option>
                      <option value="Sole Proprietorship" className="bg-gray-800 text-white">Sole Proprietorship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Tax ID</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => handleInputChange('taxId', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter tax ID"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">Billing Email</label>
                    <input
                      type="email"
                      value={formData.billingEmail}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed text-sm"
                    />
                    <p className="text-xs text-blue-300/70 mt-1">
                      This uses your account email ({session?.user?.email || 'your email'})
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <h4 className="text-blue-300 font-medium mb-3">Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-blue-300 text-sm font-medium mb-2">Street</label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => handleInputChange('address.street', e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter street address"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-300 text-sm font-medium mb-2">City</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => handleInputChange('address.city', e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-300 text-sm font-medium mb-2">Country</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
                        >
                          <span className={formData.address.country ? 'text-white' : 'text-gray-400'}>
                            {formData.address.country
                              ? `${countries.find(c => c.code === formData.address.country)?.name ?? formData.address.country} (${formData.address.country})`
                              : 'Search and select country'}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-blue-300 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/20 rounded-lg max-h-60 overflow-hidden z-20 shadow-xl">
                            <div className="p-2 border-b border-white/10">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
                                <input
                                  type="text"
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  placeholder="Search countries..."
                                  className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {countries
                                .filter(c =>
                                  c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                  c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                  c.phoneCode.includes(countrySearch)
                                )
                                .map(c => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      handleInputChange('address.country', c.code);
                                      setShowCountryDropdown(false);
                                      setCountrySearch('');
                                    }}
                                    className="w-full px-3 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-b-0"
                                  >
                                    <span className="text-sm">{c.name}</span>
                                    <span className="text-blue-300 text-xs font-medium">{c.code}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-blue-300 text-sm font-medium mb-2">Postal Code</label>
                      <input
                        type="text"
                        value={formData.address.postalCode}
                        onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter postal code"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => { setIsEditingOrg(false); setShowCountryDropdown(false); }}
                    className="px-4 py-2 text-blue-300 hover:text-white transition-colors"
                    disabled={savingOrg}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateOrganization}
                    disabled={savingOrg}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    {savingOrg ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm w-full">
              <div>
                <span className="text-blue-300">Industry:</span>
                <span className="text-white ml-2">{orgInfo.organization.industry}</span>
              </div>
              <div>
                <span className="text-blue-300">Company Size:</span>
                <span className="text-white ml-2">
                  {orgInfo.organization.companySize}
                  {orgInfo.organization.memberCount && (
                    <span className="text-blue-200 text-xs ml-1">
                      ({orgInfo.organization.memberCount} members)
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-blue-300">Business Type:</span>
                <span className="text-white ml-2">{orgInfo.organization.businessType}</span>
              </div>
              <div>
                <span className="text-blue-300">Phone:</span>
                <span className="text-white ml-2">{orgInfo.organization.phone}</span>
              </div>
              <div>
                <span className="text-blue-300">Billing Email:</span>
                <span className="text-white ml-2">{orgInfo.organization.billingEmail}</span>
              </div>
              {(orgInfo.organization.taxId != null && orgInfo.organization.taxId !== '') && (
                <div>
                  <span className="text-blue-300">Tax ID:</span>
                  <span className="text-white ml-2">{orgInfo.organization.taxId}</span>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-blue-300">Address:</span>
                <span className="text-white ml-2 break-words">
                  {orgInfo.organization.address?.street}, {orgInfo.organization.address?.city}, {orgInfo.organization.address?.country} {orgInfo.organization.address?.postalCode}
                </span>
              </div>
            </div>
            )}
          </div>

          {/* Logo Management Section */}
          <div className="bg-white/10 mb-4 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Image className="h-6 w-6 text-blue-400" aria-label="Logo management icon" />
                <h3 className="text-lg font-semibold text-white">Logo Management</h3>
              </div>
            </div>
            <p className="text-blue-200 text-sm mb-6">
              Upload and manage your organization logos for use in invoices and other business documents. 
              You can have multiple logos for different occasions and set one as your default.
            </p>
            <LogoManager 
              onLogoSelectAction={setSelectedLogo}
              selectedLogoId={selectedLogo?.id}
            />

            {selectedLogo && (
              <div className="mt-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-blue-300 font-medium mb-2">Selected Logo:</h3>
                                              <div className="flex items-center space-x-3">
                  <LogoDisplay
                    logoUrl={selectedLogo.url}
                    alt={selectedLogo.name}
                    size={48}
                  />
                  <div>
                    <p className="text-white font-medium">{selectedLogo.name}</p>
                    <p className="text-blue-200 text-sm">
                      {selectedLogo.isDefault ? 'Default Logo' : 'Custom Logo'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Settings Section - only when org has Smart Invoicing and/or Accounts Payable */}
      {orgInfo?.hasOrganization && (() => {
        const orgServices = orgInfo.organization?.services;
        const hasApprovalRelevantService = orgServices && (orgServices.smartInvoicing === true || orgServices.accountsPayable === true);
        if (!hasApprovalRelevantService) {
          return (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-2">Approval Settings</h2>
              <p className="text-blue-200 text-sm">
                Approval workflows are available when your organization has <strong>Smart Invoicing</strong> or <strong>Accounts Payable</strong> enabled. Enable these in <a href="/dashboard/services" className="text-blue-400 hover:underline">Services</a> to configure approval for invoices and bills.
              </p>
            </div>
          );
        }
        const forInvoices = orgServices?.smartInvoicing === true;
        const forBills = orgServices?.accountsPayable === true;
        const scopeLabel = forInvoices && forBills
          ? 'invoices and bills'
          : forInvoices
            ? 'invoices'
            : 'bills';
        return (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Approval Settings</h2>
            </div>
            <p className="text-blue-200 text-sm mb-6">
              Configure approval workflows and rules for your organization&apos;s {scopeLabel}. These settings apply only to the services you have enabled (Smart Invoicing for invoices, Accounts Payable for bills).
            </p>
            <ApprovalSettingsComponent />
          </div>
        );
      })()}

    </div>
  );
} 