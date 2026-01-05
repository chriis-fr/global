'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, MessageCircle, CheckCircle } from 'lucide-react';
import { getInvoicesListMinimal } from '@/lib/actions/invoices';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface RecentInvoicesListProps {
  className?: string;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

export default function RecentInvoicesList({ className = '' }: RecentInvoicesListProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const hasInitialized = useRef(false);

  useEffect(() => {
    const loadInvoices = async () => {
      // Check localStorage cache first
      const cacheKey = 'smart_invoicing_recent_invoices';
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
        
        const result = await getInvoicesListMinimal(1, 5);
        
        if (result.success && result.data) {
          setInvoices(result.data.invoices || []);
          
          // Cache in localStorage
          const cacheData = {
            data: result.data.invoices || [],
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          setError(result.error || 'Failed to load invoices');
        }
      } catch {
        setError('Failed to load invoices');
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadInvoices();
    }
  }, []);

  const filteredInvoices = searchTerm
    ? invoices.filter(invoice => 
        invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientDetails?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientDetails?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientDetails?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientDetails?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.status?.toLowerCase().includes(searchTerm.toLowerCase())
      )
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
        {filteredInvoices.slice(0, 5).map((invoice, index) => (
          <motion.div
            key={invoice._id?.toString() || index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + index * 0.1 }}
            className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-h-[60px]"
            onClick={() => {
              if (invoice.status === 'draft') {
                router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`);
              } else {
                router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id}`);
              }
            }}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-white font-medium text-sm sm:text-base truncate">{invoice.invoiceNumber || 'Invoice'}</p>
                  {/* WhatsApp indicator */}
                  {invoice.sentVia === 'whatsapp' && (
                    <MessageCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  )}
                  {/* Approval indicator */}
                  {(invoice.status === 'approved' || invoice.status === 'sent') && invoice.organizationId && invoice.recipientType === 'organization' && (
                    <div className="relative group">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Approved
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-blue-200 text-xs sm:text-sm truncate">
                  {invoice.clientDetails?.companyName || 
                   [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 
                   invoice.clientDetails?.email || 'Client'}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-white font-semibold text-sm sm:text-base">
                <FormattedNumberDisplay value={invoice.totalAmount || invoice.total || 0} />
              </p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                invoice.status === 'sent' || invoice.status === 'pending' || invoice.status === 'approved' ? 'bg-yellow-100 text-yellow-800' :
                invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {invoice.status === 'sent' || invoice.status === 'approved' ? 'pending' : invoice.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

