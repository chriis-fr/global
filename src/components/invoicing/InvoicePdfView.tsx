'use client';

import { forwardRef, memo } from 'react';
import Image from 'next/image';
import { Building2, User, Calendar, Clock } from 'lucide-react';
import { getCurrencyByCode } from '@/data/currencies';
import { countries } from '@/data/countries';
import { formatDateReadable } from '@/lib/utils/dateFormat';

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
  clientCompany?: string;
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

const InvoicePdfView = memo(forwardRef<HTMLDivElement, InvoicePdfViewProps>(
  ({ formData, invoiceNumber }, ref) => {
    // Check if any items have discounts or taxes
    const hasAnyDiscounts = formData.items.some(item => item.discount > 0);
    const hasAnyTaxes = formData.items.some(item => item.tax > 0);
    // Use consistent date formatting utility to avoid hydration mismatches
    const formatDate = (dateString: string) => {
      return formatDateReadable(dateString);
    };

    const getCurrencySymbol = () => {
      return getCurrencyByCode(formData.currency)?.symbol || '€';
    };

    return (
      <div ref={ref} className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
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
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Issued on {formatDate(formData.issueDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Payment due by {formatDate(formData.dueDate)}</span>
                  </div>
                  {invoiceNumber && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium">Invoice: {invoiceNumber}</span>
                    </div>
                  )}
                </div>
                {formData.companyLogo ? (
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    <Image
                      src={formData.companyLogo}
                      alt="Company Logo"
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                      loading="eager"
                      priority
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Company and Client Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-8">
          {/* Company Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              From
            </h2>
            <div className="space-y-2">
              <div className="font-medium text-gray-900">{formData.companyName}</div>
              <div className="text-gray-600">{formData.companyEmail}</div>
              <div className="text-gray-600">{formData.companyPhone}</div>
              <div className="text-gray-600">
                {formData.companyAddress.street}<br />
                {formData.companyAddress.city}, {formData.companyAddress.state} {formData.companyAddress.zipCode}<br />
                {countries.find(c => c.code === formData.companyAddress.country)?.name || formData.companyAddress.country}
              </div>
              {formData.companyTaxNumber && (
                <div className="text-gray-600">Tax ID: {formData.companyTaxNumber}</div>
              )}
            </div>
          </div>

          {/* Client Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              To
            </h2>
            <div className="space-y-2">
              <div className="font-medium text-gray-900">{formData.clientName}</div>
              {formData.clientCompany && (
                <div className="text-gray-600">{formData.clientCompany}</div>
              )}
              <div className="text-gray-600">{formData.clientEmail}</div>
              <div className="text-gray-600">{formData.clientPhone}</div>
              <div className="text-gray-600">
                {formData.clientAddress.street && <>{formData.clientAddress.street}<br /></>}
                {(formData.clientAddress.city || formData.clientAddress.state || formData.clientAddress.zipCode) && (
                  <>
                    {formData.clientAddress.city || ''}{formData.clientAddress.city && (formData.clientAddress.state || formData.clientAddress.zipCode) ? ', ' : ''}
                    {formData.clientAddress.state || ''}{formData.clientAddress.state && formData.clientAddress.zipCode ? ' ' : ''}
                    {formData.clientAddress.zipCode || ''}
                    <br />
                  </>
                )}
                {formData.clientAddress.country && (
                  <>{countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country}</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="py-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Quantity</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Unit Price</th>
                  {hasAnyDiscounts && (
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Discount</th>
                  )}
                  {hasAnyTaxes && (
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Tax</th>
                  )}
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Amount</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-900">{item.description}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {getCurrencySymbol()}{item.unitPrice.toFixed(2)}
                    </td>
                    {hasAnyDiscounts && (
                      <td className="py-3 px-4 text-right text-gray-600">
                        {item.discount > 0 ? `${getCurrencySymbol()}${item.discount.toFixed(2)}` : '-'}
                      </td>
                    )}
                    {hasAnyTaxes && (
                      <td className="py-3 px-4 text-right text-gray-600">
                        {item.tax > 0 ? `${getCurrencySymbol()}${item.tax.toFixed(2)}` : '-'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {getCurrencySymbol()}{item.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="py-8">
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{getCurrencySymbol()}{formData.subtotal.toFixed(2)}</span>
              </div>
              {formData.totalTax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax:</span>
                  <span>{getCurrencySymbol()}{formData.totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span>{getCurrencySymbol()}{formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="py-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Payment Method</h4>
              <div className="text-gray-600">
                {formData.paymentMethod === 'fiat' ? (
                  <div>
                    <div>Bank Transfer</div>
                    {formData.bankName && <div>Bank: {formData.bankName}</div>}
                    {formData.accountNumber && <div>Account: {formData.accountNumber}</div>}
                    {formData.routingNumber && <div>Routing: {formData.routingNumber}</div>}
                  </div>
                ) : (
                  <div>
                    <div>Cryptocurrency</div>
                    {formData.paymentNetwork && <div>Network: {formData.paymentNetwork}</div>}
                    {formData.paymentAddress && (
                      <div className="break-all">
                        Address: {formData.paymentAddress}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {formData.memo && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Memo</h4>
                <div className="text-gray-600">{formData.memo}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
));

InvoicePdfView.displayName = 'InvoicePdfView';

export default InvoicePdfView; 