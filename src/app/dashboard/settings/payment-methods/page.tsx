'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  CreditCard, 
  Wallet, 
  Edit3, 
  Trash2, 
  Star,
  Eye,
  EyeOff
} from 'lucide-react';

interface PaymentMethod {
  _id?: string;
  name: string;
  type: 'fiat' | 'crypto';
  isDefault: boolean;
  isActive: boolean;
  fiatDetails?: {
    bankName: string;
    accountNumber: string;
    currency: string;
  };
  cryptoDetails?: {
    address: string;
    network: string;
    currency: string;
  };
}

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSensitiveData, setShowSensitiveData] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payment-methods');
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.data.paymentMethods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
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
    } catch (error) {
      console.error('Error deleting payment method:', error);
      alert('Failed to delete payment method');
    }
  };

  const toggleSensitiveData = (methodId: string) => {
    setShowSensitiveData(prev => ({
      ...prev,
      [methodId]: !prev[methodId]
    }));
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
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
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
                    method.type === 'fiat' ? 'bg-green-500/20' : 'bg-purple-500/20'
                  }`}>
                    {method.type === 'fiat' ? (
                      <CreditCard className="h-6 w-6 text-green-400" />
                    ) : (
                      <Wallet className="h-6 w-6 text-purple-400" />
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
                    <div className="text-sm">
                      <span className="text-blue-200">Account Number:</span>
                      <span className="text-white ml-2 font-mono">{method.fiatDetails.accountNumber}</span>
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
    </div>
  );
} 