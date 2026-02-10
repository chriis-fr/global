'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, MessageCircle, ChevronDown } from 'lucide-react';
import { getRecentInvoices, RecentInvoice } from '@/lib/actions/dashboard';
import CurrencyAmount from '@/components/CurrencyAmount';

interface RecentInvoicesProps {
  className?: string;
}

const CACHE_KEY = 'recent_invoices';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes – show cached data immediately when navigating back

function readCache(): { data: RecentInvoice[]; valid: boolean } {
  if (typeof window === 'undefined') return { data: [], valid: false };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: [], valid: false };
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed?.data) ? (parsed.data as RecentInvoice[]) : [];
    const valid = (Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION;
    return { data, valid };
  } catch {
    return { data: [], valid: false };
  }
}

export default function RecentInvoices({ className = '' }: RecentInvoicesProps) {
  const [state, setState] = useState<{ invoices: RecentInvoice[]; loading: boolean; error: string | null }>(() => {
    const { data, valid } = readCache();
    return { invoices: data, loading: !valid, error: null };
  });
  const { invoices, loading, error } = state;
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const hasFetchedRef = useRef(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const isOnDashboardPage = pathname === '/dashboard';

  const retry = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    setState(prev => ({ ...prev, error: null, loading: true }));
    setRetryTrigger(t => t + 1);
  };

  useEffect(() => {
    if (!isOnDashboardPage) return;

    const load = async (background: boolean) => {
      try {
        if (!background) setState(prev => ({ ...prev, loading: true, error: null }));
        const result = await getRecentInvoices(5);
        if (result.success && result.data) {
          setState(prev => ({ ...prev, invoices: result.data ?? [], loading: false, error: null }));
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data ?? [], timestamp: Date.now() }));
          } catch {}
        } else {
          try {
            localStorage.removeItem(CACHE_KEY);
          } catch {}
          if (!background) setState(prev => ({ ...prev, error: result.error || 'Failed to load recent invoices', loading: false }));
        }
      } catch {
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {}
        if (!background) setState(prev => ({ ...prev, error: 'Failed to load recent invoices', loading: false }));
      } finally {
        if (!background) setState(prev => ({ ...prev, loading: false }));
      }
    };

    const isRetry = retryTrigger > 0;
    if (!hasFetchedRef.current || isRetry) {
      if (!isRetry) hasFetchedRef.current = true;
      const { valid } = readCache();
      load(isRetry ? false : valid);
    }
  }, [isOnDashboardPage, retryTrigger]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'sent':
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-400" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'draft':
        return <FileText className="h-4 w-4 text-gray-400" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400';
      case 'sent':
      case 'pending':
        return 'text-orange-400';
      case 'overdue':
        return 'text-red-400';
      case 'draft':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
          </div>
          <div className="flex items-center gap-3">
            <ChevronDown className="h-5 w-5 text-white/70 md:hidden" />
          </div>
        </div>
        {/* Loading skeleton - hidden on mobile when collapsed, visible on desktop */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out md:max-h-none md:opacity-100 ${
          !isExpanded ? 'max-h-0 opacity-0 md:max-h-none md:opacity-100' : 'max-h-[2000px] opacity-100'
        }`}>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="h-4 w-4 bg-white/20 rounded"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-white/20 rounded"></div>
                    <div className="h-3 w-24 bg-white/20 rounded"></div>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="h-4 w-16 bg-white/20 rounded"></div>
                  <div className="h-3 w-12 bg-white/20 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
          </div>
          <div className="flex items-center gap-3">
            <ChevronDown className="h-5 w-5 text-white/70 md:hidden" />
          </div>
        </div>
        {/* Error message - hidden on mobile when collapsed, visible on desktop */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out md:max-h-none md:opacity-100 ${
          !isExpanded ? 'max-h-0 opacity-0 md:max-h-none md:opacity-100' : 'max-h-[2000px] opacity-100'
        }`}>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Failed to load invoices</span>
            </div>
            <p className="text-red-300 text-sm mt-2">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-6 p-3 ${className}`}>
      {/* Header - Clickable on mobile to expand/collapse */}
      <div 
        className="flex items-center justify-between mb-6 cursor-pointer md:cursor-default select-none"
        onClick={(e) => {
          // Only toggle on mobile (below lg breakpoint)
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            e.preventDefault();
            e.stopPropagation();
            // Preserve scroll position from the main scroll container
            const mainContent = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement;
            const scrollY = mainContent?.scrollTop || window.scrollY;
            setIsExpanded(!isExpanded);
            // Restore scroll position after state update
            requestAnimationFrame(() => {
              if (mainContent) {
                mainContent.scrollTop = scrollY;
              } else {
                window.scrollTo(0, scrollY);
              }
            });
          }
        }}
      >
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* View All button - hidden on mobile when collapsed, always visible on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push('/dashboard/services/smart-invoicing/invoices');
            }}
            className={`text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors ${
              !isExpanded ? 'hidden md:block' : 'block'
            }`}
          >
            View All
          </button>
          {/* Chevron - only visible on mobile */}
          <ChevronDown 
            className={`h-5 w-5 text-white/70 transition-transform duration-200 md:hidden ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Content - Collapsible on mobile, always visible on desktop */}
      <div 
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ease-in-out md:max-h-none md:opacity-100 ${
          !isExpanded ? 'max-h-0 opacity-0 md:max-h-none md:opacity-100' : 'max-h-[2000px] opacity-100'
        }`}
        style={{
          transitionProperty: 'max-height, opacity',
        }}
      >
        <div className="md:block">
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No invoices yet</p>
              <p className="text-gray-500 text-sm">Create your first invoice to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id}`)}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(invoice.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                        {/* WhatsApp indicator */}
                        {invoice.sentVia === 'whatsapp' && (
                          <MessageCircle className="h-4 w-4 text-green-400 flex-shrink-0"  />
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{invoice.clientName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      <CurrencyAmount 
                        amount={invoice.total} 
                        currency={invoice.currency || 'USD'}
                      />
                    </p>
                    <p className={`text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
