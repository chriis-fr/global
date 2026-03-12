'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  CreditCard,
  Loader2,
  Upload,
  FileText,
  X,
  ChevronDown,
  Smartphone,
} from 'lucide-react';
import BankSelector from '@/components/BankSelector';
import type { Bank } from '@/data';

interface SubmitState {
  loading: boolean;
  successMessage?: string;
  errorMessage?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
}

interface Company {
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
}

interface LinkData {
  vendor: { name: string; email: string };
  company: Company;
}

export default function VendorPayableSubmitPage() {
  const params = useParams<{ token: string }>();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ loading: false });
  const [items, setItems] = useState<LineItem[]>([
    { id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, tax: 0 },
  ]);
  const [currency, setCurrency] = useState('KES');
  const [paymentType, setPaymentType] = useState<'bank' | 'mpesa' | 'other'>('bank');
  const [paymentDetails, setPaymentDetails] = useState({
    bankName: '',
    bankCountryCode: 'KE',
    swiftCode: '',
    accountName: '',
    accountNumber: '',
    paybillNumber: '',
    mpesaAccountNumber: '',
    tillNumber: '',
    businessName: '',
    otherDetails: '',
  });
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [totalTaxPercent, setTotalTaxPercent] = useState<number>(0);

  useEffect(() => {
    if (!params?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/vendor-links/${params.token}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setLinkError(json.error || 'Invalid link');
          return;
        }
        setLinkData(json.data);
      } catch {
        if (!cancelled) setLinkError('Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [params?.token]);

  const handleItemChange = (
    index: number,
    field: keyof Omit<LineItem, 'id'>,
    value: string | number
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === 'description') item.description = String(value);
      else if (field === 'quantity') item.quantity = Math.max(0, Number(value) || 0);
      else if (field === 'unitPrice') item.unitPrice = Math.max(0, Number(value) || 0);
      else if (field === 'tax') item.tax = Math.max(0, Math.min(100, Number(value) || 0));
      next[index] = item;
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}-${prev.length}`, description: '', quantity: 1, unitPrice: 0, tax: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const getItemAmount = (item: LineItem) => {
    const sub = item.quantity * item.unitPrice;
    const taxAmount = (sub * item.tax) / 100;
    return sub + taxAmount;
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalItemTax = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice * i.tax) / 100, 0);
  const taxOnTotalAmount = totalTaxPercent > 0 ? ((subtotal + totalItemTax) * totalTaxPercent) / 100 : 0;
  const total = subtotal + totalItemTax + taxOnTotalAmount;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!params?.token) return;

    const validItems = items.filter(
      (i) => i.description.trim() && i.quantity > 0 && i.unitPrice >= 0
    );
    if (validItems.length === 0) {
      setState({
        errorMessage: 'Add at least one line item with description, quantity, and unit price.',
      });
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const invoiceNumber = (formData.get('invoiceNumber') as string)?.trim();
    const dueDate = formData.get('dueDate') as string;
    if (!invoiceNumber || !dueDate) {
      setState({ errorMessage: 'Invoice number and due date are required.' });
      return;
    }

    const lineItems = items.map((i) => {
      const amt = getItemAmount(i);
      return {
        id: i.id,
        description: i.description || 'Item',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        tax: i.tax,
        discount: 0,
        amount: Math.round(amt * 100) / 100,
      };
    });
    if (totalTaxPercent > 0 && taxOnTotalAmount > 0) {
      lineItems.push({
        id: `total-tax-${Date.now()}`,
        description: `Tax (${totalTaxPercent}% on total)`,
        quantity: 1,
        unitPrice: Math.round(taxOnTotalAmount * 100) / 100,
        tax: 0,
        discount: 0,
        amount: Math.round(taxOnTotalAmount * 100) / 100,
      });
    }

    const vendorPaymentDetails =
      paymentType === 'bank'
        ? {
            type: 'bank' as const,
            bankCountryCode: paymentDetails.bankCountryCode || 'KE',
            bankName: paymentDetails.bankName || undefined,
            swiftCode: paymentDetails.swiftCode || undefined,
            accountName: paymentDetails.accountName || undefined,
            accountNumber: paymentDetails.accountNumber || undefined,
          }
        : paymentType === 'mpesa'
          ? {
              type: 'mpesa' as const,
              paybillNumber: paymentDetails.paybillNumber || undefined,
              mpesaAccountNumber: paymentDetails.mpesaAccountNumber || undefined,
              tillNumber: paymentDetails.tillNumber || undefined,
              businessName: paymentDetails.businessName || undefined,
            }
          : {
              type: 'other' as const,
              otherDetails: paymentDetails.otherDetails || undefined,
            };

    setState({ loading: true, errorMessage: undefined });
    try {
      const res = await fetch(`/api/vendor-links/${params.token}/payables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber,
          description: (formData.get('description') as string) || '',
          amount: Math.round((subtotal + totalItemTax + taxOnTotalAmount) * 100) / 100,
          currency: (formData.get('currency') as string) || currency,
          dueDate,
          lineItems,
          invoiceFileUrl: uploadedFileUrl || '',
          note: (formData.get('note') as string) || '',
          vendorPaymentDetails: Object.values(vendorPaymentDetails).some(Boolean) ? vendorPaymentDetails : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setState({ loading: false, errorMessage: json.error || 'Failed to submit invoice.' });
        return;
      }
      setState({
        loading: false,
        successMessage:
          'Invoice submitted successfully. Your invoice will appear in your history for this link once it is processed.',
      });
      form.reset();
      setItems([
        { id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, tax: 0 },
      ]);
      setPaymentDetails({
        bankName: '',
        accountName: '',
        accountNumber: '',
        paybillNumber: '',
        mpesaAccountNumber: '',
        tillNumber: '',
        businessName: '',
        otherDetails: '',
      });
      setPaymentType('bank');
      setUploadedFileUrl(null);
      setUploadFileName(null);
      setTotalTaxPercent(0);
    } catch {
      setState({
        loading: false,
        errorMessage: 'Network error. Please try again.',
      });
    }
  };

  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid or expired link</h1>
          <p className="text-gray-800">{linkError}</p>
        </div>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { company } = linkData;
  const companyDisplayName = company.name?.trim() ?? '';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !params?.token) return;
    setUploadingFile(true);
    setUploadedFileUrl(null);
    setUploadFileName(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/vendor-links/${params.token}/upload`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.url) {
        setUploadedFileUrl(json.url);
        setUploadFileName(file.name);
      } else {
        setState((s) => ({ ...s, errorMessage: json.error || 'Upload failed' }));
      }
    } catch {
      setState((s) => ({ ...s, errorMessage: 'Upload failed' }));
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Submit invoice</h1>
            <p className="text-gray-700 mt-1">
              {companyDisplayName ? (
                <>
                  This payable link was sent by <strong className="text-gray-900">{companyDisplayName}</strong>. Your invoice will be sent to them as a payable. Enter your invoice number and items below; we also assign an internal payable reference.
                </>
              ) : (
                <>
                  Your invoice will be sent as a payable to the account that sent you this link. Enter your invoice number and items below; we also assign an internal payable reference.
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            {state.successMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{state.successMessage}</span>
              </div>
            )}
            {state.errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{state.errorMessage}</span>
              </div>
            )}

            {/* Invoice #, Due date, Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Invoice Number *</label>
                <input
                  type="text"
                  name="invoiceNumber"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black placeholder-gray-600"
                  placeholder="e.g. INV-2026-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                name="description"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black placeholder-gray-600"
                placeholder="e.g. Monthly supplies, services"
              />
            </div>

            {/* Items table - same format as invoice create */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Invoice Items</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              {/* Desktop/tablet layout */}
              <div className="hidden md:block">
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 font-medium text-gray-800">Description</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-800 w-24">Qty</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-800 w-28">Unit Price</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-800 w-20">Tax %</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-800 w-28">Amount</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black placeholder-gray-600 text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Description"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitPrice || ''}
                              onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={item.tax || ''}
                              onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-4 font-medium text-gray-800 text-sm">
                            {currency} {(getItemAmount(item) || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile layout */}
              <div className="space-y-3 md:hidden">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black placeholder-gray-600 text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Description"
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded self-start"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice || ''}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tax %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={item.tax || ''}
                          onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-black text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-medium text-gray-600">Amount</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {currency} {(getItemAmount(item) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Tax on total (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={totalTaxPercent || ''}
                    onChange={(e) => setTotalTaxPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded bg-white text-black placeholder-gray-600 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-end">
                  <div className="text-right space-y-1 text-sm">
                    <p className="text-gray-700">
                      Subtotal: <span className="font-medium text-gray-900">{currency} {subtotal.toFixed(2)}</span>
                    </p>
                    <p className="text-gray-700">
                      Tax (items): <span className="font-medium text-gray-900">{currency} {totalItemTax.toFixed(2)}</span>
                    </p>
                    {totalTaxPercent > 0 && (
                      <p className="text-gray-700">
                        Tax on total ({totalTaxPercent}%): <span className="font-medium text-gray-900">{currency} {taxOnTotalAmount.toFixed(2)}</span>
                      </p>
                    )}
                    <p className="text-lg font-semibold text-gray-900">
                      Total: {currency} {total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Where to send payment - vendor enters their details */}
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Where to send payment
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Enter the details where you want to receive payment (optional but recommended).
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment method</label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentType"
                        checked={paymentType === 'bank'}
                        onChange={() => setPaymentType('bank')}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-800">Bank transfer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentType"
                        checked={paymentType === 'mpesa'}
                        onChange={() => setPaymentType('mpesa')}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-800">M-Pesa</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentType"
                        checked={paymentType === 'other'}
                        onChange={() => setPaymentType('other')}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-800">Other</span>
                    </label>
                  </div>
                </div>
                {paymentType === 'bank' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700">Bank name</label>
                          <div className="relative">
                            <select
                              value={paymentDetails.bankCountryCode || 'KE'}
                              onChange={(e) =>
                                setPaymentDetails((p) => ({ ...p, bankCountryCode: e.target.value }))
                              }
                              className="text-xs bg-white text-black border border-gray-300 rounded outline-none cursor-pointer pr-4 appearance-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="GH">Ghana</option>
                              <option value="KE">Kenya</option>
                              <option value="NG">Nigeria</option>
                              <option value="AE">UAE</option>
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-700 pointer-events-none" />
                          </div>
                        </div>
                        <BankSelector
                          countryCode={paymentDetails.bankCountryCode || 'KE'}
                          value={paymentDetails.bankName}
                          onBankSelectAction={(bank: Bank | null) => {
                            if (bank) {
                              setPaymentDetails((p) => ({
                                ...p,
                                bankName: bank.name,
                                swiftCode: bank.swift_code || '',
                              }));
                            }
                          }}
                          onInputChangeAction={(value) =>
                            setPaymentDetails((p) => ({ ...p, bankName: value }))
                          }
                          placeholder="Search for a bank or type custom bank name..."
                          allowCustom={true}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT code</label>
                        <input
                          type="text"
                          value={paymentDetails.swiftCode}
                          onChange={(e) =>
                            setPaymentDetails((p) => ({ ...p, swiftCode: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder-gray-600"
                          placeholder="SWIFT/BIC"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account name</label>
                        <input
                          type="text"
                          value={paymentDetails.accountName}
                          onChange={(e) =>
                            setPaymentDetails((p) => ({ ...p, accountName: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                          placeholder="Account holder name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
                        <input
                          type="text"
                          value={paymentDetails.accountNumber}
                          onChange={(e) =>
                            setPaymentDetails((p) => ({ ...p, accountNumber: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                          placeholder="Account number"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {paymentType === 'mpesa' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paybill number</label>
                      <input
                        type="text"
                        value={paymentDetails.paybillNumber}
                        onChange={(e) => setPaymentDetails((p) => ({ ...p, paybillNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        placeholder="e.g. 123456"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
                      <input
                        type="text"
                        value={paymentDetails.mpesaAccountNumber}
                        onChange={(e) => setPaymentDetails((p) => ({ ...p, mpesaAccountNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        placeholder="Account / reference"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Till number (if Till)</label>
                      <input
                        type="text"
                        value={paymentDetails.tillNumber}
                        onChange={(e) => setPaymentDetails((p) => ({ ...p, tillNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        placeholder="Till number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business name (if Till)</label>
                      <input
                        type="text"
                        value={paymentDetails.businessName}
                        onChange={(e) => setPaymentDetails((p) => ({ ...p, businessName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        placeholder="Business name"
                      />
                    </div>
                  </div>
                )}
                {paymentType === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment details</label>
                    <textarea
                      value={paymentDetails.otherDetails}
                      onChange={(e) => setPaymentDetails((p) => ({ ...p, otherDetails: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-black"
                      placeholder="e.g. Mobile money number, crypto address, or other instructions"
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice document (optional)</label>
              <p className="text-xs text-gray-700 mb-2">Upload a PDF, image, or Word document to attach to this payable.</p>
              {!uploadedFileUrl ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,image/*,.doc,.docx"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={state.loading || uploadingFile}
                  />
                  {uploadingFile ? (
                    <Loader2 className="h-8 w-8 text-gray-600 animate-spin mb-1" />
                  ) : (
                    <Upload className="h-8 w-8 text-gray-600 mb-1" />
                  )}
                  <span className="text-sm text-gray-700">
                    {uploadingFile ? 'Uploading…' : 'Click to upload'}
                  </span>
                </label>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <span className="text-sm text-gray-800 truncate flex-1">{uploadFileName || 'Document'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileUrl(null);
                      setUploadFileName(null);
                    }}
                    className="p-1 text-gray-600 hover:text-red-600 rounded"
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note to accounting team (optional)</label>
              <textarea
                name="note"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black placeholder-gray-600"
                placeholder="PO number, contact person, etc."
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={state.loading}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {state.loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit Invoice'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Logo + Secured by Chains ERP */}
        <div className="flex flex-col items-center justify-center pt-8 pb-4">
          <Link href="/" className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
            <Image
              src="/chains.svg"
              alt="Chains ERP"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-xs font-medium text-gray-700">Secured by Chains ERP</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
