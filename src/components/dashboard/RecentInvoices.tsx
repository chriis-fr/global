'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle, MessageCircle } from 'lucide-react';
import { getRecentInvoices, RecentInvoice } from '@/lib/actions/dashboard';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import CurrencyAmount from '@/components/CurrencyAmount';

interface RecentInvoicesProps {
  className?: string;
}

export default function RecentInvoices({ className = '' }: RecentInvoicesProps) {
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hasInitialized = useRef(false);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for recent data

  useEffect(() => {
    const loadRecentInvoices = async () => {
      // Check localStorage cache first
      const cacheKey = 'recent_invoices';
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 2 minutes old
          if ((now - parsed.timestamp) < CACHE_DURATION) {
            setInvoices(parsed.data);
            setLoading(false);
            return;
          }
        } catch {
          // If cache is corrupted, remove it and fetch fresh
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        setLoading(true);
        setError(null);
        
        const result = await getRecentInvoices(5);
        
        if (result.success && result.data) {
          setInvoices(result.data);
          
          // Cache in localStorage
          const cacheData = {
            data: result.data,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          setError(result.error || 'Failed to load recent invoices');
        }
      } catch {
        console.error('Error loading recent invoices');
        setError('Failed to load recent invoices');
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadRecentInvoices();
    }
  }, [CACHE_DURATION]);

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
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        </div>
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
    );
  }

  if (error) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Failed to load invoices</span>
          </div>
          <p className="text-red-300 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        </div>
        <button
          onClick={() => router.push('/dashboard/services/smart-invoicing/invoices')}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          View All
        </button>
      </div>

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
  );
}
