'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Eye,
  Edit3,
  Trash2,
  Loader2,
  LayoutDashboard,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  Download
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { InvoiceService } from '@/lib/services/invoiceService';
import { Invoice } from '@/models/Invoice';

export default function InvoicesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue'>('all');
  const [totalRevenue, setTotalRevenue] = useState(0);

  const loadInvoices = useCallback(async () => {
    try {
      // Fetch invoices with stats to get total revenue from all invoices
      const response = await fetch('/api/invoices?convertToPreferred=true');
      const data = await response.json();
      
      if (data.success) {
        setInvoices(data.data.invoices || []);
        setTotalRevenue(data.data.stats?.totalRevenue || 0);
      } else {
        // Fallback to InvoiceService if API fails
        const invoicesData = await InvoiceService.getInvoices();
        setInvoices(invoicesData);
        setTotalRevenue(0); // Will be calculated from loaded invoices
      }
    } catch (error) {
      console.error('❌ [Invoices Page] Error loading invoices:', error);
      // Fallback to InvoiceService if fetch fails
      const invoicesData = await InvoiceService.getInvoices();
      setInvoices(invoicesData);
      setTotalRevenue(0);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Handle bulk CSV download
  const handleBulkDownloadCsv = () => {
    if (statusFilteredInvoices.length === 0) {
      alert('No invoices to download');
      return;
    }

    try {
      console.log('📤 [Smart Invoicing] Starting bulk CSV download for', statusFilteredInvoices.length, 'invoices');

      // Create simple CSV structure for easy bulk processing
      const csvRows = [];
      
      // CSV Headers - simple and clean (one row per invoice)
      const headers = [
        'Invoice Number',
        'Invoice Name', 
        'Issue Date',
        'Due Date',
        'Status',
        'Company Name',
        'Company Email',
        'Company Phone',
        'Company Address',
        'Company Tax Number',
        'Client Name',
        'Client Company',
        'Client Email',
        'Client Phone',
        'Client Address',
        'Items Description',
        'Total Quantity',
        'Subtotal',
        'Total Tax',
        'Total Amount',
        'Currency',
        'Payment Method',
        'Bank Name',
        'Account Number',
        'Routing Number',
        'Network',
        'Payment Address',
        'Memo',
        'Created Date'
      ];
      csvRows.push(headers.join(','));
      
      // Process each invoice
      statusFilteredInvoices.forEach(invoice => {
        // Get company details
        const companyName = invoice.companyName || invoice.companyDetails?.name || 'N/A';
        const companyEmail = invoice.companyEmail || 'N/A';
        const companyPhone = invoice.companyPhone || 'N/A';
        const companyTaxNumber = invoice.companyTaxNumber || invoice.companyDetails?.taxNumber || 'N/A';
        
        // Handle company address
        let companyAddress = 'N/A';
        if (invoice.companyAddress) {
          companyAddress = `${invoice.companyAddress.street || ''}, ${invoice.companyAddress.city || ''}, ${invoice.companyAddress.state || ''} ${invoice.companyAddress.zipCode || ''}, ${invoice.companyAddress.country || ''}`;
        } else if (invoice.companyDetails) {
          companyAddress = `${invoice.companyDetails.addressLine1 || ''}, ${invoice.companyDetails.city || ''}, ${invoice.companyDetails.region || ''} ${invoice.companyDetails.postalCode || ''}, ${invoice.companyDetails.country || ''}`;
        }
        
        // Get client details
        const clientName = invoice.clientName || [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 'N/A';
        const clientCompany = invoice.clientDetails?.companyName || 'N/A';
        const clientEmail = invoice.clientEmail || 'N/A';
        const clientPhone = invoice.clientPhone || 'N/A';
        
        // Handle client address
        let clientAddress = 'N/A';
        if (invoice.clientAddress) {
          clientAddress = `${invoice.clientAddress.street || ''}, ${invoice.clientAddress.city || ''}, ${invoice.clientAddress.state || ''} ${invoice.clientAddress.zipCode || ''}, ${invoice.clientAddress.country || ''}`;
        } else if (invoice.clientDetails) {
          clientAddress = `${invoice.clientDetails.addressLine1 || ''}, ${invoice.clientDetails.city || ''}, ${invoice.clientDetails.region || ''}, ${invoice.clientDetails.postalCode || ''}, ${invoice.clientDetails.country || ''}`;
        }
        
        // Get payment details
        const paymentMethod = invoice.paymentMethod || invoice.paymentSettings?.method;
        const paymentMethodText = paymentMethod === 'fiat' ? 'Bank Transfer' : 'Cryptocurrency';
        const bankAccount = invoice.paymentSettings?.bankAccount;
        const bankName = bankAccount?.bankName || 'N/A';
        const accountNumber = bankAccount?.accountNumber || 'N/A';
        const routingNumber = bankAccount?.routingNumber || 'N/A';
        const network = invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork || 'N/A';
        const paymentAddress = invoice.paymentAddress || invoice.paymentSettings?.walletAddress || 'N/A';
        
        // Get original currency (preserve the invoice's original currency)
        const originalCurrency = invoice.currency || invoice.paymentSettings?.currency || 'USD';
        
        // Create one row per invoice (combine all items into a single description)
        const itemsDescription = invoice.items && invoice.items.length > 0 
          ? invoice.items.map(item => `${item.description || 'Item'} (Qty: ${item.quantity || 0}, Price: ${item.unitPrice?.toFixed(2) || '0.00'})`).join('; ')
          : 'No items';
        
        const totalQuantity = invoice.items ? invoice.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
        
        const row = [
          `"${invoice.invoiceNumber || 'N/A'}"`,
          `"${invoice.invoiceName || 'Invoice'}"`,
          `"${formatDate(invoice.issueDate || '')}"`,
          `"${formatDate(invoice.dueDate || '')}"`,
          `"${invoice.status || 'Draft'}"`,
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
          `"${invoice.totalTax?.toFixed(2) || '0.00'}"`,
          `"${invoice.totalAmount?.toFixed(2) || '0.00'}"`,
          `"${originalCurrency}"`,
          `"${paymentMethodText}"`,
          `"${bankName}"`,
          `"${accountNumber}"`,
          `"${routingNumber}"`,
          `"${network}"`,
          `"${paymentAddress}"`,
          `"${invoice.memo || ''}"`,
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
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `invoices_bulk_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [Smart Invoicing] Bulk CSV downloaded successfully:', {
        invoiceCount: statusFilteredInvoices.length,
        filename: `invoices_bulk_${timestamp}.csv`
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download bulk CSV:', error);
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

  // Calculate stats for the header
  const stats = {
    totalInvoices: invoices.length,
    totalRevenue: totalRevenue, // Use total revenue from API (all invoices) instead of just loaded invoices
    pendingCount: invoices.filter(inv => inv.status === 'sent' || inv.status === 'pending').length,
    paidCount: invoices.filter(inv => inv.status === 'paid').length
  };

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Invoices</h1>
          <p className="text-blue-200">Manage your invoices and track payments</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {statusFilteredInvoices.length > 0 && (
            <button
              onClick={handleBulkDownloadCsv}
              className="flex items-center justify-center sm:justify-start space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg w-full sm:w-auto"
            >
              <Download className="h-5 w-5" />
              <span className="font-medium">Download CSV ({statusFilteredInvoices.length})</span>
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
            className="flex items-center justify-center sm:justify-start space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total Invoices</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalInvoices}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                <FormattedNumberDisplay value={stats.totalRevenue} />
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.pendingCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-yellow-500/20 rounded-lg">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Paid</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats.paidCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search invoices by number or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder-gray-600 font-medium"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue')}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
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
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Invoice
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-right text-xs font-semibold text-blue-200 uppercase tracking-wider">
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
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {invoice.invoiceNumber || 'Invoice'}
                          </div>
                          <div className="text-sm text-blue-200">
                            {invoice.issueDate ? formatDate(invoice.issueDate.toString()) : 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {invoice.clientDetails?.companyName || 
                           [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 
                           'Client'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-white">
                          <FormattedNumberDisplay 
                            value={invoice.totalAmount || 0} 
                            currency={invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency === 'GBP' ? '£' : '$'}
                          />
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                          {invoice.status === 'sent' ? 'Pending' : 
                           invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-blue-200">
                        {invoice.createdAt ? formatDate(invoice.createdAt.toString()) : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2 sm:space-x-3">
                          {invoice.status === 'draft' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id?.toString()}`);
                              }}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1 sm:p-2 rounded-lg hover:bg-white/10"
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
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1 sm:p-2 rounded-lg hover:bg-white/10"
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          {invoice.status !== 'draft' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id?.toString()}`);
                              }}
                              className="text-green-400 hover:text-green-300 transition-colors p-1 sm:p-2 rounded-lg hover:bg-white/10"
                              title="Edit Invoice"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvoice(invoice._id?.toString() || '');
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 sm:p-2 rounded-lg hover:bg-white/10"
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

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-blue-700/90 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
} 