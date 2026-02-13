'use client';

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { usePermissions } from '@/lib/contexts/PermissionContext';
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
  ChevronDown as ChevronDownIcon,
  Receipt
} from 'lucide-react';
import { countries } from '@/data/countries';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { generatePdfBlob } from '@/lib/utils/pdfDocument';
import type { InvoicePdfData } from '@/components/invoicing/InvoicePdfDocument';
import { getExplorerUrl } from '@/lib/utils/blockchain';
import { ExternalLink } from 'lucide-react';
import { getChainByNumericId, SUPPORTED_CHAINS } from '@/lib/chains';

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
    taxRate?: number;
    amount?: number;
  }>;
  subtotal?: number;
  totalTax?: number;
  taxAmount?: number;
  total?: number;
  totalAmount?: number;
  withholdingTaxAmount?: number;
  withholdingTaxRatePercent?: number;
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
    firstName?: string;
    lastName?: string;
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
    chainId?: number;
    tokenAddress?: string;
  };
  txHash?: string;
  chainId?: number;
  tokenAddress?: string;
}

// Map invoice to InvoicePdfData for invoice PDF (react-pdf, same as email)
function invoiceToPdfData(inv: Invoice): InvoicePdfData {
  const companyAddr = inv.companyAddress ?? (inv.companyDetails ? {
    street: inv.companyDetails.addressLine1 ?? '',
    city: inv.companyDetails.city ?? '',
    state: inv.companyDetails.region ?? '',
    zipCode: inv.companyDetails.postalCode ?? '',
    country: inv.companyDetails.country ?? '',
  } : undefined);
  const clientAddr = inv.clientAddress ?? (inv.clientDetails ? {
    street: inv.clientDetails.addressLine1 ?? '',
    city: inv.clientDetails.city ?? '',
    state: inv.clientDetails.region ?? '',
    zipCode: inv.clientDetails.postalCode ?? '',
    country: inv.clientDetails.country ?? '',
  } : undefined);
  const addr = (r: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | undefined) => ({
    street: r?.street ?? '',
    city: r?.city ?? '',
    state: r?.state ?? '',
    zipCode: r?.zipCode ?? '',
    country: r?.country ?? '',
  });
  const paymentMethod = (inv.paymentMethod ?? inv.paymentSettings?.method) === 'crypto' ? 'crypto' : 'fiat';
  const bank = inv.paymentSettings?.bankAccount;
  return {
    invoiceName: inv.invoiceName ?? 'Invoice',
    issueDate: inv.issueDate ?? '',
    dueDate: inv.dueDate ?? '',
    companyName: inv.companyName ?? inv.companyDetails?.name ?? '',
    companyEmail: inv.companyEmail ?? '',
    companyPhone: inv.companyPhone ?? '',
    companyAddress: addr(companyAddr),
    companyTaxNumber: inv.companyTaxNumber ?? inv.companyDetails?.taxNumber,
    companyLogo: inv.companyLogo,
    clientName: inv.clientName ?? ([inv.clientDetails?.firstName, inv.clientDetails?.lastName].filter(Boolean).join(' ') || (inv.clientDetails?.companyName ?? '')),
    clientCompany: inv.clientDetails?.companyName,
    clientEmail: inv.clientEmail ?? '',
    clientPhone: inv.clientPhone ?? '',
    clientAddress: addr(clientAddr),
    currency: inv.currency ?? inv.paymentSettings?.currency ?? 'USD',
    paymentMethod,
    paymentNetwork: inv.paymentNetwork ?? inv.paymentSettings?.cryptoNetwork,
    paymentAddress: inv.paymentAddress ?? inv.paymentSettings?.walletAddress,
    bankName: inv.bankName ?? bank?.bankName,
    accountNumber: inv.accountNumber ?? bank?.accountNumber,
    routingNumber: inv.routingNumber ?? bank?.routingNumber,
    items: (inv.items ?? []).map((item) => {
      const rawTax = item.tax ?? (item as { taxRate?: number }).taxRate;
      return {
        id: item.id,
        description: typeof item.description === 'string' ? item.description : (item.description ?? '').toString(),
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        discount: item.discount ?? 0,
        tax: Number(rawTax ?? 0),
        amount: item.amount ?? 0,
      };
    }),
    subtotal: inv.subtotal ?? 0,
    totalTax: Number(inv.totalTax ?? (inv as { taxAmount?: number }).taxAmount ?? 0),
    total: inv.total ?? inv.totalAmount ?? 0,
    withholdingTaxEnabled: (inv.withholdingTaxAmount ?? 0) > 0,
    withholdingTaxAmount: inv.withholdingTaxAmount,
    withholdingTaxRatePercent: inv.withholdingTaxRatePercent,
    memo: inv.memo,
  };
}

