'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Wallet,
  CreditCard,
  ExternalLink
} from 'lucide-react';
import NextImage from 'next/image';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceName?: string;
  issueDate: string;
  dueDate: string;
  companyDetails: {
    name: string;
    email?: string;
    phone?: string;
  };
  clientDetails: {
    name?: string;
    companyName?: string;
    email?: string;
  };
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  payeeAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  chainId?: number;
  tokenAddress?: string;
  paymentSettings?: {
    method?: string;
    chainId?: number;
    tokenAddress?: string;
    walletAddress?: string;
    cryptoNetwork?: string;
    bankAccount?: { bankName?: string; accountNumber?: string; routingNumber?: string };
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    discount?: number;
    tax?: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  total?: number;
  memo?: string;
  status: string;
}

interface TokenData {
  token: string;
  invoice: Invoice;
  recipientEmail: string;
  isRegistered: boolean;
  requiresSignup: boolean;
}

function PayInvoiceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const invoice = data?.invoice;
  const amount = invoice?.total ?? invoice?.totalAmount ?? 0;
  const isPaid = invoice?.status === 'paid';
  const isCrypto = invoice?.paymentMethod === 'crypto';
  const isFiat = invoice?.paymentMethod === 'fiat';

  const validateToken = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/invoice-access/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || 'Invalid or expired link');
    } catch {
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) validateToken();
    else {
      setError('Missing payment link token');
      setLoading(false);
    }
  }, [token, validateToken]);

  // Ensure page can scroll: clear leftover overflow and allow wheel/touch scroll
  useEffect(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.documentElement.style.touchAction = '';
    return () => {};
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  const payAddress = invoice?.paymentAddress ?? invoice?.payeeAddress ?? invoice?.paymentSettings?.walletAddress;
  const bankName = invoice?.bankName ?? invoice?.paymentSettings?.bankAccount?.bankName;
  const accountNumber = invoice?.accountNumber ?? invoice?.paymentSettings?.bankAccount?.accountNumber;
  const routingNumber = invoice?.routingNumber ?? invoice?.paymentSettings?.bankAccount?.routingNumber;

  if (loading) {
    return (
      <div className="min-h-screen crossBg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen crossBg h-screen overflow-y-auto flex items-center justify-center p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or expired link</h1>
          <p className="text-gray-600 mb-6">{error || 'This payment link is invalid or has expired.'}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen crossBg h-screen overflow-y-auto overflow-x-hidden overscroll-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white rounded-lg border border-gray-200 flex-shrink-0">
              <NextImage src="/chainsnobg.png" alt="Chains ERP" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pay Invoice</h1>
              <p className="text-gray-600">
                {invoice?.companyDetails?.name} · Invoice #{invoice?.invoiceNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isPaid ? 'Paid' : 'Pending payment'}
          </span>
          {data.isRegistered && (
            <Link
              href={`/auth?invoiceToken=${token}&email=${encodeURIComponent(data.recipientEmail)}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Sign in to track
            </Link>
          )}
        </div>

        {/* Amount card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Amount due</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {invoice?.currency} {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {invoice?.dueDate && (
            <p className="mt-2 text-sm text-gray-600">Due by {formatDate(invoice.dueDate)}</p>
          )}
        </div>

        {/* From / To */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">From</p>
            <p className="font-semibold text-gray-900">{invoice?.companyDetails?.name}</p>
            {invoice?.companyDetails?.email && (
              <p className="text-sm text-gray-600">{invoice.companyDetails.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bill to</p>
            <p className="font-semibold text-gray-900">
              {invoice?.clientDetails?.companyName || invoice?.clientDetails?.name || data.recipientEmail}
            </p>
            {invoice?.clientDetails?.email && (
              <p className="text-sm text-gray-600">{invoice.clientDetails.email}</p>
            )}
          </div>
        </div>

        {/* Line items */}
        {invoice?.items?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Items</h2>
            </div>
            <ul className="divide-y divide-gray-200">
              {invoice.items.map((item, i) => (
                <li key={i} className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.description} × {item.quantity}
                  </span>
                  <span className="font-medium text-gray-900">
                    {invoice.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>{invoice.currency} {Number(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {Number(invoice.totalTax) > 0 && (
              <div className="px-4 py-2 bg-gray-50 flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span>{invoice.currency} {Number(invoice.totalTax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Payment details – highly dependent on payment method */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {isCrypto ? <Wallet className="h-5 w-5" /> : isFiat ? <CreditCard className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
            Payment details
          </h2>

          {isPaid ? (
            <p className="text-gray-600">This invoice has been paid.</p>
          ) : isCrypto ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Send the amount in the specified token/network to the address below. Use invoice number as reference if needed.
              </p>
              {invoice?.paymentNetwork && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Network</p>
                  <p className="font-mono text-gray-900">{invoice.paymentNetwork}</p>
                </div>
              )}
              {payAddress && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Wallet address</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 min-w-0 text-sm bg-gray-100 px-3 py-2 rounded-lg break-all font-mono">
                      {payAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payAddress, 'address')}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      title="Copy address"
                    >
                      {copied === 'address' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-sm font-semibold text-gray-900">
                Amount: {invoice.currency} {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <Link
                href={`/safe/pay?token=${token}&invoiceId=${invoice?._id}`}
                className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Wallet className="h-5 w-5" />
                Connect wallet to pay
                <ExternalLink className="h-4 w-4" />
              </Link>
              <p className="text-xs text-gray-500">
                You can also send payment from any wallet using the details above.
              </p>
            </div>
          ) : isFiat ? (
            <div className="space-y-4">
              {bankName || accountNumber ? (
                <>
                  <p className="text-sm text-gray-600">
                    Pay by bank transfer using the details below. Use invoice number <strong>{invoice?.invoiceNumber}</strong> as reference.
                  </p>
                  {bankName && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bank name</p>
                      <p className="font-medium text-gray-900">{bankName}</p>
                    </div>
                  )}
                  {accountNumber && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Account number</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-3 py-2 rounded-lg font-mono">{accountNumber}</code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(accountNumber, 'account')}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          {copied === 'account' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {routingNumber && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Routing number</p>
                      <p className="font-mono text-gray-900">{routingNumber}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</p>
                    <p className="font-mono text-gray-900">{invoice?.invoiceNumber}</p>
                  </div>
                </>
              ) : (
                <p className="text-gray-600">
                  Fiat payment details are not set for this invoice. Please contact {invoice?.companyDetails?.name} at {invoice?.companyDetails?.email || 'the provided contact'} for payment instructions.
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-600">No payment method specified. Contact the sender for instructions.</p>
          )}
        </div>

        {/* Optional: Create account */}
        {!data.isRegistered && (
          <div className="text-center py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Want to track invoices and get paid faster?</p>
            <Link
              href={`/auth?invoiceToken=${token}&email=${encodeURIComponent(data.recipientEmail)}`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Create free account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PayInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        </div>
      }
    >
      <PayInvoiceContent />
    </Suspense>
  );
}
