'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/lib/auth-client';
import { 
  Plus, 
  CreditCard, 
  Wallet, 
  Edit3, 
  Trash2, 
  Star,
  Eye,
  EyeOff,
  LayoutDashboard,
  Smartphone,
  Shield,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import BankSelector from '@/components/BankSelector';
import { Bank } from '@/data';
import DynamicBankFields from '@/components/payments/DynamicBankFields';
import ConnectSafeModal from '@/components/safe/ConnectSafeModal';
import { getConnectedSafeWallets } from '@/app/actions/safe-connection';

interface PaymentMethod {
  _id?: string;
  name: string;
  type: 'fiat' | 'crypto';
  isDefault: boolean;
  isActive: boolean;
  fiatDetails?: {
    subtype: 'bank' | 'mpesa_paybill' | 'mpesa_till';
    // Bank details
    bankName?: string;
    swiftCode?: string;
    bankCode?: string;
    branchCode?: string;
    accountName?: string;
    accountNumber?: string;
    branchAddress?: string;
    accountType?: string;
    // Custom bank fields
    bankAddress?: string;
    accountHolder?: string;
    routingNumber?: string;
    beneficiaryName?: string;
    // M-Pesa details
    paybillNumber?: string;
    mpesaAccountNumber?: string;
    tillNumber?: string;
    businessName?: string;
    currency: string;
    country: string;
  };
  cryptoDetails?: {
    address: string;
    network: string;
    currency: string;
    safeDetails?: {
      safeAddress: string;
      owners: string[];
      threshold: number;
      chainId?: number;
    };
  };
}

export default function PaymentMethodsPage() {
  const { data: session } = useSession();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [, setSafeWallets] = useState<Array<{
    paymentMethodId: string;
    name: string;
    safeAddress: string;
    owners: string[];
    threshold: number;
    chainId?: number;
    isDefault: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [showSensitiveData, setShowSensitiveData] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [showCustomBankFields, setShowCustomBankFields] = useState(false);
  const [isCustomBank, setIsCustomBank] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    name: '',
    type: 'fiat' as 'fiat' | 'crypto',
    subtype: 'bank' as 'bank' | 'mpesa_paybill' | 'mpesa_till',
    // Bank fields
    bankName: '',
    swiftCode: '',
    bankCode: '',
    branchCode: '',
    accountName: '',
    accountNumber: '',
    branchAddress: '',
    accountType: 'checking' as 'checking' | 'savings' | 'business',
    // Custom bank fields
    bankCountryCode: 'KE' as 'GH' | 'KE',
    customFields: {} as Record<string, string>,
    // M-Pesa fields
    paybillNumber: '',
    mpesaAccountNumber: '',
    tillNumber: '',
    businessName: '',
    // Common fields
    currency: 'USD',
    country: 'US',
    // Crypto fields
    network: '',
    address: '',
    isDefault: false
  });

  useEffect(() => {
    loadPaymentMethods();
    loadSafeWallets();
  }, []);

  // Check if bank name is custom (not in the list)
  useEffect(() => {
    // Only check if we have a bank name and it's not empty
    if (!newPaymentMethod.bankName || !newPaymentMethod.bankName.trim() || !newPaymentMethod.bankCountryCode) {
      setIsCustomBank(false);
      setShowCustomBankFields(false);
      return;
    }

    // Immediately show as potentially custom when user types (optimistic UI)
    // This will be verified by the API check below
    const bankNameTrimmed = newPaymentMethod.bankName.trim();
    if (bankNameTrimmed.length > 0) {
      setIsCustomBank(true);
    }

    // Add a small delay to avoid checking on every keystroke
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/banks/search?country=${newPaymentMethod.bankCountryCode}`);
        const data = await response.json();
        
        if (data.success) {
          const banks = data.data.banks as Bank[];
          const bankNameLower = bankNameTrimmed.toLowerCase();
          const isInList = banks.some(bank => 
            bank.name.toLowerCase().trim() === bankNameLower
          );
          setIsCustomBank(!isInList);
          if (!isInList) {
            // If it's a custom bank, keep fields hidden until user toggles
          } else {
            setShowCustomBankFields(false);
          }
        }
      } catch {
        // If we can't check, assume it might be custom if there's a value
        setIsCustomBank(!!bankNameTrimmed);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [newPaymentMethod.bankName, newPaymentMethod.bankCountryCode]);

  const loadSafeWallets = async () => {
    try {
      const result = await getConnectedSafeWallets({});
      if (result.success) {
        // Filter out wallets with undefined safeAddress and map to expected type
        const validWallets = result.safeWallets
          .filter(wallet => wallet.safeAddress !== undefined)
          .map(wallet => ({
            paymentMethodId: wallet.paymentMethodId,
            name: wallet.name,
            safeAddress: wallet.safeAddress as string, // We've filtered out undefined
            owners: wallet.owners,
            threshold: wallet.threshold,
            chainId: wallet.chainId,
            isDefault: wallet.isDefault,
          }));
        setSafeWallets(validWallets);
      }
    } catch (error) {
      console.error('Error loading Safe wallets:', error);
    }
  };

  // Check if user is from Kenya to show M-Pesa options
  const isKenyanUser = () => {
    const userCountry = session?.user?.address?.country;
    const isKenya = userCountry === 'KE' || newPaymentMethod.currency === 'KES';
    
    // Debug logging
    console.log('Payment method validation:', {
      userCountry,
      currency: newPaymentMethod.currency,
      isKenya,
      session: !!session
    });
    
    return isKenya;
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payment-methods');
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.paymentMethods);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    
    try {
      const response = await fetch(`/api/payment-methods/${methodId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadPaymentMethods();
      } else {
        alert(data.error || 'Failed to delete payment method');
      }
    } catch {
      alert('Failed to delete payment method');
    }
  };

  const toggleSensitiveData = (methodId: string) => {
    setShowSensitiveData(prev => ({
      ...prev,
      [methodId]: !prev[methodId]
    }));
  };

  const handleBankSelect = (bank: Bank | null) => {
    if (bank) {
      setNewPaymentMethod(prev => ({
        ...prev,
        bankName: bank.name,
        swiftCode: bank.swift_code,
        bankCode: bank.bank_code || '',
        branchCode: bank.bank_code || ''
      }));
      setIsCustomBank(false);
      setShowCustomBankFields(false);
    } else {
      // Custom bank - user is typing custom bank name
      setIsCustomBank(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Payment Methods</h1>
            <p className="text-blue-200">Manage your payment methods for invoices</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="h-4 bg-white/20 rounded mb-4"></div>
              <div className="h-8 bg-white/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Payment Methods</h1>
          <p className="text-blue-200">Manage your payment methods for invoices</p>
        </div>
        <motion.button
          onClick={() => setShowAddModal(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Payment Method</span>
        </motion.button>
      </div>

      {/* Payment Methods List */}
      <div className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <CreditCard className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No payment methods yet</h3>
            <p className="text-blue-200 mb-6">Add your first payment method to start creating invoices</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Payment Method
            </button>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <motion.div
              key={method._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${
                    method.type === 'fiat' ? 
                      method.fiatDetails?.subtype === 'mpesa_paybill' || method.fiatDetails?.subtype === 'mpesa_till' ? 'bg-orange-500/20' : 'bg-green-500/20'
                    : method.type === 'crypto' ? 'bg-purple-500/20' : 'bg-green-500/20'
                  }`}>
                    {method.type === 'fiat' ? (
                      method.fiatDetails?.subtype === 'mpesa_paybill' || method.fiatDetails?.subtype === 'mpesa_till' ? (
                        <Smartphone className="h-6 w-6 text-orange-400" />
                      ) : (
                        <CreditCard className="h-6 w-6 text-green-400" />
                      )
                    ) : method.type === 'crypto' ? (
                      method.cryptoDetails?.safeDetails ? (
                        <Shield className="h-6 w-6 text-blue-400" />
                      ) : (
                        <Wallet className="h-6 w-6 text-purple-400" />
                      )
                    ) : (
                      <CreditCard className="h-6 w-6 text-green-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-white">{method.name}</h3>
                      {method.isDefault && (
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      )}
                    </div>
                    <p className="text-blue-200 text-sm">
                      {method.type === 'fiat' ? (
                        `${method.fiatDetails?.bankName} • ${method.fiatDetails?.currency}`
                      ) : method.cryptoDetails?.safeDetails ? (
                        `Safe Wallet • ${method.cryptoDetails?.network} • ${method.cryptoDetails?.safeDetails.threshold} of ${method.cryptoDetails?.safeDetails.owners.length}`
                      ) : (
                        `${method.cryptoDetails?.network} • ${method.cryptoDetails?.currency}`
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleSensitiveData(method._id || '')}
                    className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                    title="Toggle sensitive data"
                  >
                    {showSensitiveData[method._id || ''] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                    title="Edit payment method"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(method._id || '')}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    title="Delete payment method"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sensitive Data Display */}
              {showSensitiveData[method._id || ''] && (
                <div className="mt-4 p-4 bg-white/5 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Payment Details</h4>
                  {method.type === 'fiat' && method.fiatDetails ? (
                    <div className="text-sm space-y-1">
                      {method.fiatDetails.subtype === 'bank' && (
                        <>
                          <div>
                            <span className="text-blue-200">Account Name:</span>
                            <span className="text-white ml-2">{method.fiatDetails.accountName}</span>
                          </div>
                          <div>
                            <span className="text-blue-200">Account Number:</span>
                            <span className="text-white ml-2 font-mono">{method.fiatDetails.accountNumber}</span>
                          </div>
                          <div>
                            <span className="text-blue-200">SWIFT Code:</span>
                            <span className="text-white ml-2 font-mono">{method.fiatDetails.swiftCode}</span>
                          </div>
                          <div>
                            <span className="text-blue-200">Bank Code:</span>
                            <span className="text-white ml-2">{method.fiatDetails.bankCode}</span>
                          </div>
                        </>
                      )}
                      {method.fiatDetails.subtype === 'mpesa_paybill' && (
                        <>
                          <div>
                            <span className="text-blue-200">Paybill:</span>
                            <span className="text-white ml-2 font-mono">{method.fiatDetails.paybillNumber}</span>
                          </div>
                          <div>
                            <span className="text-blue-200">Account:</span>
                            <span className="text-white ml-2">{method.fiatDetails.mpesaAccountNumber}</span>
                          </div>
                        </>
                      )}
                      {method.fiatDetails.subtype === 'mpesa_till' && (
                        <div>
                          <span className="text-blue-200">Till Number:</span>
                          <span className="text-white ml-2 font-mono">{method.fiatDetails.tillNumber}</span>
                        </div>
                      )}
                    </div>
                  ) : method.type === 'crypto' && method.cryptoDetails ? (
                    <div className="text-sm">
                      <span className="text-blue-200">Address:</span>
                      <span className="text-white ml-2 font-mono break-all">{method.cryptoDetails.address}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add Payment Method</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const response = await fetch('/api/payment-methods', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: newPaymentMethod.name,
                    type: newPaymentMethod.type,
                    isDefault: newPaymentMethod.isDefault,
                                                             fiatDetails: newPaymentMethod.type === 'fiat' ? {
                      subtype: newPaymentMethod.subtype,
                      // Bank details
                      bankName: newPaymentMethod.bankName,
                      swiftCode: newPaymentMethod.swiftCode,
                      bankCode: newPaymentMethod.bankCode,
                      branchCode: newPaymentMethod.branchCode,
                      accountName: newPaymentMethod.accountName,
                      accountNumber: newPaymentMethod.accountNumber,
                      branchAddress: newPaymentMethod.branchAddress,
                      accountType: newPaymentMethod.accountType,
                      // Custom bank fields
                      customFields: newPaymentMethod.customFields || {},
                      // M-Pesa details
                      paybillNumber: newPaymentMethod.paybillNumber,
                      mpesaAccountNumber: newPaymentMethod.mpesaAccountNumber,
                      tillNumber: newPaymentMethod.tillNumber,
                      businessName: newPaymentMethod.businessName,
                      // Common fields
                      currency: newPaymentMethod.currency,
                      country: newPaymentMethod.country
                     } : undefined,
                    cryptoDetails: newPaymentMethod.type === 'crypto' ? {
                      address: newPaymentMethod.address,
                      network: newPaymentMethod.network,
                      currency: newPaymentMethod.currency
                    } : undefined
                  })
                });

                if (response.ok) {
                  setShowAddModal(false);
                  setNewPaymentMethod({
                    name: '',
                    type: 'fiat' as 'fiat' | 'crypto',
                    subtype: 'bank' as 'bank' | 'mpesa_paybill' | 'mpesa_till',
                    bankName: '',
                    swiftCode: '',
                    bankCode: '',
                    branchCode: '',
                    accountName: '',
                    accountNumber: '',
                    branchAddress: '',
                    accountType: 'checking' as 'checking' | 'savings' | 'business',
                    bankCountryCode: 'KE' as 'GH' | 'KE',
                    customFields: {} as Record<string, string>,
                    paybillNumber: '',
                    mpesaAccountNumber: '',
                    tillNumber: '',
                    businessName: '',
                    currency: 'USD',
                    country: 'US',
                    network: '',
                    address: '',
                    isDefault: false
                  });
                  loadPaymentMethods();
                }
                } catch {
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method Name</label>
                  <input
                    type="text"
                    value={newPaymentMethod.name}
                    onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                    placeholder="e.g., Main Bank Account"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="fiat"
                        checked={newPaymentMethod.type === 'fiat'}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, type: e.target.value as 'fiat' | 'crypto' }))}
                        className="mr-2"
                      />
                      Fiat Payment
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="crypto"
                        checked={newPaymentMethod.type === 'crypto'}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, type: e.target.value as 'fiat' | 'crypto' }))}
                        className="mr-2"
                      />
                      Cryptocurrency
                    </label>
                  </div>
                </div>

                {newPaymentMethod.type === 'fiat' ? (
                  <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Subtype</label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="bank"
                            checked={newPaymentMethod.subtype === 'bank'}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, subtype: e.target.value as 'bank' | 'mpesa_paybill' | 'mpesa_till' }))}
                            className="mr-2"
                          />
                          Bank Transfer
                        </label>
                        {(isKenyanUser() || true) && (
                          <>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                value="mpesa_paybill"
                                checked={newPaymentMethod.subtype === 'mpesa_paybill'}
                                onChange={(e) => setNewPaymentMethod(prev => ({ 
                                  ...prev, 
                                  subtype: e.target.value as 'bank' | 'mpesa_paybill' | 'mpesa_till',
                                  currency: 'KES',
                                  country: 'KE'
                                }))}
                                className="mr-2"
                              />
                              <Smartphone className="h-4 w-4 mr-2" />
                              M-Pesa Paybill
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                value="mpesa_till"
                                checked={newPaymentMethod.subtype === 'mpesa_till'}
                                onChange={(e) => setNewPaymentMethod(prev => ({ 
                                  ...prev, 
                                  subtype: e.target.value as 'bank' | 'mpesa_paybill' | 'mpesa_till',
                                  currency: 'KES',
                                  country: 'KE'
                                }))}
                                className="mr-2"
                              />
                              <Smartphone className="h-4 w-4 mr-2" />
                              M-Pesa Till Number
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                    {newPaymentMethod.subtype === 'bank' && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                            <div className="relative">
                              <select
                                value={newPaymentMethod.bankCountryCode || 'KE'}
                                onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, bankCountryCode: e.target.value as 'GH' | 'KE' }))}
                                className="text-xs text-gray-600 bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none"
                              >
                                <option value="GH">Ghana</option>
                                <option value="KE">Kenya</option>
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-600 pointer-events-none" />
                            </div>
                          </div>
                          <BankSelector
                            countryCode={newPaymentMethod.bankCountryCode || 'KE'}
                            value={newPaymentMethod.bankName}
                            onBankSelectAction={handleBankSelect}
                            onInputChangeAction={(value) => {
                              setNewPaymentMethod(prev => ({ ...prev, bankName: value }));
                              // If user clears the input, hide custom fields
                              if (!value || !value.trim()) {
                                setIsCustomBank(false);
                                setShowCustomBankFields(false);
                              }
                              // The useEffect will check if it's a custom bank after debounce
                            }}
                            placeholder="Search for a bank or type custom bank name..."
                            allowCustom={true}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Code</label>
                          <input
                            type="text"
                            value={newPaymentMethod.swiftCode}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, swiftCode: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="SWIFT/BIC code"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Code</label>
                          <input
                            type="text"
                            value={newPaymentMethod.bankCode}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, bankCode: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Bank code"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                          <input
                            type="text"
                            value={newPaymentMethod.branchCode}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, branchCode: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Branch code"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                          <input
                            type="text"
                            value={newPaymentMethod.accountName}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, accountName: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account holder name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={newPaymentMethod.accountNumber}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, accountNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account number"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Branch Address</label>
                          <textarea
                            value={newPaymentMethod.branchAddress}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, branchAddress: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Branch address"
                            rows={3}
                          />
                        </div>
                        {/* Custom bank fields - only shown for custom banks with toggle */}
                        {isCustomBank && (
                          <div className="pt-2 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setShowCustomBankFields(!showCustomBankFields)}
                              className="flex items-center justify-between w-full text-left text-xs text-gray-500 hover:text-gray-700 mb-3"
                            >
                              <span>Additional bank details (optional)</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${showCustomBankFields ? 'rotate-180' : ''}`} />
                            </button>
                            {showCustomBankFields && (
                              <DynamicBankFields
                                fields={newPaymentMethod.customFields || {}}
                                onFieldsChange={(fields) => setNewPaymentMethod(prev => ({ ...prev, customFields: fields }))}
                              />
                            )}
                          </div>
                        )}
                      </>
                    )}
                    
                    {newPaymentMethod.subtype === 'mpesa_paybill' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Paybill Number</label>
                          <input
                            type="text"
                            value={newPaymentMethod.paybillNumber}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, paybillNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="e.g., 123456"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={newPaymentMethod.mpesaAccountNumber}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, mpesaAccountNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account number for paybill"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={newPaymentMethod.businessName}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, businessName: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Your business name (optional)"
                          />
                        </div>
                      </>
                    )}
                    
                    {newPaymentMethod.subtype === 'mpesa_till' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Till Number</label>
                          <input
                            type="text"
                            value={newPaymentMethod.tillNumber}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, tillNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="e.g., 1234567"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={newPaymentMethod.businessName}
                            onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, businessName: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Your business name (optional)"
                          />
                        </div>
                      </>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={newPaymentMethod.subtype === 'mpesa_paybill' || newPaymentMethod.subtype === 'mpesa_till' ? 'KES' : newPaymentMethod.currency}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white font-medium"
                        disabled={newPaymentMethod.subtype === 'mpesa_paybill' || newPaymentMethod.subtype === 'mpesa_till'}
                        required
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="KES">KES</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                      <input
                        type="text"
                        value={newPaymentMethod.network}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, network: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="e.g., Ethereum, Bitcoin"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
                      <input
                        type="text"
                        value={newPaymentMethod.address}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Wallet address"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={newPaymentMethod.currency}
                        onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white font-medium"
                        required
                      >
                        <option value="ETH">ETH</option>
                        <option value="BTC">BTC</option>
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>
                  </div>
                )}


                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={newPaymentMethod.isDefault}
                    onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default payment method</label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Payment Method
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Safe Modal */}
      <ConnectSafeModal
        isOpen={showSafeModal}
        onClose={() => setShowSafeModal(false)}
        onSuccess={() => {
          loadSafeWallets();
          loadPaymentMethods();
        }}
      />
    </div>
  );
} 