export default function InvoiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceIdRaw = (params as unknown as { id?: string | string[] } | null)?.id;
  const invoiceId =
    typeof invoiceIdRaw === 'string'
      ? invoiceIdRaw
      : Array.isArray(invoiceIdRaw)
        ? invoiceIdRaw[0] ?? ''
        : '';
  const { data: session } = useSession();
  const { permissions } = usePermissions();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  // Memoize expensive calculations to prevent re-computation on every render
  const hasAnyDiscounts = useMemo(() => 
    invoice?.items?.some(item => (item.discount || 0) > 0) || false,
    [invoice?.items]
  );
  const hasAnyTaxes = useMemo(() => 
    invoice?.items?.some(item => ((item.tax ?? (item as { taxRate?: number }).taxRate) || 0) > 0) || false,
    [invoice?.items]
  );

  // Memoize formatDate to prevent recreation on every render
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  // Memoize getDisplayCurrency - expensive computation
  const getDisplayCurrency = useCallback((invoice: Invoice): string => {
    // Check if it's a crypto invoice
    const isCrypto = invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto';
    
    if (isCrypto) {
      // First, check if currency is already set correctly (should be USDT, cUSD, etc. for crypto)
      const storedCurrency = invoice.currency || invoice.paymentSettings?.currency;
      if (storedCurrency && storedCurrency !== 'USD' && storedCurrency.toUpperCase() !== 'USD') {
        // Currency is already set to crypto token (USDT, cUSD, etc.)
        return storedCurrency;
      }
      
      // If currency is USD or missing, try to get token symbol from tokenAddress
      const tokenAddress = invoice.paymentSettings?.tokenAddress || invoice.tokenAddress;
      const chainId = invoice.paymentSettings?.chainId || invoice.chainId;
      
      if (tokenAddress) {
        // Try to find token symbol from chain configuration
        if (chainId) {
          const chain = getChainByNumericId(chainId);
          if (chain?.tokens) {
            for (const [symbol, token] of Object.entries(chain.tokens)) {
              if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
                return symbol;
              }
            }
          }
        }
        
        // Fallback: check all chains
        for (const chain of SUPPORTED_CHAINS) {
          if (chain.tokens) {
            for (const [symbol, token] of Object.entries(chain.tokens)) {
              if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
                return symbol;
              }
            }
          }
        }
      }
      
      // If we still can't find it, return the stored currency (even if it's USD)
      return storedCurrency || 'USD';
    }
    
    // For non-crypto, use the currency field
    return invoice.currency || invoice.paymentSettings?.currency || 'USD';
  }, []);

  const displayCurrency = useMemo(() => {
    if (!invoice) return 'USD';
    return getDisplayCurrency(invoice);
  }, [invoice, getDisplayCurrency]);

  const loadInvoice = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}?convertToPreferred=true`); // Convert to user's preferred currency
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
        
        // Redirect draft invoices to create page for editing
        if (data.data.status === 'draft') {
          console.log('📝 [Invoice View] Redirecting draft invoice to create page for editing');
          router.push(`/dashboard/services/smart-invoicing/create?id=${data.data._id}`);
          return;
        }
        
        setInvoice(data.data);
      } else {
        console.error('❌ [Invoice View] Failed to load invoice:', data.message);
        router.push('/dashboard/services/smart-invoicing/invoices?refresh=true');
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
  // invoiceId from route
    if (invoiceId && session?.user && !invoice) {
      loadInvoice(invoiceId);
    }
  }, [invoiceId, session?.user, invoice, loadInvoice]);

  const handleDeleteInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/dashboard/services/smart-invoicing/invoices?refresh=true');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': 
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if user has permission to mark invoice as paid
  const canMarkAsPaid = useCallback(() => {
    if (!session?.user) return false;
    
    // Individual users can always mark their own invoices as paid
    if (!session.user.organizationId || session.user.organizationId === session.user.id) {
      return true;
    }
    
    // For organization users, check permissions
    if (permissions?.canMarkInvoiceAsPaid) {
      return true;
    }
    
    // Fallback: allow owners and admins to mark invoices as paid
    const userRole = session.user.role;
    return userRole === 'owner' || userRole === 'admin';
  }, [session?.user, permissions?.canMarkInvoiceAsPaid]);

  // Check if invoice can be marked as paid
  const canMarkInvoiceAsPaid = useCallback(() => {
    if (!invoice) return false;
    
    // Allow marking as paid if status is 'sent', 'pending', or 'approved'
    const allowedStatuses = ['sent', 'pending', 'approved'];
    return allowedStatuses.includes(invoice.status || '') && canMarkAsPaid();
  }, [invoice, canMarkAsPaid]);

  const handleMarkAsPaid = useCallback(async () => {
    if (!invoice || !canMarkInvoiceAsPaid() || !confirm('Are you sure you want to mark this invoice as paid?')) return;
    
    try {
      startTransition(() => {
        setUpdatingStatus(true);
      });
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
        // Set flag for immediate refresh on other side
        sessionStorage.setItem('lastPaymentAction', Date.now().toString());
      } else {
        const errorData = await response.json();
        alert(`Failed to mark invoice as paid: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      alert('Failed to mark invoice as paid');
    } finally {
      startTransition(() => {
        setUpdatingStatus(false);
      });
    }
  }, [invoice, canMarkInvoiceAsPaid, loadInvoice]);

  // Handle CSV download
  const handleDownloadCsv = () => {
    if (!invoice) return;

    try {
      console.log('📤 [Smart Invoicing] Starting CSV download for invoice:', invoice.invoiceNumber);

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
        filename: `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.csv`,
        currency: originalCurrency
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };

  // Handle PDF download - same react-pdf as email (InvoicePdfDocument variant='invoice')
  const handleDownloadPdf = useCallback(async () => {
    if (!invoice) return;

    try {
      startTransition(() => {
        setDownloadingPdf(true);
      });
      const pdfData = invoiceToPdfData(invoice);
      const blob = await generatePdfBlob(pdfData, invoice.invoiceNumber ?? undefined, 'invoice');
      const url = URL.createObjectURL(blob);
      const filename = `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✅ [Smart Invoicing] PDF downloaded successfully:', { invoiceNumber: invoice.invoiceNumber, filename, currency: invoice.currency });
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      startTransition(() => {
        setDownloadingPdf(false);
      });
    }
  }, [invoice, formatDate]);

  // Handle Receipt download - same react-pdf as payables (InvoicePdfDocument variant='receipt')
  const handleDownloadReceipt = useCallback(async () => {
    if (!invoice) return;

    try {
      startTransition(() => {
        setDownloadingReceipt(true);
      });
      const pdfData = invoiceToPdfData(invoice);
      const blob = await generatePdfBlob(pdfData, invoice.invoiceNumber ?? undefined, 'receipt');
      const url = URL.createObjectURL(blob);
      const filename = `Receipt_${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.updatedAt || new Date().toISOString()).replace(/,/g, '')}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✅ [Smart Invoicing] Receipt downloaded successfully');
    } catch (error) {
      console.error('❌ [Smart Invoicing] Error downloading receipt:', error);
      alert('Failed to download receipt. Please try again.');
    } finally {
      startTransition(() => {
        setDownloadingReceipt(false);
      });
    }
  }, [invoice, formatDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex rounded-lg items-center justify-center">
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
            onClick={() => router.push('/dashboard/services/smart-invoicing/invoices?refresh=true')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen rounded-lg bg-gray-50 py-8"
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
    >
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="mb-8">
          {/* Top Row: Back Button and Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <button
              onClick={() => router.push('/dashboard/services/smart-invoicing/invoices')}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm touch-manipulation active:scale-95 min-h-[44px]"
              style={{ touchAction: 'manipulation' }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            
            <span className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusColor(invoice.status || 'draft')}`}>
              {invoice.status === 'sent' ? 'Pending' : 
               invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
            </span>
          </div>
          
          {/* Action Buttons Row - Wrapped for mobile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Download Dropdown */}
            <div className="relative download-dropdown-container">
              <button
                onClick={() => {
                  startTransition(() => {
                    setShowDownloadDropdown(prev => !prev);
                  });
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
                style={{ touchAction: 'manipulation' }}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              
              {showDownloadDropdown && (
                <div className="absolute top-full right-0 sm:left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => {
                      handleDownloadPdf();
                      startTransition(() => {
                        setShowDownloadDropdown(false);
                      });
                    }}
                    disabled={downloadingPdf}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                      <File className="h-4 w-4 text-red-500" />
                    )}
                    <span>{downloadingPdf ? 'Generating PDF...' : 'Download as PDF'}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadCsv();
                      startTransition(() => {
                        setShowDownloadDropdown(false);
                      });
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors touch-manipulation active:scale-95"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <File className="h-4 w-4 text-blue-500" />
                    <span>Download as CSV</span>
                  </button>
                </div>
              )}
            </div>
            
            {invoice.status === 'draft' && (
              <button
                onClick={() => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
                style={{ touchAction: 'manipulation' }}
              >
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {canMarkInvoiceAsPaid() && (
              <button
                onClick={handleMarkAsPaid}
                disabled={updatingStatus}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95 whitespace-nowrap"
                style={{ touchAction: 'manipulation' }}
              >
                {updatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
              </button>
            )}
            {invoice?.status === 'paid' && (
              <button
                onClick={handleDownloadReceipt}
                disabled={downloadingReceipt}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95 whitespace-nowrap"
                style={{ touchAction: 'manipulation' }}
              >
                {downloadingReceipt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{downloadingReceipt ? 'Generating...' : 'Download Receipt'}</span>
              </button>
            )}
            <button
              onClick={handleDeleteInvoice}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
              style={{ touchAction: 'manipulation' }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* Invoice Document - Optimized for mobile rendering */}
        <div 
          className="bg-white rounded-lg shadow-lg border max-w-4xl mx-auto"
          style={{
            willChange: 'contents',
            contain: 'layout style paint',
            contentVisibility: 'auto'
          }}
        >
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

              {/* Right Side - Dates and Logo */}
              <div className="flex items-center space-x-4">
                {/* Dates */}
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
                
                {/* Company Logo */}
                {invoice.companyLogo && (
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    <Image 
                      src={invoice.companyLogo} 
                      alt="Company Logo" 
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                      unoptimized={invoice.companyLogo.startsWith('data:')}
                      style={{ backgroundColor: 'white' }}
                    />
                  </div>
                )}
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
                    {invoice.clientDetails?.companyName || 'Client Name'}
                  </div>
                  {invoice.clientDetails?.companyName && (
                    <div className="text-gray-600">
                      Attn: Client Name
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
                <p className="font-medium text-gray-600">
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
                {/* Transaction Hash (for paid crypto invoices) */}
                {invoice.status === 'paid' && invoice.txHash && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Transaction Hash</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const chainId = invoice.chainId || invoice.paymentSettings?.chainId;
                        const explorerUrl = getExplorerUrl(invoice.txHash, chainId);
                        // If we have an explorer URL, make the hash itself clickable
                        if (explorerUrl) {
                          return (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
                              title="View on blockchain explorer"
                            >
                              <code className="text-sm font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded break-all group-hover:bg-gray-200 transition-colors">
                                {invoice.txHash}
                              </code>
                              <ExternalLink className="h-4 w-4 flex-shrink-0" />
                            </a>
                          );
                        }
                        // If no explorer URL, just show the hash
                        return (
                          <code className="text-sm font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded break-all">
                            {invoice.txHash}
                          </code>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Currency</p>
                <p className="font-medium text-gray-600">{displayCurrency}</p>
                {(invoice.enableMultiCurrency || invoice.paymentSettings?.enableMultiCurrency) && (
                  <p className="text-sm text-blue-600">Multi-currency enabled</p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Invoice Items</h3>
            
            {/* Items Table - Optimized for mobile */}
            <div className="overflow-x-auto" style={{ 
              WebkitOverflowScrolling: 'touch',
              willChange: 'scroll-position',
              contain: 'layout style paint'
            }}>
              <table className="w-full min-w-[600px]" style={{ 
                tableLayout: 'fixed',
                willChange: 'contents'
              }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    {hasAnyDiscounts && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                    )}
                    {hasAnyTaxes && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Tax</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => {
                    // Pre-compute values to avoid recalculation during render (support both tax and taxRate)
                    const discount = item.discount || 0;
                    const tax = item.tax ?? (item as { taxRate?: number }).taxRate ?? 0;
                    const hasDiscount = discount > 0;
                    const hasTax = tax > 0;
                    
                    return (
                      <tr 
                        key={item.id || `item-${index}`} 
                        className="border-b border-gray-100"
                        style={{ 
                          contentVisibility: 'auto',
                          contain: 'layout style paint'
                        }}
                      >
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.quantity}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">
                            <FormattedNumberDisplay 
                              value={item.unitPrice || 0} 
                            />
                          </div>
                        </td>
                        {hasAnyDiscounts && (
                          <td className="py-3 px-4">
                            <div className="text-gray-900">{hasDiscount ? `${discount}%` : ''}</div>
                          </td>
                        )}
                        {hasAnyTaxes && (
                          <td className="py-3 px-4">
                            <div className="text-gray-900">{hasTax ? `${tax}%` : ''}</div>
                          </td>
                        )}
                        <td className="py-3 px-4 font-medium">
                          <div className="text-gray-900">
                            <FormattedNumberDisplay 
                              value={item.amount || 0} 
                            />
                          </div>
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
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.subtotal || 0} 
                    />
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Tax amount</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.totalTax ?? (invoice as { taxAmount?: number }).taxAmount ?? 0} 
                    />
                  </span>
                </div>
                {(invoice.withholdingTaxAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Withholding ({invoice.withholdingTaxRatePercent ?? 5}%)</span>
                    <span className="text-red-600">
                      -<FormattedNumberDisplay value={invoice.withholdingTaxAmount ?? 0} />
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-black text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.total || invoice.totalAmount || 0} 
                    />
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.total || invoice.totalAmount || 0} 
                    />
                  </span>
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