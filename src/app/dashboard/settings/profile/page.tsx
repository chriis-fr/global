'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, Crown, ArrowRight, Upload, User, FileText, Calendar, Zap } from 'lucide-react';
import NextImage from 'next/image';
import { fiatCurrencies } from '@/data/currencies';
import { BILLING_PLANS } from '@/data/billingPlans';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

/** Resolve plan display info from planId (matches billingPlans.ts) */
function getPlanDetails(planId: string | undefined) {
  if (!planId) return { name: 'Free Plan', description: 'Starter plan', type: 'Receivables', tier: 'Starter' };
  const plan = BILLING_PLANS.find(p => p.planId === planId);
  if (plan) {
    const type = plan.type === 'receivables' ? 'Receivables' : plan.type === 'payables' ? 'Payables' : plan.type === 'combined' ? 'Combined' : 'Trial';
    const tier = plan.tier ? plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1) : '';
    return {
      name: plan.name,
      description: plan.description,
      type,
      tier,
      isEnterprise: (plan as { isEnterprise?: boolean }).isEnterprise ?? false,
    };
  }
  const typeMap: Record<string, string> = {
    receivables: 'Receivables',
    payables: 'Payables',
    combined: 'Combined',
    trial: 'Trial',
  };
  const parts = planId.split('-');
  const type = typeMap[parts[0]] ?? parts[0];
  const tier = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
  return { name: `${type} ${tier}`, description: '', type, tier, isEnterprise: false };
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  userType: 'individual' | 'business';
  organizationName?: string;
  industry?: string;
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  taxId?: string;
  currencyPreference?: string;
  profilePhoto?: string;
  isGoogleUser?: boolean;
}


