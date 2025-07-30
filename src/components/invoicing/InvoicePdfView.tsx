'use client';

import { forwardRef } from 'react';
import Image from 'next/image';
import { Building2, User, Calendar, Clock } from 'lucide-react';
import { getCurrencyByCode } from '@/data/currencies';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  amount: number;
}

interface InvoiceFormData {
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
  companyLogo?: string;
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
  paymentMethod: string;
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  enableMultiCurrency: boolean;
  invoiceType: string;
  items: InvoiceItem[];
  subtotal: number;
  totalTax: number;
  total: number;
  memo?: string;
}

interface InvoicePdfViewProps {
  formData: InvoiceFormData;
  invoiceNumber?: string;
}

const InvoicePdfView = forwardRef<HTMLDivElement, InvoicePdfViewProps>(
  ({ formData, invoiceNumber }, ref) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const getCurrencySymbol = () => {
      return getCurrencyByCode(formData.currency)?.symbol || '€';
    };

    return (
      <div ref={ref} className="bg-white p-8 max-w-4xl mx-auto">
        {/* Document Header */}
        <div className="border-b border-gray-200 pb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-start gap-4">
            {/* Left Side - Invoice Name */}
            <div className="flex-1 w-full lg:w-auto">
              <h1 className="text-3xl font-bold text-gray-900">
                {formData.invoiceName || 'Invoice'}
              </h1>
            </div>

            {/* Right Side - Dates and Logo */}
            <div className="text-left lg:text-right space-y-2 w-full lg:w-auto">
              <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-4">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Issued on {formatDate(formData.issueDate)}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>Payment due by {formatDate(formData.dueDate)}</span>
                  </div>
                </div>
                                 <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                   {formData.companyLogo ? (
                     <Image 
                       src={formData.companyLogo} 
                       alt="Company Logo" 
                       width={64}
                       height={64}
                       className="object-contain w-full h-full"
                       unoptimized={formData.companyLogo.startsWith('data:')}
                       style={{ backgroundColor: 'white' }}
                     />
                   ) : (
                     <Building2 className="h-8 w-8 text-gray-400" />
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="py-8 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                From
              </h3>
              <div className="space-y-2">
                <div className="font-medium">
                  {formData.companyName || 'Company Name'}
                </div>
                <div className="text-gray-600 space-y-1">
                  <div>{formData.companyAddress.street || 'Street Address'}</div>
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <span>{formData.companyAddress.city || 'City'}</span>
                    <span>{formData.companyAddress.state || 'State'}</span>
                    <span>{formData.companyAddress.zipCode || 'ZIP'}</span>
                  </div>
                  <div>{formData.companyAddress.country || 'Country'}</div>
                </div>
                <div className="text-gray-600">
                  Tax: {formData.companyTaxNumber || 'Tax Number'}
                </div>
                <div className="text-gray-600">
                  {formData.companyEmail || 'Email'}
                </div>
                <div className="text-gray-600">
                  {formData.companyPhone || 'Phone'}
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="flex-1 lg:ml-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Bill To
              </h3>
              <div className="space-y-2">
                <div className="font-medium">
                  {formData.clientName || 'Client Name'}
                </div>
                <div className="text-gray-600 space-y-1">
                  <div>{formData.clientAddress.street || 'Street Address'}</div>
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <span>{formData.clientAddress.city || 'City'}</span>
                    <span>{formData.clientAddress.state || 'State'}</span>
                    <span>{formData.clientAddress.zipCode || 'ZIP'}</span>
                  </div>
                  <div>{formData.clientAddress.country || 'Country'}</div>
                </div>
                <div className="text-gray-600">
                  {formData.clientEmail || 'Email'}
                </div>
                <div className="text-gray-600">
                  {formData.clientPhone || 'Phone'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="py-8 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Invoice Items</h3>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Tax</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.items.map((item: InvoiceItem) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.description || 'Item description'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {getCurrencySymbol()}{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.discount}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.tax}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-sm text-gray-900">
                      {getCurrencySymbol()}{item.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Amount without tax</span>
                <span>{getCurrencySymbol()}{formData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Total Tax amount</span>
                <span>{getCurrencySymbol()}{formData.totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2">
                <span>Total amount</span>
                <span>{getCurrencySymbol()}{formData.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-blue-600">
                <span>Due</span>
                <span>{getCurrencySymbol()}{formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="py-8 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Payment Method</h4>
              <div className="text-sm text-gray-600">
                {formData.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
              </div>
              {formData.paymentMethod === 'crypto' && formData.paymentNetwork && (
                <div className="text-sm text-gray-600 mt-1">
                  Network: {formData.paymentNetwork}
                </div>
              )}
              {formData.paymentMethod === 'fiat' && formData.bankName && (
                <div className="text-sm text-gray-600 mt-1">
                  Bank: {formData.bankName}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Currency</h4>
              <div className="text-sm text-gray-600">
                {formData.currency} ({getCurrencySymbol()})
              </div>
            </div>
          </div>
        </div>

        {/* Memo */}
        {formData.memo && (
          <div className="py-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Memo</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {formData.memo}
            </div>
          </div>
        )}

        {/* Invoice Number */}
        {invoiceNumber && (
          <div className="py-8 text-center">
            <div className="text-sm text-gray-500">
                  Invoice Number: {invoiceNumber}
            </div>
          </div>
        )}
      </div>
    );
  }
);

InvoicePdfView.displayName = 'InvoicePdfView';

export default InvoicePdfView; 