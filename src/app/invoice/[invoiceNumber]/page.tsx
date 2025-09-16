'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  AlertCircle,
  Loader2,
  ArrowRight,
  CreditCard,
  Wallet,
  Eye,
  EyeOff
} from 'lucide-react';
import { getCurrencyByCode } from '@/data/currencies';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceName?: string;
  issueDate: string;
  dueDate: string;
  companyDetails: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  clientDetails: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  memo?: string;
  status: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

interface InvoiceLinkData {
  invoice: Invoice;
  recipientEmail: string;
  isRegistered: boolean;
  requiresAccountCreation: boolean;
}

export default function InvoiceLinkPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  
  const [invoiceData, setInvoiceData] = useState<InvoiceLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  const invoiceNumber = params.invoiceNumber as string;

  const loadInvoiceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/invoice-link/${invoiceNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setInvoiceData(data.data);
      } else {
        setError(data.message || 'Invoice not found');
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => {
    if (invoiceNumber) {
      loadInvoiceData();
    }
  }, [invoiceNumber, loadInvoiceData]);

  const handleSignIn = async () => {
    if (!invoiceData?.recipientEmail) return;
    
    try {
      await signIn('credentials', {
        email: invoiceData.recipientEmail,
        callbackUrl: `/invoice/${invoiceNumber}`,
      });
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleSignUp = () => {
    // Redirect to signup page with invoice token
    const signupUrl = `/auth?invoiceToken=${invoiceNumber}&email=${encodeURIComponent(invoiceData?.recipientEmail || '')}`;
    router.push(signupUrl);
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrencySymbol = () => {
    return getCurrencyByCode(invoiceData?.invoice.currency || 'USD')?.symbol || '$';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || 'The invoice you are looking for could not be found or may have been removed.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  const { invoice, recipientEmail, isRegistered } = invoiceData;

  // If user is authenticated and this is their invoice, show the payable view
  if (session?.user?.email === recipientEmail) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Receipt className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Invoice #{invoiceData?.invoice?.invoiceNumber}</h1>
                  <p className="text-gray-600">From {invoiceData?.invoice?.companyDetails?.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <span className="ml-2 capitalize">{invoiceData?.invoice?.status || 'pending'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Invoice Header */}
            <div className="px-6 py-8 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Bill From</h2>
                  <div className="text-gray-600">
                    <p className="font-medium text-gray-900">{invoice.companyDetails.name}</p>
                    <p>{invoice.companyDetails.email}</p>
                    {invoice.companyDetails.phone && <p>{invoice.companyDetails.phone}</p>}
                    {invoice.companyDetails.address && (
                      <div className="mt-2">
                        <p>{invoice.companyDetails.address.street}</p>
                        <p>{invoice.companyDetails.address.city}, {invoice.companyDetails.address.state} {invoice.companyDetails.address.zipCode}</p>
                        <p>{invoice.companyDetails.address.country}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Bill To</h2>
                  <div className="text-gray-600">
                    <p className="font-medium text-gray-900">{invoice.clientDetails.companyName || invoice.clientDetails.name}</p>
                    <p>{invoice.clientDetails.email}</p>
                    {invoice.clientDetails.phone && <p>{invoice.clientDetails.phone}</p>}
                    {invoice.clientDetails.address && (
                      <div className="mt-2">
                        <p>{invoice.clientDetails.address.street}</p>
                        <p>{invoice.clientDetails.address.city}, {invoice.clientDetails.address.state} {invoice.clientDetails.address.zipCode}</p>
                        <p>{invoice.clientDetails.address.country}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="px-6 py-6 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Invoice Number</p>
                  <p className="font-medium text-gray-900">#{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Issue Date</p>
                  <p className="font-medium text-gray-900">{formatDate(invoice.issueDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoice.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getCurrencySymbol()}{item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getCurrencySymbol()}{item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="px-6 py-6 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{getCurrencySymbol()}{invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{getCurrencySymbol()}{invoice.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-4 border-t border-gray-200">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {getCurrencySymbol()}{invoice.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            {invoice.status !== 'paid' && (
              <div className="px-6 py-6 border-t border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Payment Method</p>
                    <div className="flex items-center space-x-2">
                      {invoice.paymentMethod === 'crypto' ? (
                        <Wallet className="h-5 w-5 text-blue-600" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-green-600" />
                      )}
                      <span className="font-medium capitalize">{invoice.paymentMethod}</span>
                    </div>
                  </div>
                  {invoice.paymentMethod === 'crypto' && invoice.paymentAddress && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Payment Address</p>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {showPaymentDetails ? invoice.paymentAddress : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPaymentDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/dashboard/services/payables/payables')}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <span>Pay Invoice</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {invoice.memo && (
              <div className="px-6 py-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-600">{invoice.memo}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Show authentication/account creation flow for unauthenticated users
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Receipt className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice #{invoice.invoiceNumber}</h1>
              <p className="text-gray-600">From {invoice.companyDetails.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Flow */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
        >
          <div className="text-center mb-8">
            <Receipt className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">View Your Invoice</h2>
            <p className="text-gray-600">
              This invoice was sent to <strong>{recipientEmail}</strong>
            </p>
          </div>

          <div className="space-y-6">
            {isRegistered ? (
              <div>
                <p className="text-gray-600 mb-4">
                  You already have an account with this email address. Please sign in to view your invoice.
                </p>
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Sign In to View Invoice</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Create a free account to view and pay this invoice online.
                </p>
                <button
                  onClick={handleSignUp}
                  className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <span>Create Account & View Invoice</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
