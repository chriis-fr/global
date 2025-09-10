'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Plus, 
  X, 
  Save, 
  Send, 
  FileText,
  Trash2,
  CreditCard,
  Wallet,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { getFiatCurrencies, getCurrencyByCode } from '@/data/currencies';

interface Vendor {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  taxId?: string;
  notes?: string;
}

interface PayableFormData {
  _id?: string;
  payableNumber?: string;
  payableName: string;
  issueDate: string;
  dueDate: string;
  companyLogo?: string;
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
  vendorName: string;
  vendorCompany?: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  fiatPaymentSubtype?: 'bank' | 'mpesa_paybill' | 'mpesa_till';
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  swiftCode?: string;
  bankCode?: string;
  branchCode?: string;
  accountName?: string;
  accountNumber?: string;
  branchAddress?: string;
  // M-Pesa Paybill fields
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  // M-Pesa Till fields
  tillNumber?: string;
  businessName?: string;
  enableMultiCurrency: boolean;
  payableType: 'regular' | 'recurring';
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  total: number;
  memo: string;
  attachedFiles: File[];
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  category: string;
  priority: 'low' | 'medium' | 'high';
  approvalRequired: boolean;
  approverEmail?: string;
}

const PAYABLE_CATEGORIES = [
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
  'Insurance',
  'Other'
];

const PAYABLE_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-red-600' }
];

const useFormPersistence = (key: string, initialData: PayableFormData, setAutoSaveStatus: (status: 'saved' | 'saving' | 'error' | null) => void) => {
  const [formData, setFormData] = useState<PayableFormData>(initialData);

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
  }, [key]);

  const updateFormData = (newData: PayableFormData | ((prev: PayableFormData) => PayableFormData)) => {
    setFormData(prev => {
      const updated = typeof newData === 'function' ? newData(prev) : newData;
      
      // Auto-save to localStorage
      try {
        setAutoSaveStatus('saving');
        localStorage.setItem(key, JSON.stringify(updated));
        setTimeout(() => setAutoSaveStatus('saved'), 500);
      } catch (error) {
        console.error('Error saving form data:', error);
        setAutoSaveStatus('error');
      }
      
      return updated;
    });
  };

  const clearSavedData = () => {
    localStorage.removeItem(key);
    setFormData(initialData);
  };

  return { formData, setFormData: updateFormData, clearSavedData };
};

