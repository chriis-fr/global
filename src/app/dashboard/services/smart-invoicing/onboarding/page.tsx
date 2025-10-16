'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight, 
  Building2, 
  FileText, 
  Check,
  Loader2,
  ChevronDown,
  Search
} from 'lucide-react';
import { countries } from '@/data/countries';
import { fiatCurrencies } from '@/data/currencies';

interface BusinessInfo {
  name: string;
  email: string;
  phone: string;
  website?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  taxId: string;
  logo?: string;
}

interface InvoiceSettings {
  defaultCurrency: string;
  paymentTerms: number; // days
  taxRates: Array<{
    name: string;
    rate: number;
    description?: string;
  }>;
  invoiceTemplate: 'standard' | 'custom';
}

interface ServiceOnboardingData {
  businessInfo: BusinessInfo;
  invoiceSettings: InvoiceSettings;
}

export default function SmartInvoicingOnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [formData, setFormData] = useState<ServiceOnboardingData>({
    businessInfo: {
      name: '',
      email: session?.user?.email || '',
      phone: '',
      website: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      taxId: '',
      logo: ''
    },
    invoiceSettings: {
      defaultCurrency: 'USD',
      paymentTerms: 30,
      taxRates: [
        {
          name: 'Standard Tax',
          rate: 0,
          description: 'Default tax rate'
        }
      ],
      invoiceTemplate: 'standard'
    }
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      if (session?.user) {
        try {
          // Fetch complete user profile from API
          const response = await fetch('/api/users/profile');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const userProfile = data.data;
              
              // Pre-fill with complete user data
              setFormData(prev => ({
                ...prev,
                businessInfo: {
                  ...prev.businessInfo,
                  name: userProfile.name || session.user.name || '',
                  email: userProfile.email || session.user.email || '',
                  phone: userProfile.phone || '',
                  website: '',
                  address: {
                    street: userProfile.address?.street || '',
                    city: userProfile.address?.city || '',
                    state: userProfile.address?.state || '',
                    zipCode: userProfile.address?.postalCode || '',
                    country: userProfile.address?.country || 'US'
                  },
                  taxId: ''
                }
              }));
            }
          }
        } catch (error) {
          // Fallback to session data only
          setFormData(prev => ({
            ...prev,
            businessInfo: {
              ...prev.businessInfo,
              name: session.user.name || '',
              email: session.user.email || '',
              phone: '',
              address: {
                ...prev.businessInfo.address,
                ...session.user.address
              },
              taxId: ''
            }
          }));
        }
      }
    };

    loadUserProfile();
  }, [session]);

  // Load existing onboarding data if available
  useEffect(() => {
    const loadExistingOnboarding = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/onboarding/service?service=smartInvoicing');
          const data = await response.json();
          
          if (data.success && data.data.serviceOnboarding) {
            const existingData = data.data.serviceOnboarding;
            setFormData(prev => ({
              ...prev,
              businessInfo: {
                ...prev.businessInfo,
                name: existingData.businessInfo?.name || prev.businessInfo.name,
                email: existingData.businessInfo?.email || prev.businessInfo.email,
                phone: existingData.businessInfo?.phone || prev.businessInfo.phone,
                website: existingData.businessInfo?.website || prev.businessInfo.website,
                address: {
                  street: existingData.businessInfo?.address?.street || prev.businessInfo.address.street,
                  city: existingData.businessInfo?.address?.city || prev.businessInfo.address.city,
                  state: existingData.businessInfo?.address?.state || prev.businessInfo.address.state,
                  zipCode: existingData.businessInfo?.address?.zipCode || prev.businessInfo.address.zipCode,
                  country: existingData.businessInfo?.address?.country || prev.businessInfo.address.country
                },
                taxId: existingData.businessInfo?.taxId || prev.businessInfo.taxId,
                logo: existingData.businessInfo?.logo || prev.businessInfo.logo
              },
              invoiceSettings: {
                defaultCurrency: existingData.invoiceSettings?.defaultCurrency || prev.invoiceSettings.defaultCurrency,
                paymentTerms: existingData.invoiceSettings?.paymentTerms || prev.invoiceSettings.paymentTerms,
                taxRates: existingData.invoiceSettings?.taxRates || prev.invoiceSettings.taxRates,
                invoiceTemplate: existingData.invoiceSettings?.invoiceTemplate || prev.invoiceSettings.invoiceTemplate
              }
            }));
          }
        } catch (error) {
        }
      }
    };

    loadExistingOnboarding();
  }, [session]);

  const handleInputChange = (section: 'businessInfo' | 'invoiceSettings', field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      businessInfo: {
        ...prev.businessInfo,
        address: {
          ...prev.businessInfo.address,
          [field]: value
        }
      }
    }));
  };

  const handleTaxRateChange = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      invoiceSettings: {
        ...prev.invoiceSettings,
        taxRates: prev.invoiceSettings.taxRates.map((rate, i) => 
          i === index ? { ...rate, [field]: value } : rate
        )
      }
    }));
  };

  const addTaxRate = () => {
    setFormData(prev => ({
      ...prev,
      invoiceSettings: {
        ...prev.invoiceSettings,
        taxRates: [
          ...prev.invoiceSettings.taxRates,
          {
            name: '',
            rate: 0,
            description: ''
          }
        ]
      }
    }));
  };

  const removeTaxRate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      invoiceSettings: {
        ...prev.invoiceSettings,
        taxRates: prev.invoiceSettings.taxRates.filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceKey: 'smartInvoicing',
          serviceData: formData
        }),
      });

      const data = await response.json();
      if (data.success) {
        router.push('/dashboard/services/smart-invoicing?refresh=true');
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Element;
    if (!target.closest('.country-dropdown-container')) {
      setShowCountryDropdown(false);
      setCountrySearch('');
    }
    if (!target.closest('.currency-dropdown-container')) {
      setShowCurrencyDropdown(false);
      setCurrencySearch('');
    }
  };

  // Add click outside listener
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Smart Invoicing Setup</h1>
              <p className="text-blue-200">Configure your invoicing service</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${currentStep >= 1 ? 'bg-blue-500' : 'bg-gray-600'}`} />
            <div className={`w-3 h-3 rounded-full ${currentStep >= 2 ? 'bg-blue-500' : 'bg-gray-600'}`} />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-8">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 2) * 100}%` }}
          />
        </div>

        {/* Step 1: Business Information */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-6">
                <Building2 className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold">Business Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name *</label>
                  <input
                    type="text"
                    value={formData.businessInfo.name}
                    onChange={(e) => handleInputChange('businessInfo', 'name', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="Your business name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.businessInfo.email}
                    readOnly
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 cursor-not-allowed opacity-75"
                    placeholder="business@example.com"
                  />
                  <p className="text-xs text-blue-300 mt-1">Email cannot be changed as it&apos;s tied to your account</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.businessInfo.phone}
                    onChange={(e) => handleInputChange('businessInfo', 'phone', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.businessInfo.website}
                    onChange={(e) => handleInputChange('businessInfo', 'website', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tax ID</label>
                  <input
                    type="text"
                    value={formData.businessInfo.taxId}
                    onChange={(e) => handleInputChange('businessInfo', 'taxId', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="Tax identification number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Country</label>
                  <div className="relative country-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 text-left flex items-center justify-between"
                    >
                      <span className={formData.businessInfo.address.country ? 'text-white' : 'text-gray-400'}>
                        {formData.businessInfo.address.country 
                          ? countries.find(c => c.code === formData.businessInfo.address.country)?.name 
                          : 'Select country'}
                      </span>
                      <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-20 shadow-xl">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-600 bg-gray-800">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Search countries..."
                              className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-500 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        
                        {/* Country list */}
                        <div className="max-h-48 overflow-y-auto">
                          {countries
                            .filter(country => 
                              country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                              country.phoneCode.includes(countrySearch) ||
                              country.code.toLowerCase().includes(countrySearch.toLowerCase())
                            )
                            .map(country => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                handleAddressChange('country', country.code);
                                setShowCountryDropdown(false);
                                setCountrySearch('');
                              }}
                              className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center justify-between border-b border-gray-700 last:border-b-0"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="text-sm">{country.name}</span>
                              </div>
                              <span className="text-blue-300 text-xs font-medium">{country.phoneCode}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">Address</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.businessInfo.address.street}
                    onChange={(e) => handleAddressChange('street', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="Street address"
                  />
                  <input
                    type="text"
                    value={formData.businessInfo.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.businessInfo.address.state}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="State/Province"
                  />
                  <input
                    type="text"
                    value={formData.businessInfo.address.zipCode}
                    onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="ZIP/Postal Code"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Invoice Settings */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-6">
                <FileText className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold">Invoice Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Default Currency</label>
                  <div className="relative currency-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 text-left flex items-center justify-between"
                    >
                      <span className={formData.invoiceSettings.defaultCurrency ? 'text-white' : 'text-gray-400'}>
                        {formData.invoiceSettings.defaultCurrency 
                          ? `${formData.invoiceSettings.defaultCurrency} - ${fiatCurrencies.find(c => c.code === formData.invoiceSettings.defaultCurrency)?.name}`
                          : 'Select currency'}
                      </span>
                      <ChevronDown className={`h-5 w-5 text-blue-300 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showCurrencyDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg max-h-60 overflow-y-auto z-20 shadow-xl">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-600 bg-gray-800">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={currencySearch}
                              onChange={(e) => setCurrencySearch(e.target.value)}
                              placeholder="Search currencies..."
                              className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-500 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        
                        {/* Currency list */}
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
                              onClick={() => {
                                handleInputChange('invoiceSettings', 'defaultCurrency', currency.code);
                                setShowCurrencyDropdown(false);
                                setCurrencySearch('');
                              }}
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

                <div>
                  <label className="block text-sm font-medium mb-2">Payment Terms (days)</label>
                  <input
                    type="number"
                    value={formData.invoiceSettings.paymentTerms}
                    onChange={(e) => handleInputChange('invoiceSettings', 'paymentTerms', parseInt(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Invoice Template</label>
                  <select
                    value={formData.invoiceSettings.invoiceTemplate}
                    onChange={(e) => handleInputChange('invoiceSettings', 'invoiceTemplate', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="standard">Standard Template</option>
                    <option value="custom">Custom Template</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium">Tax Rates</label>
                  <button
                    onClick={addTaxRate}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    Add Tax Rate
                  </button>
                </div>
                
                <div className="space-y-4">
                  {formData.invoiceSettings.taxRates.map((taxRate, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-white/5 rounded-lg">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          type="text"
                          value={taxRate.name}
                          onChange={(e) => handleTaxRateChange(index, 'name', e.target.value)}
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                          placeholder="Tax name"
                        />
                        <input
                          type="number"
                          value={taxRate.rate}
                          onChange={(e) => handleTaxRateChange(index, 'rate', parseFloat(e.target.value))}
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                          placeholder="Rate %"
                          step="0.01"
                          min="0"
                          max="100"
                        />
                        <input
                          type="text"
                          value={taxRate.description || ''}
                          onChange={(e) => handleTaxRateChange(index, 'description', e.target.value)}
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                          placeholder="Description"
                        />
                      </div>
                      {formData.invoiceSettings.taxRates.length > 1 && (
                        <button
                          onClick={() => removeTaxRate(index)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          {currentStep === 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>{loading ? 'Saving...' : 'Complete Setup'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 