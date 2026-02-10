'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, MessageCircle, CheckCircle } from 'lucide-react';
import { getRecentInvoicesOnly } from '@/lib/actions/invoices';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface RecentInvoicesListProps {
  className?: string;
}

const CACHE_KEY = 'smart_invoicing_recent_invoices';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes – use cache when navigating back

function readCache(): { data: Array<Record<string, unknown>>; valid: boolean } {
  if (typeof window === 'undefined') return { data: [], valid: false };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: [], valid: false };
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed?.data) ? (parsed.data as Array<Record<string, unknown>>) : [];
    const valid = (Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION;
    return { data, valid };
  } catch {
    return { data: [], valid: false };
  }
}

export default function RecentInvoicesList({ className = '' }: RecentInvoicesListProps) {
  const router = useRouter();
  const [state, setState] = useState<{ invoices: Array<Record<string, unknown>>; loading: boolean; error: string | null }>(() => {
    const { data, valid } = readCache();
    return { invoices: data, loading: !valid, error: null };
  });
  const { invoices, loading, error } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const hasFetchedRef = useRef(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const retry = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    setState(prev => ({ ...prev, error: null, loading: true }));
    setRetryTrigger(t => t + 1);
  };

  useEffect(() => {
    const loadInvoices = async (backgroundRevalidate: boolean) => {
      try {
        if (!backgroundRevalidate) setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await getRecentInvoicesOnly(5);
        if (result.success && result.data) {
          const list = (result.data.invoices || []) as unknown as Array<Record<string, unknown>>;
          setState(prev => ({ ...prev, invoices: list, loading: false, error: null }));
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: list, timestamp: Date.now() }));
          } catch {}
        } else {
          try {
            localStorage.removeItem(CACHE_KEY);
          } catch {}
          if (!backgroundRevalidate) setState(prev => ({ ...prev, error: result.error || 'Failed to load invoices', loading: false }));
        }
      } catch {
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {}
        if (!backgroundRevalidate) setState(prev => ({ ...prev, error: 'Failed to load invoices', loading: false }));
      } finally {
        if (!backgroundRevalidate) setState(prev => ({ ...prev, loading: false }));
      }
    };

    const isRetry = retryTrigger > 0;
    if (!hasFetchedRef.current || isRetry) {
      if (!isRetry) hasFetchedRef.current = true;
      const { valid } = readCache();
      loadInvoices(isRetry ? false : valid);
    }
  }, [retryTrigger]);

  const filteredInvoices = searchTerm
    ? invoices.filter(invoice => {
        const inv = invoice as Record<string, unknown>;
        const invoiceNumber = typeof inv.invoiceNumber === 'string' ? inv.invoiceNumber : '';
        const clientDetails = inv.clientDetails as Record<string, unknown> | undefined;
        const companyName = typeof clientDetails?.companyName === 'string' ? clientDetails.companyName : '';
        const firstName = typeof clientDetails?.firstName === 'string' ? clientDetails.firstName : '';
        const lastName = typeof clientDetails?.lastName === 'string' ? clientDetails.lastName : '';
        return invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof clientDetails?.email === 'string' ? clientDetails.email : '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof inv.status === 'string' ? inv.status : '').toLowerCase().includes(searchTerm.toLowerCase());
      })
    : invoices;

  if (loading) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 ${className}`}>
        <div className="h-6 w-32 bg-white/20 rounded mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 ${className}`}>
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Recent Invoices</h3>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-12 text-center ${className}`}>
        <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No invoices yet</h3>
        <p className="text-blue-200 mb-6 text-sm sm:text-base">
          Create your first invoice to get started with our comprehensive invoicing system.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-white">Recent Invoices</h3>
        <button
          onClick={() => router.push('/dashboard/services/smart-invoicing/invoices')}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          View All
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by invoice number, client, or status..."
            value={searchTerm}
            className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {filteredInvoices.slice(0, 5).map((invoice, index) => {
          const inv = invoice as Record<string, unknown>;
          const invoiceId = inv._id?.toString() || String(index);
          const status = typeof inv.status === 'string' ? inv.status : '';
          const invoiceNumber = typeof inv.invoiceNumber === 'string' ? inv.invoiceNumber : 'Invoice';
          const clientDetails = inv.clientDetails as Record<string, unknown> | undefined;
          const companyName = typeof clientDetails?.companyName === 'string' ? clientDetails.companyName : '';
          const firstName = typeof clientDetails?.firstName === 'string' ? clientDetails.firstName : '';
          const lastName = typeof clientDetails?.lastName === 'string' ? clientDetails.lastName : '';
          const email = typeof clientDetails?.email === 'string' ? clientDetails.email : '';
          const totalAmount = typeof inv.totalAmount === 'number' ? inv.totalAmount : (typeof inv.total === 'number' ? inv.total : 0);
          const sentVia = typeof inv.sentVia === 'string' ? inv.sentVia : '';
          const organizationId = inv.organizationId;
          const recipientType = typeof inv.recipientType === 'string' ? inv.recipientType : '';
          return (
              <motion.div
                key={invoiceId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-h-[60px]"
                onClick={() => {
                  if (status === 'draft') {
                    router.push(`/dashboard/services/smart-invoicing/create?id=${invoiceId}`);
                  } else {
                    router.push(`/dashboard/services/smart-invoicing/invoices/${invoiceId}`);
                  }
                }}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-white font-medium text-sm sm:text-base truncate">{invoiceNumber}</p>
                      {/* WhatsApp indicator */}
                      {sentVia === 'whatsapp' && (
                        <MessageCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      )}
                      {/* Approval indicator */}
                      {(status === 'approved' || status === 'sent') && !!organizationId && recipientType === 'organization' && (
                        <div className="relative group">
                          <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Approved
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-blue-200 text-xs sm:text-sm truncate">
                      {companyName || [firstName, lastName].filter(Boolean).join(' ') || email || 'Client'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-white font-semibold text-sm sm:text-base">
                    <FormattedNumberDisplay value={totalAmount} />
                  </p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    status === 'paid' ? 'bg-green-100 text-green-800' :
                    status === 'sent' || status === 'pending' || status === 'approved' ? 'bg-yellow-100 text-yellow-800' :
                    status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {status === 'sent' || status === 'approved' ? 'pending' : status}
                  </span>
                </div>
              </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

