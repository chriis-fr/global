'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Edit3,
  Trash2,
  Building2,
  User,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  Download,
  File,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { countries } from '@/data/countries';
import { getCurrencyByCode } from '@/data/currencies';

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  invoiceName?: string;
  issueDate?: string;
  dueDate?: string;
  companyLogo?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  companyTaxNumber?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  currency?: string;
  paymentMethod?: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  enableMultiCurrency?: boolean;
  invoiceType?: 'regular' | 'recurring';
  items?: Array<{
    id?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    tax?: number;
    amount?: number;
  }>;
  subtotal?: number;
  totalTax?: number;
  total?: number;
  totalAmount?: number;
  memo?: string;
  status?: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue';
  createdAt?: string;
  updatedAt?: string;
  companyDetails?: {
    name: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    taxNumber?: string;
  };
  clientDetails?: {
    companyName: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  paymentSettings?: {
    method: 'fiat' | 'crypto';
    cryptoNetwork?: string;
    walletAddress?: string;
    bankAccount?: {
      bankName?: string;
      accountNumber?: string;
      routingNumber?: string;
    };
    currency?: string;
    enableMultiCurrency?: boolean;
  };
}

export default function InvoiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  // Check if any items have discounts
  const hasAnyDiscounts = invoice?.items?.some(item => (item.discount || 0) > 0) || false;

  const loadInvoice = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('📊 [Invoice View] Loaded invoice data:', {
          id: data.data._id,
          invoiceNumber: data.data.invoiceNumber,
          status: data.data.status,
          total: data.data.total,
          totalAmount: data.data.totalAmount,
          subtotal: data.data.subtotal,
          totalTax: data.data.totalTax,
          items: data.data.items?.length || 0,
          itemsData: data.data.items
        });
        setInvoice(data.data);
      } else {
        console.error('❌ [Invoice View] Failed to load invoice:', data.message);
        router.push('/dashboard/services/smart-invoicing/invoices');
      }
    } catch (error) {
      console.error('❌ [Invoice View] Error loading invoice:', error);
      router.push('/dashboard/services/smart-invoicing/invoices');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load invoice only once when component mounts and ID is available
  useEffect(() => {
    const invoiceId = params.id as string;
    if (invoiceId && session?.user && !invoice) {
      loadInvoice(invoiceId);
    }
  }, [params.id, session?.user, invoice, loadInvoice]);

  const handleDeleteInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/dashboard/services/smart-invoicing/invoices');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getCurrencySymbol = (currency: string) => {
    return getCurrencyByCode(currency)?.symbol || currency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if user has permission to mark invoice as paid
  const canMarkAsPaid = () => {
    if (!session?.user) return false;
    
    // Individual users can always mark their own invoices as paid
    if (!session.user.organizationId || session.user.organizationId === session.user.id) {
      return true;
    }
    
    // For organization users, check if they are admin or have proper rights
    // For now, we'll allow organization members to mark invoices as paid
    // You can add more specific permission checks here later
    return true;
  };

  // Check if invoice can be marked as paid
  const canMarkInvoiceAsPaid = () => {
    if (!invoice) return false;
    
    // Only allow marking as paid if status is 'sent' or 'pending'
    const allowedStatuses = ['sent', 'pending'];
    return allowedStatuses.includes(invoice.status || '') && canMarkAsPaid();
  };

  const handleMarkAsPaid = async () => {
    if (!invoice || !canMarkInvoiceAsPaid() || !confirm('Are you sure you want to mark this invoice as paid?')) return;
    
    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'paid'
        }),
      });
      
      if (response.ok) {
        // Reload the invoice to get updated status
        await loadInvoice(invoice._id);
        alert('Invoice marked as paid successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to mark invoice as paid: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      alert('Failed to mark invoice as paid');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle CSV download
  const handleDownloadCsv = () => {
    if (!invoice) return;

    try {
      console.log('📤 [Smart Invoicing] Starting CSV download for invoice:', invoice.invoiceNumber);

      // Create CSV content
      const csvRows = [];
      
      // Header row
      const headers = ['Invoice Details'];
      csvRows.push(headers.join(','));
      
      // Invoice information
      csvRows.push(['Invoice Name', invoice.invoiceName || 'Invoice']);
      csvRows.push(['Invoice Number', invoice.invoiceNumber || 'N/A']);
      csvRows.push(['Issue Date', formatDate(invoice.issueDate || '')]);
      csvRows.push(['Due Date', formatDate(invoice.dueDate || '')]);
      csvRows.push(['Status', invoice.status || 'Draft']);
      csvRows.push(['']);
      
      // Company information
      csvRows.push(['Company Information']);
      csvRows.push(['Company Name', invoice.companyName || invoice.companyDetails?.name || 'N/A']);
      csvRows.push(['Email', invoice.companyEmail || 'N/A']);
      csvRows.push(['Phone', invoice.companyPhone || 'N/A']);
      
      // Handle company address with different formats
      let companyAddressStr = 'N/A';
      if (invoice.companyAddress) {
        companyAddressStr = `${invoice.companyAddress.street || ''}, ${invoice.companyAddress.city || ''}, ${invoice.companyAddress.state || ''} ${invoice.companyAddress.zipCode || ''}, ${invoice.companyAddress.country || ''}`;
      } else if (invoice.companyDetails) {
        companyAddressStr = `${invoice.companyDetails.addressLine1 || ''}, ${invoice.companyDetails.city || ''}, ${invoice.companyDetails.region || ''} ${invoice.companyDetails.postalCode || ''}, ${invoice.companyDetails.country || ''}`;
      }
      csvRows.push(['Address', companyAddressStr]);
      csvRows.push(['Tax Number', invoice.companyTaxNumber || invoice.companyDetails?.taxNumber || 'N/A']);
      csvRows.push(['']);
      
      // Client information
      csvRows.push(['Client Information']);
      if (invoice.clientDetails?.companyName) {
        csvRows.push(['Company', invoice.clientDetails.companyName]);
        csvRows.push(['Contact Person', invoice.clientName || 'N/A']);
      } else {
        csvRows.push(['Client Name', invoice.clientName || 'N/A']);
      }
      csvRows.push(['Email', invoice.clientEmail || 'N/A']);
      csvRows.push(['Phone', invoice.clientPhone || 'N/A']);
      
      // Handle client address with different formats
      let clientAddressStr = 'N/A';
      if (invoice.clientAddress) {
        clientAddressStr = `${invoice.clientAddress.street || ''}, ${invoice.clientAddress.city || ''}, ${invoice.clientAddress.state || ''} ${invoice.clientAddress.zipCode || ''}, ${invoice.clientAddress.country || ''}`;
      } else if (invoice.clientDetails) {
        clientAddressStr = `${invoice.clientDetails.addressLine1 || ''}, ${invoice.clientDetails.city || ''}, ${invoice.clientDetails.region || ''} ${invoice.clientDetails.postalCode || ''}, ${invoice.clientDetails.country || ''}`;
      }
      csvRows.push(['Address', clientAddressStr]);
      csvRows.push(['']);
      
      // Items header
      const itemHeaders = ['Description', 'Quantity', 'Unit Price', 'Tax %', 'Amount'];
      if (hasAnyDiscounts) {
        itemHeaders.splice(3, 0, 'Discount %');
      }
      csvRows.push(['Invoice Items']);
      csvRows.push(itemHeaders.join(','));
      
      // Items data
      invoice.items?.forEach(item => {
        const itemRow = [
          item.description || 'Item description',
          item.quantity?.toString() || '0',
          `${getCurrencySymbol(invoice.currency || '')}${item.unitPrice?.toFixed(2) || '0.00'}`,
          item.tax?.toString() || '0' + '%',
          `${getCurrencySymbol(invoice.currency || '')}${item.amount?.toFixed(2) || '0.00'}`
        ];
        if (hasAnyDiscounts) {
          itemRow.splice(3, 0, (item.discount || 0).toString() + '%');
        }
        csvRows.push(itemRow.join(','));
      });
      
      csvRows.push(['']);
      
      // Summary
      csvRows.push(['Summary']);
      csvRows.push(['Subtotal', `${getCurrencySymbol(invoice.currency || '')}${invoice.subtotal?.toFixed(2) || '0.00'}`]);
      csvRows.push(['Total Tax', `${getCurrencySymbol(invoice.currency || '')}${invoice.totalTax?.toFixed(2) || '0.00'}`]);
      csvRows.push(['Total Amount', `${getCurrencySymbol(invoice.currency || '')}${invoice.totalAmount?.toFixed(2) || '0.00'}`]);
      csvRows.push(['']);
      
      // Payment information
      csvRows.push(['Payment Information']);
      const paymentMethod = invoice.paymentMethod || invoice.paymentSettings?.method;
      csvRows.push(['Payment Method', paymentMethod === 'fiat' ? 'Bank Transfer' : 'Cryptocurrency']);
      csvRows.push(['Currency', invoice.currency || invoice.paymentSettings?.currency || 'N/A']);
      
      if (paymentMethod === 'fiat') {
        const bankAccount = invoice.paymentSettings?.bankAccount;
        if (bankAccount?.bankName) csvRows.push(['Bank Name', bankAccount.bankName]);
        if (bankAccount?.accountNumber) csvRows.push(['Account Number', bankAccount.accountNumber]);
        if (bankAccount?.routingNumber) csvRows.push(['Routing Number', bankAccount.routingNumber]);
      } else {
        if (invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork) csvRows.push(['Network', invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork]);
        if (invoice.paymentAddress || invoice.paymentSettings?.walletAddress) csvRows.push(['Payment Address', invoice.paymentAddress || invoice.paymentSettings?.walletAddress]);
      }
      
      csvRows.push(['']);
      
      // Memo
      if (invoice.memo) {
        csvRows.push(['Memo']);
        csvRows.push([invoice.memo]);
        csvRows.push(['']);
      }
      
      // Footer
      csvRows.push(['Generated by Chains-ERP']);
      csvRows.push([`Invoice Number: ${invoice.invoiceNumber || 'N/A'} | Date: ${formatDate(invoice.issueDate || '')}`]);
      
      // Convert to CSV string
      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [Smart Invoicing] CSV downloaded successfully:', {
        invoiceNumber: invoice.invoiceNumber,
        filename: `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.csv`
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice not found</h2>
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing/invoices')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          
          <div className="flex space-x-4">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(invoice.status || 'draft')}`}>
              {invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
            </span>
            
            {/* Download Dropdown */}
            <div className="relative download-dropdown-container">
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              
              {showDownloadDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => {
                      // For now, just show a message since PDF download isn't implemented here
                      alert('PDF download functionality will be implemented soon.');
                      setShowDownloadDropdown(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <File className="h-4 w-4 text-red-500" />
                    <span>Download as PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadCsv();
                      setShowDownloadDropdown(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <File className="h-4 w-4 text-blue-500" />
                    <span>Download as CSV</span>
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit</span>
            </button>
            {canMarkInvoiceAsPaid() && (
              <button
                onClick={handleMarkAsPaid}
                disabled={updatingStatus}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
              </button>
            )}
            <button
              onClick={handleDeleteInvoice}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white rounded-lg shadow-lg border max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
              {/* Left Side - Invoice Name */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceName || 'Invoice'}</h1>
                {invoice.invoiceNumber && (
                  <p className="text-lg text-gray-600 mt-2">Invoice #: {invoice.invoiceNumber}</p>
                )}
              </div>

              {/* Right Side - Dates */}
              <div className="text-right space-y-2">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Issued on {formatDate(invoice.issueDate || new Date().toISOString())}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>Payment due by {formatDate(invoice.dueDate || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  From
                </h3>
                <div className="space-y-2">
                  {invoice.companyLogo && (
                    <div className="mb-4">
                      <Image 
                        src={invoice.companyLogo} 
                        alt="Company Logo" 
                        width={48}
                        height={48}
                        className="h-12 w-auto object-contain rounded-md"
                        style={{ backgroundColor: 'white' }}
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="font-medium text-gray-900">{invoice.companyName || invoice.companyDetails?.name || 'Company Name'}</div>
                  <div className="text-gray-600">
                    {invoice.companyAddress?.street || invoice.companyDetails?.addressLine1 ? <div>{invoice.companyAddress?.street || invoice.companyDetails?.addressLine1}</div> : null}
                    {(invoice.companyAddress?.city || invoice.companyDetails?.city || invoice.companyAddress?.state || invoice.companyDetails?.region || invoice.companyAddress?.zipCode || invoice.companyDetails?.postalCode) && (
                      <div>
                        {[invoice.companyAddress?.city || invoice.companyDetails?.city, invoice.companyAddress?.state || invoice.companyDetails?.region, invoice.companyAddress?.zipCode || invoice.companyDetails?.postalCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.companyAddress?.country || invoice.companyDetails?.country ? (
                      <div>{countries.find(c => c.code === (invoice.companyAddress?.country || invoice.companyDetails?.country))?.name}</div>
                    ) : null}
                  </div>
                  {invoice.companyTaxNumber || invoice.companyDetails?.taxNumber ? <div className="text-gray-600">Tax: {invoice.companyTaxNumber || invoice.companyDetails?.taxNumber}</div> : null}
                  {invoice.companyEmail && <div className="text-gray-600">{invoice.companyEmail}</div>}
                  {invoice.companyPhone && <div className="text-gray-600">{invoice.companyPhone}</div>}
                </div>
              </div>

              {/* Client Information */}
              <div className="flex-1 ml-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Bill To
                </h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">
                    {invoice.clientDetails?.companyName ? invoice.clientDetails.companyName : invoice.clientName || 'Client Name'}
                  </div>
                  {invoice.clientDetails?.companyName && (
                    <div className="text-gray-600">
                      Attn: {invoice.clientName || 'Client Name'}
                    </div>
                  )}
                  <div className="text-gray-600">
                    {invoice.clientAddress?.street || invoice.clientDetails?.addressLine1 ? <div>{invoice.clientAddress?.street || invoice.clientDetails?.addressLine1}</div> : null}
                    {(invoice.clientAddress?.city || invoice.clientDetails?.city || invoice.clientAddress?.state || invoice.clientDetails?.region || invoice.clientAddress?.zipCode || invoice.clientDetails?.postalCode) && (
                      <div>
                        {[invoice.clientAddress?.city || invoice.clientDetails?.city, invoice.clientAddress?.state || invoice.clientDetails?.region, invoice.clientAddress?.zipCode || invoice.clientDetails?.postalCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.clientAddress?.country || invoice.clientDetails?.country ? (
                      <div>{countries.find(c => c.code === (invoice.clientAddress?.country || invoice.clientDetails?.country))?.name}</div>
                    ) : null}
                  </div>
                  {invoice.clientEmail && <div className="text-gray-600">{invoice.clientEmail}</div>}
                  {invoice.clientPhone && <div className="text-gray-600">{invoice.clientPhone}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Payment Method</p>
                <p className="font-medium">
                  {invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
                </p>
                {(invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto') && (invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork) && (
                  <p className="text-sm text-gray-600">Network: {invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork}</p>
                )}
                {(invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto') && (invoice.paymentAddress || invoice.paymentSettings?.walletAddress) && (
                  <p className="text-sm text-gray-600">Address: {invoice.paymentAddress || invoice.paymentSettings?.walletAddress}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.bankName || invoice.paymentSettings?.bankAccount?.bankName) && (
                  <p className="text-sm text-gray-600">Bank: {invoice.bankName || invoice.paymentSettings?.bankAccount?.bankName}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.accountNumber || invoice.paymentSettings?.bankAccount?.accountNumber) && (
                  <p className="text-sm text-gray-600">Account: {invoice.accountNumber || invoice.paymentSettings?.bankAccount?.accountNumber}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.routingNumber || invoice.paymentSettings?.bankAccount?.routingNumber) && (
                  <p className="text-sm text-gray-600">Routing: {invoice.routingNumber || invoice.paymentSettings?.bankAccount?.routingNumber}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Currency</p>
                <p className="font-medium">{invoice.currency || invoice.paymentSettings?.currency || 'USD'}</p>
                {(invoice.enableMultiCurrency || invoice.paymentSettings?.enableMultiCurrency) && (
                  <p className="text-sm text-blue-600">Multi-currency enabled</p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Invoice Items</h3>
            
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    {hasAnyDiscounts && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Tax</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => {
                    return (
                      <tr key={item.id || `item-${index}`} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.quantity}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{getCurrencySymbol(invoice.currency || '')}{item.unitPrice?.toFixed(2) || '0.00'}</div>
                        </td>
                        {hasAnyDiscounts && (
                          <td className="py-3 px-4">
                            <div className="text-gray-900">{item.discount || 0}%</div>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.tax || 0}%</div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="text-gray-900">{getCurrencySymbol(invoice.currency || '')}{item.amount?.toFixed(2) || '0.00'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Amount without tax</span>
                  <span>{getCurrencySymbol(invoice.currency || '')}{invoice.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Tax amount</span>
                  <span>{getCurrencySymbol(invoice.currency || '')}{invoice.totalTax?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>{getCurrencySymbol(invoice.currency || '')}{invoice.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>{getCurrencySymbol(invoice.currency || '')}{invoice.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memo */}
          {invoice.memo && (
            <div className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{invoice.memo}</p>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 sm:p-8 text-center text-sm text-gray-500">
            <p>Invoice created on {formatDate(invoice.createdAt || '')}</p>
            {invoice.updatedAt !== invoice.createdAt && (
              <p>Last updated on {formatDate(invoice.updatedAt || '')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 