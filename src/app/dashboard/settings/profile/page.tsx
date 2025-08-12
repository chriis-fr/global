'use client';
import { useState, useEffect } from 'react';
import { LogoManager } from '@/components/LogoManager';
import { Image, ChevronDown } from 'lucide-react';
import NextImage from 'next/image';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { fiatCurrencies } from '@/data/currencies';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

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
}

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

export default function ProfileSettingsPage() {
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
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
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
        <DashboardFloatingButton />
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
                {formData.userType === 'business' ? 'Organization Name' : 'Full Name'}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder={formData.userType === 'business' ? 'Enter organization name' : 'Enter your full name'}
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

      {/* Logo Management Section */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Image className="h-6 w-6 text-blue-400" aria-label="Logo management icon" />
          <h2 className="text-xl font-semibold text-white">Logo Management</h2>
        </div>
        <p className="text-blue-200 text-sm mb-6">
          Upload and manage your logos for use in invoices and other business documents. 
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
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                <NextImage
                  src={selectedLogo.url}
                  alt={selectedLogo.name}
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
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

      <DashboardFloatingButton />
    </div>
  );
} 