export default function ProfileSettingsPage() {
  const router = useRouter();
  const { subscription } = useSubscription();
  const { update: updateSession } = useSession();
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    userType: 'individual',
    organizationName: '',
    industry: '',
    address: {
      street: '',
      city: '',
      country: '',
      postalCode: ''
    },
    taxId: '',
    currencyPreference: 'USD'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [isGoogleUser, setIsGoogleUser] = useState<boolean>(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const { setPreferredCurrency } = useCurrency();

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/settings');
      const data = await response.json();
      
      if (data.success) {
        setFormData(data.data.profile);
        setProfilePhoto(data.data.profile.profilePhoto || '');
        setIsGoogleUser(data.data.profile.isGoogleUser || false);
      } else {
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCurrencyChange = (currencyCode: string) => {
    setFormData(prev => ({
      ...prev,
      currencyPreference: currencyCode
    }));
    setShowCurrencyDropdown(false);
    setCurrencySearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'profile',
          data: formData
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Update the currency context if currency preference was changed
        if (formData.currencyPreference) {
          setPreferredCurrency(formData.currencyPreference);
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  // Handle upgrade
  const handleUpgrade = () => {
    router.push('/pricing');
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select a valid image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    try {
      setSaving(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const response = await fetch('/api/user/profile-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setProfilePhoto(data.data.profilePhoto);
        setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
        await updateSession?.();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update profile photo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile photo' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProfilePhoto = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/user/profile-photo', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setProfilePhoto('');
        setMessage({ type: 'success', text: 'Profile photo removed successfully!' });
        await updateSession?.();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to remove profile photo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove profile photo' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-blue-200">Manage your personal information and account settings.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Profile Settings</h1>
        <p className="text-blue-200">Manage your personal information and account settings.</p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-600/20 border border-green-500/50 text-green-200' 
            : 'bg-red-600/20 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-6">
          {formData.userType === 'business' ? 'Organization Information' : 'Personal Information'}
        </h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter your email"
                required
                disabled
              />
              <p className="text-xs text-blue-200 mt-1">Email cannot be changed</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter your phone number"
              />
            </div>
            {formData.userType === 'business' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Industry</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter industry"
                />
              </div>
            )}
          </div>

          {/* Currency Preference Section */}
          <div className="relative">
            <label className="block text-sm font-medium text-white mb-2">Preferred Currency</label>
            <p className="text-xs text-blue-200 mb-3">
              This currency will be used to display all monetary values throughout the app. 
              Invoices can still be created in different currencies, but they will be converted to your preferred currency for display.
            </p>
            <div className="relative currency-dropdown-container" style={{ zIndex: 9999 }}>
              <button
                type="button"
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 text-left flex items-center justify-between"
              >
                <span className={formData.currencyPreference ? 'text-white' : 'text-gray-400'}>
                  {formData.currencyPreference 
                    ? `${formData.currencyPreference} - ${fiatCurrencies.find(c => c.code === formData.currencyPreference)?.name}`
                    : 'Select currency'}
                </span>
                <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showCurrencyDropdown && (
                <div className="fixed z-[9999] w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden" style={{ width: 'calc(100% - 2rem)', maxWidth: '400px' }}>
                  <div className="p-2 border-b border-gray-600">
                    <input
                      type="text"
                      placeholder="Search currencies..."
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {fiatCurrencies
                      .filter(currency => 
                        currency.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
                        currency.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                        currency.symbol.toLowerCase().includes(currencySearch.toLowerCase())
                      )
                      .map(currency => (
                      <button
                        key={currency.code}
                        type="button"
                        onClick={() => handleCurrencyChange(currency.code)}
                        className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center justify-between border-b border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">{currency.name}</span>
                          <span className="text-blue-300 text-xs font-medium">{currency.symbol}</span>
                        </div>
                        <span className="text-gray-400 text-xs font-medium">{currency.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {formData.userType === 'business' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tax ID (KRA PIN)</label>
              <input
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter tax ID"
              />
            </div>
          )}

          {formData.userType === 'business' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Address</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="address.street"
                  value={formData.address?.street}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    address: { ...prev.address!, street: e.target.value }
                  }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Street address"
                />
                <input
                  type="text"
                  name="address.city"
                  value={formData.address?.city}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    address: { ...prev.address!, city: e.target.value }
                  }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="City"
                />
                <input
                  type="text"
                  name="address.country"
                  value={formData.address?.country}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    address: { ...prev.address!, country: e.target.value }
                  }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Country"
                />
                <input
                  type="text"
                  name="address.postalCode"
                  value={formData.address?.postalCode}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    address: { ...prev.address!, postalCode: e.target.value }
                  }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Postal code"
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Subscription Plan Section */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <Crown className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Subscription Plan</h2>
          </div>
          <button
            onClick={handleUpgrade}
            className="flex items-center space-x-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm font-medium text-sm"
          >
            <span>Change plan</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {subscription?.plan ? (
          <>
            {(() => {
              const planId = subscription.plan.planId;
              const details = getPlanDetails(planId);
              const limits = subscription.limits;
              const usage = subscription.usage;
              const invoiceLimit = limits?.invoicesPerMonth ?? 0;
              const invoiceUsage = usage?.invoicesThisMonth ?? 0;
              const isUnlimited = invoiceLimit === -1;
              const status = subscription.status;
              const isPastDue = status === 'past_due';
              const isTrial = planId === 'trial-premium' || planId === 'receivables-free';
            return (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Crown className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-lg">{details.name}</h3>
                    <p className="text-blue-200 text-sm mt-0.5">
                      {details.type}{details.tier ? ` · ${details.tier}` : ''}
                      {details.description ? ` — ${details.description}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isPastDue
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : isTrial && subscription.isTrialActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {isPastDue ? 'Payment overdue' : subscription.isTrialActive ? `Trial — ${subscription.trialDaysRemaining} days left` : status === 'active' ? 'Active' : status}
                      </span>
                      {details.isEnterprise && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-blue-200 border border-white/20">
                          Contact Sales
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  {!details.isEnterprise && (
                    <>
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                        <FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-blue-200 uppercase tracking-wider">Invoices this month</p>
                          <p className="text-white font-medium mt-0.5">
                            {isUnlimited ? `${invoiceUsage} used (unlimited)` : `${invoiceUsage} / ${invoiceLimit}`}
                          </p>
                          {!isUnlimited && limits?.invoicesPerMonth !== undefined && (
                            <p className="text-blue-300 text-xs mt-1">{Math.max(0, invoiceLimit - invoiceUsage)} remaining</p>
                          )}
                        </div>
                      </div>
                      {subscription.currentPeriodEnd && !isTrial && (
                        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                          <Calendar className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-blue-200 uppercase tracking-wider">Next billing</p>
                            <p className="text-white font-medium mt-0.5">
                              {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </p>
                            <p className="text-blue-300 text-xs mt-1">Renews automatically</p>
                          </div>
                        </div>
                      )}
                      {isTrial && subscription.isTrialActive && (
                        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                          <Zap className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-blue-200 uppercase tracking-wider">Trial</p>
                            <p className="text-white font-medium mt-0.5">{subscription.trialDaysRemaining} days remaining</p>
                            <p className="text-blue-300 text-xs mt-1">Upgrade to keep access after trial</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
            })()}
          </>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
            <Crown className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-white font-medium">No active plan</p>
              <p className="text-blue-200 text-sm">Choose a plan to get started.</p>
            </div>
            <button
              onClick={handleUpgrade}
              className="ml-auto flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              View plans
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Profile Photo Section */}
      {!isGoogleUser && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <User className="h-6 w-6 text-blue-400" aria-label="Profile photo icon" />
            <h2 className="text-xl font-semibold text-white">Profile Photo</h2>
          </div>
          <p className="text-blue-200 text-sm mb-6">
            Upload a profile photo to personalize your account. This will be displayed in your profile and communications.
          </p>

          <div className="flex items-center space-x-6">
            {/* Current Profile Photo */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/20">
                {profilePhoto ? (
                  <NextImage
                    src={profilePhoto}
                    alt="Profile Photo"
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <User className="h-10 w-10 text-blue-300" />
                )}
              </div>
            </div>

            {/* Upload Section */}
            <div className="flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Upload Profile Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                    className="hidden"
                    id="profile-photo-upload"
                  />
                  <label
                    htmlFor="profile-photo-upload"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Photo
                  </label>
                </div>
                
                {profilePhoto && (
                  <button
                    onClick={handleRemoveProfilePhoto}
                    className="text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google User Notice */}
      {isGoogleUser && (
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Profile Photo</h2>
          </div>
          <p className="text-blue-200 text-sm">
            Your profile photo is managed through your Google account. To change it, please update your photo in your Google profile settings.
          </p>
        </div>
      )}
    </div>
  );
} 