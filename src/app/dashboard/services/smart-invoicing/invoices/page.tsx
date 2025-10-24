'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Plus, 
  Search, 
  Eye,
  Edit3,
  Trash2,
  Loader2,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  Download,
  ArrowLeft,
  CheckCircle,
  MessageCircle
} from 'lucide-react';
import CurrencyAmount from '@/components/CurrencyAmount';
import FloatingActionButton from '@/components/dashboard/FloatingActionButton';
import PendingInvoiceApprovals from '@/components/dashboard/PendingInvoiceApprovals';
import { getInvoicesListMinimal, getFullInvoicesForExport, InvoiceDetails } from '@/lib/actions/invoices';

export default function InvoicesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<InvoiceDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'pending_approval' | 'rejected'>('all');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [statusCounts, setStatusCounts] = useState({
    draft: 0,
    sent: 0,
    pending: 0,
    pending_approval: 0,
    rejected: 0,
    paid: 0,
    overdue: 0
  });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadCriteria, setDownloadCriteria] = useState({
    type: 'current', // 'current', 'all', 'selected', 'dateRange', 'status'
    dateFrom: '',
    dateTo: '',
    status: 'all',
    selectedInvoices: [] as string[]
  });
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      let result;
      const limit = showAll ? 1000 : 10;
      
      if (searchTerm.trim()) {
        // Use search server action with minimal data
        result = await getInvoicesListMinimal(currentPage, limit, statusFilter, searchTerm.trim());
      } else {
        // Use paginated list server action with minimal data
        result = await getInvoicesListMinimal(currentPage, limit, statusFilter);
      }
      
      if (result.success && result.data) {
        setInvoices(result.data.invoices || []);
        setTotalPages(result.data.pagination?.pages || 1);
        setTotalInvoices(result.data.pagination?.total || 0);
        
        // Calculate total revenue from loaded invoices
        const revenue = result.data.invoices?.reduce((sum, invoice) => {
          if (invoice.status === 'paid') {
            return sum + (invoice.total || 0);
          }
          return sum;
        }, 0) || 0;
        setTotalRevenue(revenue);
        
        // Calculate status counts
        const counts = result.data.invoices?.reduce((acc, invoice) => {
          acc[invoice.status as keyof typeof acc] = (acc[invoice.status as keyof typeof acc] || 0) + 1;
          return acc;
        }, {
          draft: 0,
          sent: 0,
          pending: 0,
          pending_approval: 0,
          rejected: 0,
          paid: 0,
          overdue: 0
        }) || {
          draft: 0,
          sent: 0,
          pending: 0,
          pending_approval: 0,
          rejected: 0,
          paid: 0,
          overdue: 0
        };
        setStatusCounts(counts);
      } else {
        console.error('❌ [Invoices Page] Server action failed:', result.error);
        // Fallback to empty state
        setInvoices([]);
        setTotalRevenue(0);
        setTotalPages(1);
        setTotalInvoices(0);
      }
    } catch (error) {
      console.error('❌ [Invoices Page] Error loading invoices:', error);
      // Fallback to empty state
      setInvoices([]);
      setTotalRevenue(0);
      setTotalPages(1);
      setTotalInvoices(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, showAll]);

  useEffect(() => {
    if (session?.user) {
      loadInvoices();
    }
  }, [session, loadInvoices]);

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadInvoices(); // Reload the list
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const handleDynamicDownloadCsv = async () => {
    try {
      console.log('📤 [Smart Invoicing] Starting dynamic CSV download with criteria:', downloadCriteria);

      // Build query parameters based on criteria
      const params = new URLSearchParams({
        convertToPreferred: 'true',
        limit: '1000' // Get all matching invoices
      });

      // Add criteria-specific parameters
      switch (downloadCriteria.type) {
        case 'current':
          // Use current filter settings
          if (statusFilter !== 'all') params.append('status', statusFilter);
          break;
        case 'dateRange':
          if (downloadCriteria.dateFrom) params.append('dateFrom', downloadCriteria.dateFrom);
          if (downloadCriteria.dateTo) params.append('dateTo', downloadCriteria.dateTo);
          break;
        case 'status':
          if (downloadCriteria.status !== 'all') params.append('status', downloadCriteria.status);
          break;
        case 'selected':
          // For selected invoices, we'll filter after fetching
          break;
        case 'all':
        default:
          // No additional parameters needed
          break;
      }

      // Fetch invoices with full data for export
      const result = await getFullInvoicesForExport(statusFilter, searchTerm);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to fetch invoices for export');
      }

      let invoicesToDownload = result.data;

      // Filter by selected invoices if needed
      if (downloadCriteria.type === 'selected' && selectedInvoices.length > 0) {
        invoicesToDownload = invoicesToDownload.filter((invoice: InvoiceDetails) => 
          invoice._id && selectedInvoices.includes(invoice._id.toString())
        );
      }

      if (invoicesToDownload.length === 0) {
        alert('No invoices match your criteria');
        return;
      }

      // Generate CSV content (same logic as bulk download)
      const csvRows = [];
      
      // CSV Headers
      const headers = [
        'Invoice Number', 'Invoice Name', 'Issue Date', 'Due Date', 'Status',
        'Company Name', 'Company Email', 'Company Phone', 'Company Address', 'Company Tax Number',
        'Client Name', 'Client Company', 'Client Email', 'Client Phone', 'Client Address',
        'Items Description', 'Total Quantity',
        'Subtotal', 'Total Tax', 'Total Amount', 'Currency',
        'Payment Method', 'Bank Name', 'Account Number', 'Routing Number', 'Network', 'Payment Address',
        'Memo', 'Created Date'
      ];
      csvRows.push(headers.join(','));
      
      // Process each invoice
      invoicesToDownload.forEach((invoice: InvoiceDetails) => {
        // Get company details
        const companyName = invoice.companyDetails?.name || 'N/A';
        const companyEmail = 'N/A';
        const companyPhone = 'N/A';
        const companyTaxNumber = invoice.companyDetails?.taxNumber || 'N/A';
        
        // Handle company address
        let companyAddress = 'N/A';
        if (invoice.companyDetails) {
          companyAddress = `${invoice.companyDetails.addressLine1 || ''}, ${invoice.companyDetails.city || ''}, ${invoice.companyDetails.region || ''} ${invoice.companyDetails.postalCode || ''}, ${invoice.companyDetails.country || ''}`;
        }
        
        // Get client details
        const clientName = [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 'N/A';
        const clientCompany = invoice.clientDetails?.companyName || 'N/A';
        const clientEmail = invoice.clientDetails?.email || 'N/A';
        const clientPhone = 'N/A';
        
        // Handle client address
        let clientAddress = 'N/A';
        if (invoice.clientDetails) {
          clientAddress = `${invoice.clientDetails.addressLine1 || ''}, ${invoice.clientDetails.city || ''}, ${invoice.clientDetails.region || ''}, ${invoice.clientDetails.postalCode || ''}, ${invoice.clientDetails.country || ''}`;
        }
        
        // Get payment details
        const paymentMethod = invoice.paymentSettings?.method === 'fiat' ? 'Bank Transfer' : 
                             invoice.paymentSettings?.method === 'crypto' ? 'Cryptocurrency' : 'N/A';
        const bankName = invoice.paymentSettings?.bankAccount?.bankName || 'N/A';
        const accountNumber = invoice.paymentSettings?.bankAccount?.accountNumber || 'N/A';
        const routingNumber = invoice.paymentSettings?.bankAccount?.routingNumber || 'N/A';
        const network = invoice.paymentSettings?.cryptoNetwork || 'N/A';
        const paymentAddress = invoice.paymentSettings?.walletAddress || 'N/A';
        
        // Combine all items into a single description
        const itemsDescription = invoice.items && invoice.items.length > 0
          ? invoice.items.map((item: { description?: string; quantity?: number; unitPrice?: number }) => `${item.description || 'Item'} (Qty: ${item.quantity || 0}, Price: ${item.unitPrice?.toFixed(2) || '0.00'})`).join('; ')
          : 'No items';
        
        // Calculate total quantity
        const totalQuantity = invoice.items ? invoice.items.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0) : 0;

        const row = [
          `"${invoice.invoiceNumber || 'N/A'}"`,
          `"${invoice.invoiceNumber || 'N/A'}"`,
          `"${formatDate(invoice.issueDate || '')}"`,
          `"${formatDate(invoice.dueDate || '')}"`,
          `"${invoice.status || 'N/A'}"`,
          `"${companyName}"`,
          `"${companyEmail}"`,
          `"${companyPhone}"`,
          `"${companyAddress}"`,
          `"${companyTaxNumber}"`,
          `"${clientName}"`,
          `"${clientCompany}"`,
          `"${clientEmail}"`,
          `"${clientPhone}"`,
          `"${clientAddress}"`,
          `"${itemsDescription}"`,
          `"${totalQuantity}"`,
          `"${invoice.subtotal?.toFixed(2) || '0.00'}"`,
          `"${invoice.taxes?.reduce((sum: number, tax: { amount?: number }) => sum + (tax.amount || 0), 0).toFixed(2) || '0.00'}"`,
          `"${invoice.totalAmount?.toFixed(2) || '0.00'}"`,
          `"${invoice.currency || 'N/A'}"`,
          `"${paymentMethod}"`,
          `"${bankName}"`,
          `"${accountNumber}"`,
          `"${routingNumber}"`,
          `"${network}"`,
          `"${paymentAddress}"`,
          `"${invoice.notes || ''}"`,
          `"${formatDate(invoice.createdAt || '')}"`
        ];
        csvRows.push(row.join(','));
      });
      
      // Convert to CSV string
      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename based on criteria
      let filename = 'invoices';
      const timestamp = new Date().toISOString().split('T')[0];
      
      switch (downloadCriteria.type) {
        case 'current':
          filename = `invoices_current_${statusFilter}_${timestamp}`;
          break;
        case 'dateRange':
          filename = `invoices_${downloadCriteria.dateFrom}_to_${downloadCriteria.dateTo}`;
          break;
        case 'status':
          filename = `invoices_${downloadCriteria.status}`;
          break;
        case 'selected':
          filename = `invoices_selected_${selectedInvoices.length}`;
          break;
        case 'all':
        default:
          filename = `invoices_all_${timestamp}`;
          break;
      }
      
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [Smart Invoicing] Dynamic CSV downloaded successfully:', {
        invoiceCount: invoicesToDownload.length,
        criteria: downloadCriteria.type,
        filename: `${filename}.csv`
      });
      
      // Close modal
      setShowDownloadModal(false);
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download dynamic CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': 
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredInvoices = invoices.filter(invoice =>
    (invoice.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (invoice.clientDetails?.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (invoice.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const statusFilteredInvoices = statusFilter === 'all' 
    ? filteredInvoices 
    : statusFilter === 'pending'
    ? filteredInvoices.filter(invoice => invoice.status === 'sent' || invoice.status === 'pending')
    : filteredInvoices.filter(invoice => invoice.status === statusFilter);

  // Calculate stats for the header using accurate counts from API
  const stats = {
    totalInvoices: totalInvoices, // Use total count from API instead of just loaded invoices
    totalRevenue: totalRevenue, // Use total revenue from API (all invoices) instead of just loaded invoices
    pendingCount: statusCounts.sent + statusCounts.pending, // Use accurate counts from API
    paidCount: statusCounts.paid // Use accurate counts from API
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing?refresh=true')}
            className="p-2 text-blue-200 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Invoices</h1>
            <p className="text-blue-200 text-sm sm:text-base">Manage your invoices and track payments</p>
          </div>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => setShowDownloadModal(true)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg min-h-[44px] w-full sm:w-auto"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-medium text-sm sm:text-base">Download CSV</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-medium text-sm sm:text-base">Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Search and Filters - Moved to top for better UX */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
            <input
              type="text"
              placeholder="Search invoices by number or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder-gray-600 font-medium text-sm sm:text-base min-h-[44px]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue')}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm sm:text-base min-h-[44px] w-full sm:w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-blue-200 text-xs sm:text-sm font-medium">Total Invoices</p>
              <p className="text-lg sm:text-2xl font-bold text-white">{stats.totalInvoices}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
              <FileText className="h-4 w-4 sm:h-6 sm:w-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-blue-200 text-xs sm:text-sm font-medium">Total Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-white">
                <CurrencyAmount 
                  amount={stats.totalRevenue} 
                  currency="USD"
                  showOriginalCurrency={false}
                />
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg flex-shrink-0">
              <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-blue-200 text-xs sm:text-sm font-medium">Pending</p>
              <p className="text-lg sm:text-2xl font-bold text-white">{stats.pendingCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-blue-200 text-xs sm:text-sm font-medium">Paid</p>
              <p className="text-lg sm:text-2xl font-bold text-white">{stats.paidCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg flex-shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals Section */}
      <PendingInvoiceApprovals />

      {/* Invoices Table - Mobile Optimized */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="text-white text-lg">Loading invoices...</span>
            </div>
          </div>
        ) : statusFilteredInvoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No invoices found</h3>
            <p className="text-blue-200 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first invoice'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Invoice
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden">
              <div className="p-4 space-y-3">
                {statusFilteredInvoices.map((invoice) => (
                  <div
                    key={invoice._id?.toString() || 'unknown'}
                    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice._id?.toString() || '')}
                            onChange={(e) => {
                              const invoiceId = invoice._id?.toString();
                              if (!invoiceId) return;
                              
                              if (e.target.checked) {
                                setSelectedInvoices(prev => [...prev, invoiceId]);
                              } else {
                                setSelectedInvoices(prev => prev.filter(id => id !== invoiceId));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center space-x-2">
                            <h3 className="text-white font-semibold text-sm truncate">
                              {invoice.invoiceNumber || 'Invoice'}
                            </h3>
                            {/* WhatsApp indicator */}
                            {invoice.sentVia === 'whatsapp' && (
                              <MessageCircle className="h-4 w-4 text-green-400 flex-shrink-0"  />
                            )}
                          </div>
                          {/* Approval indicator - only for organization recipients */}
                          {(invoice.status === 'approved' || invoice.status === 'sent') && invoice.organizationId && invoice.recipientType === 'organization' && (
                            <div className="relative group">
                              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Approved
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-blue-200 text-xs">
                          {invoice.clientDetails?.companyName || 
                           [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 
                           'Client'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-white font-semibold text-sm">
                          <CurrencyAmount 
                            amount={invoice.total || invoice.totalAmount || 0} 
                            currency={invoice.currency || 'USD'}
                            showOriginalCurrency={true}
                          />
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status === 'approved' ? 'sent' : invoice.status)}`}>
                            {invoice.status === 'approved' ? 'Pending' :
                             invoice.status === 'sent' ? 'Pending' : 
                             invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
                          </span>
                          {/* WhatsApp indicator */}
                          {invoice.sentVia === 'whatsapp' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                              WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-blue-200 mb-3">
                      <span>{invoice.issueDate ? formatDate(invoice.issueDate.toString()) : 'N/A'}</span>
                      <span>{invoice.createdAt ? formatDate(invoice.createdAt.toString()) : 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center justify-end space-x-2">
                      {invoice.status === 'draft' ? (
                        <button
                          onClick={() => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id?.toString()}`)}
                          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors px-3 py-2 rounded-lg hover:bg-white/10 min-h-[36px]"
                        >
                          <Edit3 className="h-4 w-4" />
                          <span className="text-xs">Edit</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id?.toString()}`)}
                          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors px-3 py-2 rounded-lg hover:bg-white/10 min-h-[36px]"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="text-xs">View</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteInvoice(invoice._id?.toString() || '')}
                        className="flex items-center space-x-1 text-red-400 hover:text-red-300 transition-colors px-3 py-2 rounded-lg hover:bg-white/10 min-h-[36px]"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-xs">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.length === statusFilteredInvoices.length && statusFilteredInvoices.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvoices(statusFilteredInvoices.map(inv => inv._id?.toString()).filter(Boolean) as string[]);
                          } else {
                            setSelectedInvoices([]);
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {statusFilteredInvoices.map((invoice) => (
                    <tr 
                      key={invoice._id?.toString() || 'unknown'} 
                      className={`hover:bg-white/5 transition-colors ${invoice.status === 'draft' ? 'cursor-pointer' : ''}`}
                      onClick={invoice.status === 'draft' ? () => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id?.toString()}`) : undefined}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedInvoices.includes(invoice._id?.toString() || '')}
                          onChange={(e) => {
                            const invoiceId = invoice._id?.toString();
                            if (!invoiceId) return;
                            
                            if (e.target.checked) {
                              setSelectedInvoices(prev => [...prev, invoiceId]);
                            } else {
                              setSelectedInvoices(prev => prev.filter(id => id !== invoiceId));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-semibold text-white">
                              {invoice.invoiceNumber || 'Invoice'}
                            </div>
                            {/* WhatsApp indicator */}
                            {invoice.sentVia === 'whatsapp' && (
                              <MessageCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                            )}
                            {/* Approval indicator */}
                            {(invoice.status === 'approved' || invoice.status === 'sent') && (
                              <div className="relative group">
                                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  Approved
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-blue-200">
                            {invoice.issueDate ? formatDate(invoice.issueDate.toString()) : 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {invoice.clientDetails?.companyName || 
                           [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 
                           'Client'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-white">
                          <CurrencyAmount 
                            amount={invoice.totalAmount || 0} 
                            currency={invoice.currency || 'USD'}
                            showOriginalCurrency={true}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status === 'approved' ? 'sent' : invoice.status)}`}>
                            {invoice.status === 'approved' ? 'Pending' :
                             invoice.status === 'sent' ? 'Pending' : 
                           invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
                          </span>
                          {/* WhatsApp indicator */}
                          {invoice.sentVia === 'whatsapp' && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                              WhatsApp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-200">
                        {invoice.createdAt ? formatDate(invoice.createdAt.toString()) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          {invoice.status === 'draft' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id?.toString()}`);
                              }}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                              title="Continue Editing Draft"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/services/smart-invoicing/invoices/${invoice._id?.toString()}`);
                              }}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvoice(invoice._id?.toString() || '');
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination Controls */}
      {!showAll && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAll(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Show All ({totalInvoices} invoices)
            </button>
            <span className="text-sm text-gray-400">
              Showing {((currentPage - 1) * 10) + 1}-{Math.min(currentPage * 10, totalInvoices)} of {totalInvoices} invoices
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Show All Toggle */}
      {showAll && (
        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={() => {
              setShowAll(false);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Show Paginated View
          </button>
        </div>
      )}

      {/* Dynamic Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Download Invoices</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Download Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Download Type</label>
                  <select
                    value={downloadCriteria.type}
                    onChange={(e) => setDownloadCriteria(prev => ({ ...prev, type: e.target.value as 'current' | 'all' | 'dateRange' | 'selected' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="current">Current View ({statusFilteredInvoices.length} invoices)</option>
                    <option value="all">All Invoices</option>
                    <option value="dateRange">Date Range</option>
                    <option value="status">By Status</option>
                    <option value="selected">Selected Invoices</option>
                  </select>
                </div>

                {/* Date Range Options */}
                {downloadCriteria.type === 'dateRange' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                      <input
                        type="date"
                        value={downloadCriteria.dateFrom}
                        onChange={(e) => setDownloadCriteria(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                      <input
                        type="date"
                        value={downloadCriteria.dateTo}
                        onChange={(e) => setDownloadCriteria(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Status Selection */}
                {downloadCriteria.type === 'status' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={downloadCriteria.status}
                      onChange={(e) => setDownloadCriteria(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="pending">Pending</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                )}

                {/* Selected Invoices Info */}
                {downloadCriteria.type === 'selected' && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      Select invoices from the table below by clicking the checkboxes, then use this download option.
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Selected: {selectedInvoices.length} invoices
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDynamicDownloadCsv}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <FloatingActionButton />
    </div>
  );
} 