'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  CreditCard,
  Wallet,
  Building2,
  User,
  FileText,
  Download,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { getCurrencyByCode } from '@/data/currencies';

interface Payable {
  _id: string;
  payableNumber: string;
  payableName: string;
  payableType: string;
  issueDate: string;
  dueDate: string;
  paymentDate?: string;
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: any;
  companyTaxNumber?: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string;
  vendorAddress?: any;
  currency: string;
  paymentMethod: string;
  paymentNetwork?: string;
  paymentAddress?: string;
  enableMultiCurrency: boolean;
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
  status: 'pending' | 'approved' | 'paid' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
  paymentMethodDetails: {
    method: string;
    network?: string;
    address?: string;
    bankDetails?: any;
    cryptoDetails?: any;
  };
  attachedFiles: any[];
  relatedInvoiceId?: string;
  ledgerEntryId?: string;
  ledgerStatus: string;
  frequency: string;
  recurringEndDate?: string;
  statusHistory: Array<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes: string;
  }>;
  lastNotificationSent?: string;
  notificationCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function PayableViewPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [payable, setPayable] = useState<Payable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);

  const payableId = params.id as string;

  useEffect(() => {
    if (payableId) {
      loadPayable();
    }
  }, [payableId]);

  const loadPayable = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/payables/${payableId}`);
      const data = await response.json();

      if (data.success) {
        setPayable(data.data);
      } else {
        setError(data.message || 'Failed to load payable');
      }
    } catch (err) {
      console.error('Error loading payable:', err);
      setError('Failed to load payable');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!payable) return;

    try {
      setUpdatingStatus(true);

      const response = await fetch(`/api/payables/${payableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          updatedAt: new Date().toISOString()
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPayable(prev => prev ? { ...prev, status: newStatus as any, updatedAt: new Date().toISOString() } : null);
      } else {
        console.error('Failed to update status:', data.message);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeletePayable = async () => {
    if (!payable) return;

    if (!confirm('Are you sure you want to delete this payable? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/payables/${payableId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard/services/payables');
      } else {
        console.error('Failed to delete payable:', data.message);
      }
    } catch (err) {
      console.error('Error deleting payable:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock3 className="h-4 w-4" />;
      case 'approved': return <CheckCircle2 className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock3 className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'urgent': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrencySymbol = () => {
    return getCurrencyByCode(payable?.currency || 'USD')?.symbol || '$';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-blue-200">Loading payable...</p>
        </div>
      </div>
    );
  }

  if (error || !payable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Payable Not Found</h1>
          <p className="text-blue-200 mb-6">{error || 'The payable you are looking for does not exist or you do not have permission to view it.'}</p>
          <button
            onClick={() => router.push('/dashboard/services/payables')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payables
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/services/payables')}
                className="p-2 text-blue-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">{payable.payableName}</h1>
                <p className="text-blue-200 text-sm">Payable #{payable.payableNumber}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(payable.status)}`}>
                {getStatusIcon(payable.status)}
                <span className="ml-1 capitalize">{payable.status}</span>
              </span>
              
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(payable.priority)}`}>
                <span className="capitalize">{payable.priority}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payable Document */}
            <div className="bg-white rounded-lg shadow-lg border">
              {/* Document Header */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                  {/* Left Side - Payable Name */}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">{payable.payableName}</h1>
                    {payable.payableNumber && (
                      <p className="text-lg text-gray-600 mt-2">Payable #: {payable.payableNumber}</p>
                    )}
                  </div>

                  {/* Right Side - Dates and Status */}
                  <div className="text-right">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">Issue Date</p>
                        <p className="font-medium text-gray-900">{formatDate(payable.issueDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Due Date</p>
                        <p className="font-medium text-gray-900">{formatDate(payable.dueDate)}</p>
                      </div>
                      {payable.paymentDate && (
                        <div>
                          <p className="text-sm text-gray-500">Payment Date</p>
                          <p className="font-medium text-gray-900">{formatDate(payable.paymentDate)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Company and Vendor Info */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Company (Sender) */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                      From
                    </h3>
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900">{payable.companyName}</p>
                      <p className="text-gray-600">{payable.companyEmail}</p>
                      {payable.companyPhone && (
                        <p className="text-gray-600">{payable.companyPhone}</p>
                      )}
                      {payable.companyAddress && (
                        <div className="text-gray-600">
                          <p>{payable.companyAddress.street}</p>
                          <p>{payable.companyAddress.city}, {payable.companyAddress.state} {payable.companyAddress.zipCode}</p>
                          <p>{payable.companyAddress.country}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vendor (Recipient) */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2 text-green-600" />
                      To
                    </h3>
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900">{payable.vendorName}</p>
                      <p className="text-gray-600">{payable.vendorEmail}</p>
                      {payable.vendorPhone && (
                        <p className="text-gray-600">{payable.vendorPhone}</p>
                      )}
                      {payable.vendorAddress && (
                        <div className="text-gray-600">
                          <p>{payable.vendorAddress.street}</p>
                          <p>{payable.vendorAddress.city}, {payable.vendorAddress.state} {payable.vendorAddress.zipCode}</p>
                          <p>{payable.vendorAddress.country}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
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
                      {payable.items.map((item, index) => (
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
              <div className="p-4 sm:p-8">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{getCurrencySymbol()}{payable.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">{getCurrencySymbol()}{payable.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>Total:</span>
                      <span>{getCurrencySymbol()}{payable.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {payable.memo && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-gray-600">{payable.memo}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                Payment Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">{payable.paymentMethod}</p>
                </div>
                
                {payable.paymentNetwork && (
                  <div>
                    <p className="text-sm text-gray-500">Network</p>
                    <p className="font-medium text-gray-900">{payable.paymentNetwork}</p>
                  </div>
                )}
                
                {payable.paymentAddress && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Address</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-mono text-sm text-gray-900 break-all">{payable.paymentAddress}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(payable.paymentAddress!)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500">Currency</p>
                  <p className="font-medium text-gray-900">{payable.currency}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payable.paymentStatus)}`}>
                    {getStatusIcon(payable.paymentStatus)}
                    <span className="ml-1 capitalize">{payable.paymentStatus}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              
              <div className="space-y-3">
                {payable.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{updatingStatus ? 'Updating...' : 'Approve Payable'}</span>
                  </button>
                )}
                
                {payable.status === 'approved' && (
                  <button
                    onClick={() => handleStatusUpdate('paid')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
                  </button>
                )}
                
                <button
                  onClick={() => setShowStatusHistory(!showStatusHistory)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  <span>View History</span>
                </button>
                
                <button
                  onClick={handleDeletePayable}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Status History */}
            {showStatusHistory && (
              <div className="bg-white rounded-lg shadow-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status History</h3>
                <div className="space-y-3">
                  {payable.statusHistory.map((entry, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getStatusIcon(entry.status)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 capitalize">{entry.status}</p>
                        <p className="text-xs text-gray-500">{formatDate(entry.changedAt)}</p>
                        <p className="text-xs text-gray-500">by {entry.changedBy}</p>
                        {entry.notes && (
                          <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}