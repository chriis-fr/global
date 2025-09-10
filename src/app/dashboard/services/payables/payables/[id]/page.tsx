'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Edit,
  Download,
  Send,
  CheckCircle,
  X,
  Calendar,
  DollarSign,
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Receipt,
  AlertCircle,
  Clock,
  Eye,
  Printer,
  Share2,
  MoreVertical
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface Payable {
  _id: string;
  payableNumber: string;
  payableName: string;
  issueDate: string;
  dueDate: string;
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
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  category: string;
  priority: 'low' | 'medium' | 'high';
  approvalRequired: boolean;
  approverEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PayableDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [payable, setPayable] = useState<Payable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPayable = async () => {
      try {
        const response = await fetch(`/api/payables/${params.id}`);
        const data = await response.json();
        
        if (data.success) {
          setPayable(data.data);
        } else {
          setError(data.message || 'Failed to load payable');
        }
      } catch (error) {
        console.error('Error loading payable:', error);
        setError('Failed to load payable');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadPayable();
    }
  }, [params.id]);

  const handleApprove = async () => {
    if (!payable) return;
    
    try {
      const response = await fetch(`/api/payables/${payable._id}/approve`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setPayable(prev => prev ? { ...prev, status: 'approved' } : null);
      }
    } catch (error) {
      console.error('Error approving payable:', error);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payable) return;
    
    try {
      const response = await fetch(`/api/payables/${payable._id}/mark-paid`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setPayable(prev => prev ? { ...prev, status: 'paid' } : null);
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isOverdue = (dueDate: string, status: string) => {
    return status !== 'paid' && new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payable...</p>
        </div>
      </div>
    );
  }

  if (error || !payable) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Payable Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The payable you are looking for does not exist.'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

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
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {payable.payableNumber || 'PAY-' + payable._id.slice(-6)}
                </h1>
                <p className="text-sm text-gray-500">{payable.payableName}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(payable.status)}
                <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(payable.status)}`}>
                  {payable.status}
                </span>
                <span className={`text-sm px-2 py-1 rounded-full ${getPriorityColor(payable.priority)}`}>
                  {payable.priority}
                </span>
              </div>
              
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
              
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Printer className="h-5 w-5" />
              </button>
              
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Download className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => router.push(`/dashboard/services/payables/create?id=${payable._id}`)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payable Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payable Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Issue Date</h3>
                  <p className="text-gray-900">{formatDate(payable.issueDate)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Due Date</h3>
                  <p className={`${isOverdue(payable.dueDate, payable.status) ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatDate(payable.dueDate)}
                    {isOverdue(payable.dueDate, payable.status) && (
                      <span className="ml-2 text-sm text-red-600">(Overdue)</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Category</h3>
                  <p className="text-gray-900">{payable.category}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Method</h3>
                  <p className="text-gray-900 capitalize">{payable.paymentMethod}</p>
                </div>
              </div>
              
              {payable.memo && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Memo</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{payable.memo}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Qty</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Unit Price</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Discount</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Tax</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payable.items.map((item, index) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-900">{item.description}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{item.quantity}</td>
                        <td className="py-3 px-4 text-right text-gray-900">
                          <FormattedNumberDisplay value={item.unitPrice} />
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">{item.discount}%</td>
                        <td className="py-3 px-4 text-right text-gray-900">{item.tax}%</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          <FormattedNumberDisplay value={item.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={5} className="py-3 px-4 text-right font-medium text-gray-700">
                        Subtotal:
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        <FormattedNumberDisplay value={payable.subtotal} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-right font-medium text-gray-700">
                        Tax:
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        <FormattedNumberDisplay value={payable.totalTax} />
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td colSpan={5} className="py-3 px-4 text-right font-semibold text-gray-900">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        <FormattedNumberDisplay value={payable.total} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Company Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Company</h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Company Name</h3>
                  <p className="text-gray-900">{payable.companyName}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Email</h3>
                  <p className="text-gray-900">{payable.companyEmail}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Phone</h3>
                  <p className="text-gray-900">{payable.companyPhone}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Address</h3>
                  <p className="text-gray-900">
                    {payable.companyAddress.street}<br />
                    {payable.companyAddress.city}, {payable.companyAddress.state} {payable.companyAddress.zipCode}<br />
                    {payable.companyAddress.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendor</h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Vendor Name</h3>
                  <p className="text-gray-900">{payable.vendorCompany || payable.vendorName}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Email</h3>
                  <p className="text-gray-900">{payable.vendorEmail}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Phone</h3>
                  <p className="text-gray-900">{payable.vendorPhone}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Address</h3>
                  <p className="text-gray-900">
                    {payable.vendorAddress.street}<br />
                    {payable.vendorAddress.city}, {payable.vendorAddress.state} {payable.vendorAddress.zipCode}<br />
                    {payable.vendorAddress.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              
              <div className="space-y-3">
                {payable.status === 'pending' && payable.approvalRequired && (
                  <button
                    onClick={handleApprove}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                )}
                
                {payable.status === 'approved' && (
                  <button
                    onClick={handleMarkAsPaid}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Mark as Paid</span>
                  </button>
                )}
                
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  <Send className="h-4 w-4" />
                  <span>Send to Vendor</span>
                </button>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Payment Method</h3>
                  <p className="text-gray-900 capitalize">{payable.paymentMethod}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Currency</h3>
                  <p className="text-gray-900">{payable.currency}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Total Amount</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    <FormattedNumberDisplay value={payable.total} />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
