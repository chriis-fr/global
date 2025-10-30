'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  CreditCard,
  Users,
  FileText,
  Loader2,
  X
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<Record<string, unknown>>;
  completed: boolean;
}

interface BusinessInfoData {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  companyTaxNumber: string;
}

interface PaymentSettingsData {
  defaultCurrency: string;
  paymentMethods: string[];
  approvalWorkflow: boolean;
  approverEmail?: string;
}

interface VendorSettingsData {
  autoCreateVendors: boolean;
  requireVendorApproval: boolean;
  defaultPaymentTerms: number;
}

interface OnboardingData {
  businessInfo: {
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    companyTaxNumber: string;
  };
  paymentSettings: {
    defaultCurrency: string;
    paymentMethods: string[];
    approvalWorkflow: boolean;
    approverEmail?: string;
  };
  vendorSettings: {
    autoCreateVendors: boolean;
    requireVendorApproval: boolean;
    defaultPaymentTerms: number;
  };
  categories: string[];
}

export default function PayablesOnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    businessInfo: {
      companyName: session?.user?.name || '',
      companyEmail: session?.user?.email || '',
      companyPhone: '',
      companyAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      companyTaxNumber: ''
    },
    paymentSettings: {
      defaultCurrency: 'USD',
      paymentMethods: ['bank'],
      approvalWorkflow: false,
      approverEmail: ''
    },
    vendorSettings: {
      autoCreateVendors: true,
      requireVendorApproval: false,
      defaultPaymentTerms: 30
    },
    categories: ['Office Supplies', 'Software & Services', 'Marketing & Advertising']
  });

  // Load user profile data to pre-fill form
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
              setOnboardingData(prev => ({
                ...prev,
                businessInfo: {
                  ...prev.businessInfo,
                  companyName: userProfile.name || session.user.name || '',
                  companyEmail: userProfile.email || session.user.email || '',
                  companyPhone: userProfile.phone || '',
                  companyAddress: {
                    street: userProfile.address?.street || '',
                    city: userProfile.address?.city || '',
                    state: userProfile.address?.state || '',
                    zipCode: userProfile.address?.postalCode || '',
                    country: userProfile.address?.country || 'US'
                  },
                  companyTaxNumber: ''
                }
              }));
            }
          }
        } catch {
          // Fallback to session data only
          setOnboardingData(prev => ({
            ...prev,
            businessInfo: {
              ...prev.businessInfo,
              companyName: session.user.name || '',
              companyEmail: session.user.email || '',
              companyPhone: '',
              companyAddress: {
                ...prev.businessInfo.companyAddress,
                ...session.user.address
              },
              companyTaxNumber: ''
            }
          }));
        }
      }
    };

    loadUserProfile();
  }, [session]);

  const steps: OnboardingStep[] = [
    {
      id: 'business-info',
      title: 'Business Information',
      description: 'Set up your company details for payables',
      icon: Building2,
      completed: false
    },
    {
      id: 'payment-settings',
      title: 'Payment Settings',
      description: 'Configure payment methods and preferences',
      icon: CreditCard,
      completed: false
    },
    {
      id: 'vendor-settings',
      title: 'Vendor Management',
      description: 'Set up vendor management preferences',
      icon: Users,
      completed: false
    },
    {
      id: 'categories',
      title: 'Expense Categories',
      description: 'Configure expense categories for better organization',
      icon: FileText,
      completed: false
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceKey: 'accountsPayable',
          serviceData: onboardingData
        })
      });
      
      if (response.ok) {
        router.push('/dashboard/services/payables?refresh=true');
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const updateOnboardingData = (section: keyof OnboardingData, data: Partial<BusinessInfoData | PaymentSettingsData | VendorSettingsData>) => {
    setOnboardingData(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data }
    }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <BusinessInfoStep data={onboardingData.businessInfo} onUpdate={(data) => updateOnboardingData('businessInfo', data)} />;
      case 1:
        return <PaymentSettingsStep data={onboardingData.paymentSettings} onUpdate={(data) => updateOnboardingData('paymentSettings', data)} />;
      case 2:
        return <VendorSettingsStep data={onboardingData.vendorSettings} onUpdate={(data) => updateOnboardingData('vendorSettings', data)} />;
      case 3:
        return <CategoriesStep data={onboardingData.categories} onUpdate={(data) => setOnboardingData(prev => ({ ...prev, categories: data }))} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Setup Accounts Payable</h1>
          <p className="text-gray-600">Configure your payable management system in a few simple steps</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index <= currentStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-400'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${
                    index <= currentStep ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`hidden sm:block w-16 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-3">
            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>Complete Setup</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessInfoStep({ data, onUpdate }: { data: BusinessInfoData; onUpdate: (data: Partial<BusinessInfoData>) => void }) {
  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentData = data[parent as keyof BusinessInfoData] as Record<string, unknown>;
      onUpdate({ [parent]: { ...parentData, [child]: value } } as Partial<BusinessInfoData>);
    } else {
      onUpdate({ [field]: value } as Partial<BusinessInfoData>);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Business Information</h2>
        <p className="text-gray-600">Tell us about your company for payable management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Email *</label>
          <input
            type="email"
            value={data.companyEmail}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100 cursor-not-allowed opacity-75"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed as it&apos;s tied to your account</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Phone</label>
          <input
            type="tel"
            value={data.companyPhone}
            onChange={(e) => handleInputChange('companyPhone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tax Number</label>
          <input
            type="text"
            value={data.companyTaxNumber}
            onChange={(e) => handleInputChange('companyTaxNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
          <input
            type="text"
            value={data.companyAddress.street}
            onChange={(e) => handleInputChange('companyAddress.street', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <input
            type="text"
            value={data.companyAddress.city}
            onChange={(e) => handleInputChange('companyAddress.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State/Province</label>
          <input
            type="text"
            value={data.companyAddress.state}
            onChange={(e) => handleInputChange('companyAddress.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP/Postal Code</label>
          <input
            type="text"
            value={data.companyAddress.zipCode}
            onChange={(e) => handleInputChange('companyAddress.zipCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          <select
            value={data.companyAddress.country}
            onChange={(e) => handleInputChange('companyAddress.country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="US">United States</option>
            <option value="KE">Kenya</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function PaymentSettingsStep({ data, onUpdate }: { data: PaymentSettingsData; onUpdate: (data: Partial<PaymentSettingsData>) => void }) {
  const handleInputChange = (field: string, value: string | boolean) => {
    onUpdate({ [field]: value } as Partial<PaymentSettingsData>);
  };

  const handlePaymentMethodToggle = (method: string) => {
    const methods = data.paymentMethods.includes(method)
      ? data.paymentMethods.filter((m: string) => m !== method)
      : [...data.paymentMethods, method];
    onUpdate({ paymentMethods: methods });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CreditCard className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Payment Settings</h2>
        <p className="text-gray-600">Configure your payment preferences and methods</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Currency</label>
          <select
            value={data.defaultCurrency}
            onChange={(e) => handleInputChange('defaultCurrency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="KES">KES - Kenyan Shilling</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Payment Methods</label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data.paymentMethods.includes('bank')}
                onChange={() => handlePaymentMethodToggle('bank')}
                className="mr-3"
              />
              <span className="text-gray-700">Bank Transfer</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data.paymentMethods.includes('crypto')}
                onChange={() => handlePaymentMethodToggle('crypto')}
                className="mr-3"
              />
              <span className="text-gray-700">Cryptocurrency</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data.paymentMethods.includes('check')}
                onChange={() => handlePaymentMethodToggle('check')}
                className="mr-3"
              />
              <span className="text-gray-700">Check</span>
            </label>
          </div>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.approvalWorkflow}
              onChange={(e) => handleInputChange('approvalWorkflow', e.target.checked)}
              className="mr-3"
            />
            <span className="text-gray-700">Enable approval workflow for payables</span>
          </label>
        </div>

        {data.approvalWorkflow && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Approver Email</label>
            <input
              type="email"
              value={data.approverEmail || ''}
              onChange={(e) => handleInputChange('approverEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="approver@company.com"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function VendorSettingsStep({ data, onUpdate }: { data: VendorSettingsData; onUpdate: (data: Partial<VendorSettingsData>) => void }) {
  const handleInputChange = (field: string, value: string | boolean) => {
    onUpdate({ [field]: value } as Partial<VendorSettingsData>);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Vendor Management</h2>
        <p className="text-gray-600">Configure how you manage vendors and suppliers</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.autoCreateVendors}
              onChange={(e) => handleInputChange('autoCreateVendors', e.target.checked)}
              className="mr-3"
            />
            <span className="text-gray-700">Automatically create new vendors when adding payables</span>
          </label>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.requireVendorApproval}
              onChange={(e) => handleInputChange('requireVendorApproval', e.target.checked)}
              className="mr-3"
            />
            <span className="text-gray-700">Require approval for new vendors</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Payment Terms (days)</label>
          <select
            value={data.defaultPaymentTerms}
            onChange={(e) => handleInputChange('defaultPaymentTerms', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={15}>15 days</option>
            <option value={30}>30 days</option>
            <option value={45}>45 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function CategoriesStep({ data, onUpdate }: { data: string[]; onUpdate: (data: string[]) => void }) {
  const [newCategory, setNewCategory] = useState('');
  const [categories, setCategories] = useState(data);

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updated = [...categories, newCategory.trim()];
      setCategories(updated);
      onUpdate(updated);
      setNewCategory('');
    }
  };

  const removeCategory = (category: string) => {
    const updated = categories.filter(c => c !== category);
    setCategories(updated);
    onUpdate(updated);
  };

  const defaultCategories = [
    'Office Supplies',
    'Software & Services',
    'Marketing & Advertising',
    'Travel & Entertainment',
    'Professional Services',
    'Utilities',
    'Rent & Facilities',
    'Equipment & Hardware',
    'Training & Development',
    'Legal & Compliance',
    'Insurance'
  ];

  const addDefaultCategory = (category: string) => {
    if (!categories.includes(category)) {
      const updated = [...categories, category];
      setCategories(updated);
      onUpdate(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Expense Categories</h2>
        <p className="text-gray-600">Set up categories to organize your payables</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Category</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter category name"
            />
            <button
              onClick={addCategory}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Categories</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {defaultCategories.map(category => (
              <button
                key={category}
                onClick={() => addDefaultCategory(category)}
                disabled={categories.includes(category)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  categories.includes(category)
                    ? 'bg-blue-100 border-blue-300 text-blue-700 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Selected Categories</label>
          <div className="space-y-2">
            {categories.map(category => (
              <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">{category}</span>
                <button
                  onClick={() => removeCategory(category)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
