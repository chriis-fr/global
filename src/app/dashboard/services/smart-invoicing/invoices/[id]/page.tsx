'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, 
  Edit3,
  Trash2,
  Building2,
  User,
  Calendar,
  Clock,
  Loader2
} from 'lucide-react';
import { countries } from '@/data/countries';
import { getCurrencyByCode } from '@/data/currencies';

interface Invoice {
  _id: string;
  invoiceName: string;
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
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  enableMultiCurrency: boolean;
  invoiceType: 'regular' | 'recurring';
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
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

export default function InvoiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInvoice = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setInvoice(data.data);
      } else {
        router.push('/dashboard/services/smart-invoicing/invoices');
      }
    } catch (error) {
      console.error('Failed to load invoice:', error);
      router.push('/dashboard/services/smart-invoicing/invoices');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (params.id && session?.user) {
      loadInvoice(params.id as string);
    }
  }, [params.id, session, loadInvoice]);

  const handleDeleteInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/dashboard/services/smart-invoicing/invoices');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getCurrencySymbol = (currency: string) => {
    return getCurrencyByCode(currency)?.symbol || currency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice not found</h2>
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing/invoices')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          
          <div className="flex space-x-4">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
            <button
              onClick={() => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={handleDeleteInvoice}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white rounded-lg shadow-lg border max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="p-8 border-b border-gray-200">
            <div className="flex justify-between items-start">
              {/* Left Side - Invoice Name */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceName}</h1>
              </div>

              {/* Right Side - Dates */}
              <div className="text-right space-y-2">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Issued on {formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>Payment due by {formatDate(invoice.dueDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="p-8 border-b border-gray-200">
            <div className="flex justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  From
                </h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">{invoice.companyName}</div>
                  <div className="text-gray-600">
                    {invoice.companyAddress.street && <div>{invoice.companyAddress.street}</div>}
                    {(invoice.companyAddress.city || invoice.companyAddress.state || invoice.companyAddress.zipCode) && (
                      <div>
                        {[invoice.companyAddress.city, invoice.companyAddress.state, invoice.companyAddress.zipCode]
                          .filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.companyAddress.country && (
                      <div>{countries.find(c => c.code === invoice.companyAddress.country)?.name}</div>
                    )}
                  </div>
                  {invoice.companyTaxNumber && <div className="text-gray-600">Tax: {invoice.companyTaxNumber}</div>}
                  {invoice.companyEmail && <div className="text-gray-600">{invoice.companyEmail}</div>}
                  {invoice.companyPhone && <div className="text-gray-600">{invoice.companyPhone}</div>}
                </div>
              </div>

              {/* Client Information */}
              <div className="flex-1 ml-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Bill To
                </h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">{invoice.clientName}</div>
                  <div className="text-gray-600">
                    {invoice.clientAddress.street && <div>{invoice.clientAddress.street}</div>}
                    {(invoice.clientAddress.city || invoice.clientAddress.state || invoice.clientAddress.zipCode) && (
                      <div>
                        {[invoice.clientAddress.city, invoice.clientAddress.state, invoice.clientAddress.zipCode]
                          .filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.clientAddress.country && (
                      <div>{countries.find(c => c.code === invoice.clientAddress.country)?.name}</div>
                    )}
                  </div>
                  {invoice.clientEmail && <div className="text-gray-600">{invoice.clientEmail}</div>}
                  {invoice.clientPhone && <div className="text-gray-600">{invoice.clientPhone}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Payment Method</p>
                <p className="font-medium">
                  {invoice.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
                </p>
                {invoice.paymentMethod === 'crypto' && invoice.paymentNetwork && (
                  <p className="text-sm text-gray-600">Network: {invoice.paymentNetwork}</p>
                )}
                {invoice.paymentMethod === 'fiat' && invoice.bankName && (
                  <p className="text-sm text-gray-600">Bank: {invoice.bankName}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Currency</p>
                <p className="font-medium">{invoice.currency}</p>
                {invoice.enableMultiCurrency && (
                  <p className="text-sm text-blue-600">Multi-currency enabled</p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Invoice Items</h3>
            
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Tax</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{item.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{item.quantity}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{getCurrencySymbol(invoice.currency)}{item.unitPrice.toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{item.discount}%</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{item.tax}%</div>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <div className="text-gray-900">{getCurrencySymbol(invoice.currency)}{item.amount.toFixed(2)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Amount without tax</span>
                  <span>{getCurrencySymbol(invoice.currency)}{invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Tax amount</span>
                  <span>{getCurrencySymbol(invoice.currency)}{invoice.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>{getCurrencySymbol(invoice.currency)}{invoice.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>{getCurrencySymbol(invoice.currency)}{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memo */}
          {invoice.memo && (
            <div className="p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Memo</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{invoice.memo}</p>
            </div>
          )}

          {/* Footer */}
          <div className="p-8 text-center text-sm text-gray-500">
            <p>Invoice created on {formatDate(invoice.createdAt)}</p>
            {invoice.updatedAt !== invoice.createdAt && (
              <p>Last updated on {formatDate(invoice.updatedAt)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 