export default function CreatePayablePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showVendorCreation, setShowVendorCreation] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currencies = getFiatCurrencies();

  const initialFormData: PayableFormData = {
    payableName: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    companyTaxNumber: '',
    vendorName: '',
    vendorEmail: '',
    vendorPhone: '',
    vendorAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    currency: 'USD',
    paymentMethod: 'fiat',
    fiatPaymentSubtype: 'bank',
    enableMultiCurrency: false,
    payableType: 'regular',
    items: [{
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      amount: 0
    }],
    subtotal: 0,
    totalTax: 0,
    total: 0,
    memo: '',
    attachedFiles: [],
    status: 'draft',
    category: 'Other',
    priority: 'medium',
    approvalRequired: false
  };

  const { formData, setFormData, clearSavedData } = useFormPersistence(
    'payable-form-data',
    initialFormData,
    setAutoSaveStatus
  );


  // Load vendors
  const loadVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      const data = await response.json();
      if (data.success) {
        setVendors(data.data);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleInputChange = (field: keyof PayableFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setFormData(prev => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, ...files]
    }));
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((_, i) => i !== index)
    }));
  };

  const selectVendor = (vendor: Vendor) => {
    setFormData(prev => ({
      ...prev,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      vendorPhone: vendor.phone || '',
      vendorCompany: vendor.company || '',
      vendorAddress: {
        street: vendor.address?.split(',')[0] || '',
        city: vendor.address?.split(',')[1] || '',
        state: vendor.address?.split(',')[2] || '',
        zipCode: vendor.address?.split(',')[3] || '',
        country: 'US'
      }
    }));
    setShowVendorDropdown(false);
  };

  const createNewVendor = () => {
    setShowVendorCreation(true);
    setShowVendorDropdown(false);
  };

  const handleCreateVendor = async (vendorData: Omit<Vendor, '_id'>) => {
    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData)
      });
      
      const data = await response.json();
      if (data.success) {
        setVendors(prev => [...prev, data.data]);
        selectVendor(data.data);
        setShowVendorCreation(false);
      }
    } catch (error) {
      console.error('Error creating vendor:', error);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate amount
      const item = newItems[index];
      const subtotal = item.quantity * item.unitPrice;
      const discountAmount = (subtotal * item.discount) / 100;
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = (taxableAmount * item.tax) / 100;
      item.amount = taxableAmount + taxAmount;
      
      // Recalculate totals
      const totalSubtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalDiscount = newItems.reduce((sum, item) => sum + ((item.quantity * item.unitPrice * item.discount) / 100), 0);
      const totalTaxable = totalSubtotal - totalDiscount;
      const totalTax = newItems.reduce((sum, item) => sum + (((item.quantity * item.unitPrice * (1 - item.discount / 100)) * item.tax) / 100), 0);
      const total = totalTaxable + totalTax;
      
      return {
        ...prev,
        items: newItems,
        subtotal: totalSubtotal,
        totalTax,
        total
      };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        tax: 0,
        amount: 0
      }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      
      // Recalculate totals
      const totalSubtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalDiscount = newItems.reduce((sum, item) => sum + ((item.quantity * item.unitPrice * item.discount) / 100), 0);
      const totalTaxable = totalSubtotal - totalDiscount;
      const totalTax = newItems.reduce((sum, item) => sum + (((item.quantity * item.unitPrice * (1 - item.discount / 100)) * item.tax) / 100), 0);
      const total = totalTaxable + totalTax;
      
      return {
        ...prev,
        items: newItems,
        subtotal: totalSubtotal,
        totalTax,
        total
      };
    });
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/payables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'draft'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        clearSavedData();
        router.push('/dashboard/services/payables');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPayable = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/payables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'pending'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        clearSavedData();
        router.push('/dashboard/services/payables');
      }
    } catch (error) {
      console.error('Error submitting payable:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const getCurrencySymbol = () => {
    return getCurrencyByCode(formData.currency as string)?.symbol || '$';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create Payable</h1>
                <p className="text-sm text-gray-500">Manage vendor payments and expenses</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {autoSaveStatus && (
                <div className="flex items-center space-x-2 text-sm">
                  {autoSaveStatus === 'saving' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-gray-500">Saving...</span>
                    </>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Saved</span>
                    </>
                  )}
                  {autoSaveStatus === 'error' && (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600">Save failed</span>
                    </>
                  )}
                </div>
              )}
              
              <button
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save Draft</span>
              </button>
              
              <button
                onClick={handleSubmitPayable}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Submit Payable</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payable Name</label>
                  <input
                    type="text"
                    value={formData.payableName}
                    onChange={(e) => handleInputChange('payableName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter payable name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PAYABLE_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date</label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => handleInputChange('issueDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PAYABLE_PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>{priority.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.approvalRequired}
                      onChange={(e) => handleInputChange('approvalRequired', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Requires Approval</span>
                  </label>
                </div>
              </div>
              
              {formData.approvalRequired && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Approver Email</label>
                  <input
                    type="email"
                    value={formData.approverEmail || ''}
                    onChange={(e) => handleInputChange('approverEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter approver email"
                  />
                </div>
              )}
            </div>

            {/* Vendor Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Vendor Information</h2>
                <span className="text-gray-500 text-sm">
                  Edit functionality coming soon
                </span>
              </div>
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Vendor</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.vendorName}
                    onChange={(e) => {
                      handleInputChange('vendorName', e.target.value);
                      setShowVendorDropdown(true);
                    }}
                    onFocus={() => setShowVendorDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search or select vendor"
                  />
                  <button
                    onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                
                {showVendorDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={createNewVendor}
                        className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Create New Vendor
                      </button>
                    </div>
                    {vendors.map(vendor => (
                      <button
                        key={vendor._id}
                        onClick={() => selectVendor(vendor)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{vendor.name}</div>
                        <div className="text-sm text-gray-500">{vendor.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Email</label>
                  <input
                    type="email"
                    value={formData.vendorEmail}
                    onChange={(e) => handleInputChange('vendorEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="vendor@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Phone</label>
                  <input
                    type="tel"
                    value={formData.vendorPhone}
                    onChange={(e) => handleInputChange('vendorPhone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">Item {index + 1}</h3>
                      {formData.items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Item description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                        <input
                          type="number"
                          value={item.tax}
                          onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-3 text-right">
                      <span className="text-sm text-gray-500">Amount: </span>
                      <span className="font-semibold text-gray-900">
                        {getCurrencySymbol()}{item.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {currencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
                  <div className="space-y-3">
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        value="fiat"
                        checked={formData.paymentMethod === 'fiat'}
                        onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex items-center">
                        <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <div className="font-medium text-gray-700">Local currency ({formData.currency})</div>
                          <div className="text-sm text-gray-500">Bank Transfer</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        value="crypto"
                        checked={formData.paymentMethod === 'crypto'}
                        onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex items-center">
                        <Wallet className="h-5 w-5 text-blue-600 mr-2" />
                        <div>
                          <div className="font-medium text-gray-700">Crypto</div>
                          <div className="text-sm text-gray-500">Cryptocurrency payment</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Memo */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Memo</h2>
              <textarea
                value={formData.memo}
                onChange={(e) => handleInputChange('memo', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add any additional notes or comments..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{getCurrencySymbol()}{formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{getCurrencySymbol()}{formData.totalTax.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {getCurrencySymbol()}{formData.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h2>
              
              <div className="space-y-3">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {formData.attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Creation Modal */}
      {showVendorCreation && (
        <VendorCreationForm
          onSubmit={handleCreateVendor}
          onCancel={() => setShowVendorCreation(false)}
        />
      )}
    </div>
  );
}

function VendorCreationForm({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (vendorData: Omit<Vendor, '_id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    taxId: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Vendor</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
            <input
              type="text"
              value={formData.taxId}
              onChange={(e) => handleInputChange('taxId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
