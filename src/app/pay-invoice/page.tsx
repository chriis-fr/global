'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Wallet,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getExplorerUrl } from '@/lib/utils/blockchain';
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
    address?: string | { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
    logo?: string;
    taxNumber?: string;
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
  txHash?: string;
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
  withholdingTaxAmount?: number;
  withholdingTaxRatePercent?: number;
  memo?: string;
  status: string;
  paidAt?: string;
  updatedAt?: string;
}

interface TokenData {
  token: string;
  invoice: Invoice;
  recipientEmail: string;
  isRegistered: boolean;
  requiresSignup: boolean;
}

function formatCountry(addr: Invoice['companyDetails']['address']): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return addr.country ?? [addr.city, addr.state].filter(Boolean).join(', ') ?? '';
}

function PayInvoiceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

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

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
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
  const companyCountry = formatCountry(invoice?.companyDetails?.address);
  const cur = invoice?.currency ?? '';
  const fmt = (n: number) => `${cur} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="min-h-screen crossBg flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen crossBg flex items-center justify-center overflow-hidden p-4">
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
    <div className="min-h-screen crossBg flex flex-col items-center justify-center overflow-hidden p-4">
      {/* Single card – wider so From/To sit side by side */}
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden flex flex-col max-h-[94vh]">
        {/* Card body – scroll only inside card if needed */}
        <div className="overflow-y-auto flex-1 min-h-0 p-5 sm:p-6 space-y-4">
          {/* Invoice No */}
          <div className="flex justify-between border-b py-2 border-gray-200 items-center">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice No</span>
            <span className="font-semibold text-gray-900">{invoice?.invoiceNumber ?? '—'}</span>
          </div>

          {/* From / To side by side */}
          <div className="grid grid-cols-2 gap-4 ">
            {/* From */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">From</p>
              <div className="flex gap-2">
                {invoice?.companyDetails?.logo ? (
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    <NextImage src={invoice.companyDetails.logo} alt="" width={36} height={36} className="object-contain w-full h-full" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">
                      {(invoice?.companyDetails?.name ?? 'C').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate text-sm">{invoice?.companyDetails?.name ?? '—'}</p>
                  {invoice?.companyDetails?.email && (
                    <p className="text-xs text-gray-600 truncate">{invoice.companyDetails.email}</p>
                  )}
                  {companyCountry && (
                    <p className="text-xs text-gray-500 truncate">{companyCountry}</p>
                  )}
                  {invoice?.companyDetails?.taxNumber && (
                    <p className="text-xs text-gray-500 mt-0.5">Tax ID: {invoice.companyDetails.taxNumber}</p>
                  )}
                </div>
              </div>
            </div>
            {/* To */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">To</p>
              <p className="font-semibold text-gray-900 text-sm truncate">
                {invoice?.clientDetails?.companyName || invoice?.clientDetails?.name || data.recipientEmail || '—'}
              </p>
              {invoice?.clientDetails?.email && (
                <p className="text-xs text-gray-600 truncate">{invoice.clientDetails.email}</p>
              )}
            </div>
          </div>

          {/* Amount + View breakdown */}
          <div className="pt-2 pb-2 border-t border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {fmt(amount)}
                </p>
              </div>
              {invoice?.items?.length ? (
                <button
                  type="button"
                  onClick={() => setBreakdownOpen((o) => !o)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View breakdown
                  {breakdownOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
            {isPaid && invoice?.txHash && (() => {
              const explorerUrl = getExplorerUrl(invoice.txHash, invoice.chainId);
              if (!explorerUrl) return null;
              return (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                >
                  View transaction
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              );
            })()}
          </div>

          {/* Collapsible breakdown – Description | Amount, Subtotal, Tax, Total due */}
          {breakdownOpen && invoice?.items?.length ? (
            <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Description</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2.5 px-3 text-gray-900">{item.description || 'Item'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-medium text-gray-900">{fmt(item.amount)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {fmt(item.unitPrice ?? 0)} × {item.quantity}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 space-y-1 border-t border-gray-200 bg-white/50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{fmt(invoice.subtotal ?? 0)}</span>
                </div>
                {Number(invoice.totalTax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium text-gray-900">{fmt(invoice.totalTax ?? 0)}</span>
                  </div>
                )}
                {(invoice.withholdingTaxAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Withholding{invoice.withholdingTaxRatePercent != null ? ` (${invoice.withholdingTaxRatePercent}%)` : ''}
                    </span>
                    <span className="font-medium text-red-600">-{fmt(invoice.withholdingTaxAmount ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                  <span className="text-gray-900">Total due</span>
                  <span className="text-gray-900">{fmt(amount)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Due / Paid */}
          <div className="flex flex-wrap gap-4 text-sm">
            {invoice?.dueDate && (
              <div>
                <span className="text-gray-500">Due </span>
                <span className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</span>
              </div>
            )}
            {isPaid && (invoice?.paidAt || invoice?.updatedAt) && (
              <div>
                <span className="text-gray-500">Paid </span>
                <span className="font-medium text-green-700">
                  {formatDate((invoice.paidAt ?? invoice.updatedAt) ?? '')}
                </span>
              </div>
            )}
          </div>

          {/* Status badge */}
          <div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPaid ? 'Paid' : 'Pending payment'}
            </span>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment method</p>
            {isPaid ? (
              <p className="text-gray-600 text-sm">This invoice has been paid.</p>
            ) : isCrypto ? (
              <div className="space-y-3">
                {invoice?.paymentNetwork && (
                  <p className="text-sm text-gray-600">Network: {invoice.paymentNetwork}</p>
                )}
                {payAddress && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs bg-gray-100 px-2 py-1.5 rounded break-all font-mono">
                      {payAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payAddress, 'address')}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50"
                      title="Copy"
                    >
                      {copied === 'address' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                    </button>
                  </div>
                )}
                <Link
                  href={`/safe/pay?token=${token}&invoiceId=${invoice?._id}`}
                  className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <Wallet className="h-5 w-5" />
                  Choose your payment method
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            ) : isFiat ? (
              <div className="space-y-2">
                {(bankName || accountNumber) ? (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Bank</p>
                      <p className="text-sm text-gray-900">{bankName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Account number</p>
                      {accountNumber ? (
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1.5 rounded font-mono">{accountNumber}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(accountNumber, 'account')}
                            className="p-1.5 rounded border border-gray-200 hover:bg-gray-50"
                            title="Copy"
                          >
                            {copied === 'account' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not provided — contact {invoice?.companyDetails?.name ?? 'issuer'} for account details.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    Contact {invoice?.companyDetails?.name} at {invoice?.companyDetails?.email || 'the provided contact'} for payment instructions.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Contact the sender for payment instructions.</p>
            )}
          </div>

          {/* Constant link: view invoice inside the app (sign in or sign up) */}
          <p className="text-center text-sm text-gray-500 pt-2 border-t border-gray-100">
            <Link
              href={`/auth?invoiceToken=${token}&email=${encodeURIComponent(data.recipientEmail)}`}
              className="text-blue-600 hover:underline font-medium"
            >
              View this invoice in the app
            </Link>
            {' '}— sign in or create an account
          </p>
        </div>

        {/* Footer – Powered by */}
        {/* <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50/50 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <Link href="/" className="font-medium text-gray-700 hover:text-blue-600">
              Chains ERP
            </Link>
          </p>
        </div> */}
      </div>

      <p className="text-xs text-gray-500 p-10">
            Powered by{' '}
            <Link href="/" className=" text-gray-600 font-bold hover:text-blue-600">
              Chains-ERP
            </Link>
          </p>
    </div>
  );
}

export default function PayInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center overflow-hidden">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        </div>
      }
    >
      <PayInvoiceContent />
    </Suspense>
  );
}
