'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, FileText, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';

interface VendorHistoryPayable {
  id: string;
  payableNumber: string;
  invoiceNumber: string;
  description: string;
  currency: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  dueDate: string | null;
  invoiceFileUrl: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  hasPaymentProof: boolean;
}

interface VendorHistoryResponse {
  vendor: { name: string; email: string };
  company: {
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
  payables: VendorHistoryPayable[];
}

function formatDate(value: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatAmount(cur: string, value: number) {
  const n = Number(value || 0);
  return `${cur} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function VendorPayablesHistoryPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<VendorHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params?.token;
    if (!token) {
      setError('Missing vendor link token.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/vendor-links/${token}/history`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setError(json.error || 'Failed to load history.');
          return;
        }
        setData(json.data as VendorHistoryResponse);
      } catch {
        if (!cancelled) setError('Failed to load history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params?.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-700">Loading your invoices…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Unable to load invoices</h1>
          <p className="text-sm text-gray-700 mb-4">{error || 'This vendor link may be invalid or inactive.'}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  const { vendor, company, payables } = data;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-200 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                {vendor.name || 'Your invoices'}
              </h1>
              {company?.name && (
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Invoices sent to <span className="font-medium text-gray-900">{company.name}</span>
                </p>
              )}
            </div>
            <Link
              href={`/vendor/payables/submit/${params?.token ?? ''}`}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              New invoice
            </Link>
          </div>

          {payables.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-gray-900 mb-1">No invoices yet</h2>
              <p className="text-sm text-gray-600 mb-4">
                When you submit invoices using your link, they will appear here with their status.
              </p>
              <Link
                href={`/vendor/payables/submit/${params?.token ?? ''}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Create invoice
              </Link>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-3">
              {payables.map((p) => {
                const cur = p.currency || '';
                const createdLabel = formatDate(p.createdAt);
                const dueLabel = formatDate(p.dueDate);
                const paidLabel = formatDate(p.paymentDate);
                const isPaid = p.status === 'paid' || p.paymentStatus === 'completed';
                const isOverdue = !isPaid && !!p.dueDate && new Date(p.dueDate) < new Date();

                return (
                  <div
                    key={p.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 sm:px-4 sm:py-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {p.invoiceNumber || p.payableNumber || 'Invoice'}
                          </span>
                        </div>
                        {p.description && (
                          <p className="text-sm text-gray-800 mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          Created {createdLabel}
                          {dueLabel && (
                            <>
                              {' · '}
                              Due {dueLabel}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatAmount(cur, p.total)}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Paid
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              <Clock className="h-3 w-3" />
                              Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <Clock className="h-3 w-3" />
                              {p.status || 'Submitted'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 pt-1 border-t border-gray-200 mt-2">
                      <div className="flex items-center gap-2">
                        {p.invoiceFileUrl && (
                          <a
                            href={p.invoiceFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <FileText className="h-3 w-3" />
                            Uploaded invoice
                          </a>
                        )}
                        {isPaid && paidLabel && (
                          <span className="text-gray-600">Paid on {paidLabel}</span>
                        )}
                      </div>
                      {p.hasPaymentProof && (
                        <span className="text-xs font-medium text-emerald-700">
                          Proof of payment available with the payer
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

