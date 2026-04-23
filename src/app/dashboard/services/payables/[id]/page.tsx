'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Receipt,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CreditCard,
  Building2,
  User,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
  Wallet,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrencyByCode } from '@/data/currencies';
import { generatePdfBlob } from '@/lib/utils/pdfDocument';
import type { InvoicePdfData } from '@/components/invoicing/InvoicePdfDocument';
import PayablePaymentModal from '@/components/payer/PayablePaymentModal';
import MarkPaidModal from '@/components/payables/MarkPaidModal';
import { markPayableAsPaid } from '@/app/actions/mark-payable-paid';
import { getExplorerUrl } from '@/lib/utils/blockchain';
import { ExternalLink } from 'lucide-react';

interface Payable {
  _id: string;
  payableNumber: string;
  payableName: string;
  payableType: string;
  issueDate: string;
  dueDate: string;
  paymentDate?: string;
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: Record<string, unknown>;
  companyTaxNumber?: string;
  vendorName: string;
  vendorEmail: string;
  vendorPhone?: string;
  vendorAddress?: Record<string, unknown>;
  currency: string;
  paymentMethod: string;
  fiatPaymentSubtype?: 'bank' | 'mpesa_paybill' | 'mpesa_till' | 'phone';
  paymentNetwork?: string;
  paymentAddress?: string;
  paymentPhoneNumber?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  tillNumber?: string;
  businessName?: string;
  externalInvoiceNumber?: string | null;
  invoiceFileUrl?: string | null;
  vendorPaymentDetails?: Record<string, unknown> | null;
  paymentReference?: string | null;
  paymentDetails?: Record<string, unknown> | null;
  enableMultiCurrency: boolean;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  total: number;
  memo: string;
  status: 'submitted' | 'pending' | 'approved' | 'paid' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
  paymentMethodDetails: {
    method: string;
    network?: string;
    address?: string;
    bankDetails?: Record<string, unknown>;
    cryptoDetails?: Record<string, unknown>;
  };
  attachedFiles: Record<string, unknown>[];
  relatedInvoiceId?: string;
  invoiceNumber?: string | null; // Invoice number if related
  ledgerEntryId?: string;
  ledgerStatus: string;
  txHash?: string;
  chainId?: number;
  frequency: string;
  recurringEndDate?: string;
  statusHistory: Array<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes: string;
  }>;
  lastNotificationSent?: string;
  notificationCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Try to render as image; fall back to file-icon if load fails (handles /api/files/{id} with no extension). */
function AttachmentCard({
  url,
  onOpen,
}: {
  url: string;
  onOpen: (url: string, isImage: boolean) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const fileName = url.split('/').pop()?.split('?')[0] || 'attachment';
  // Treat all /api/files/ URLs as potentially images; extension-based URLs we already know
  const tryAsImage = !imgFailed && (
    url.includes('/api/files/') ||
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)
  );

  if (tryAsImage) {
    return (
      <button
        type="button"
        onClick={() => onOpen(url, true)}
        className="w-full flex items-center gap-3 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-left"
      >
        <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Attached invoice"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
          <p className="text-xs text-gray-500">Click to preview full invoice image</p>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(url, false)}
      className="w-full flex items-center gap-3 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-left"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
        <FileText className="h-5 w-5 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
        <p className="text-xs text-gray-500">Click to preview attached document</p>
      </div>
      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}


export default function PayableViewPage() {
  const router = useRouter();
  const params = useParams();
  const [payable, setPayable] = useState<Payable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // Status history intentionally removed from UI (no longer shown in actions)
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentImgFailed, setAttachmentImgFailed] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showMobileParties, setShowMobileParties] = useState(false);
  const payableIdRaw = (params as unknown as { id?: string | string[] } | null)?.id;
  const payableId =
    typeof payableIdRaw === 'string'
      ? payableIdRaw
      : Array.isArray(payableIdRaw)
        ? payableIdRaw[0] ?? ''
        : '';

  const loadPayable = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { getPayableWithInvoice } = await import('@/app/actions/payable-actions');
      const result = await getPayableWithInvoice(payableId);

      if (result.success && result.data) {
        setPayable(result.data as unknown as Payable);
      } else {
        setError(result.error || 'Failed to load payable');
      }
    } catch (err) {
      console.error('Error loading payable:', err);
      setError('Failed to load payable');
    } finally {
      setLoading(false);
    }
  }, [payableId]);

  useEffect(() => {
    if (payableId) {
      loadPayable();
    }
  }, [payableId, loadPayable]);

  const isVendorLinkPayable = payable
    ? payable.status === 'submitted' ||
      !!payable.externalInvoiceNumber ||
      !!payable.vendorPaymentDetails
    : false;

  const handleStatusUpdate = async (newStatus: string) => {
    if (!payable) return;

    // Always collect reference (and optional proof) when marking as paid
    if (newStatus === 'paid') {
      setShowMarkPaidModal(true);
      return;
    }

    // For other status updates, use the old flow
    try {
      setUpdatingStatus(true);

      const requestBody = newStatus === 'paid' 
        ? { markAsPaid: true }
        : { 
            newStatus: newStatus, 
            updatedAt: new Date().toISOString() 
          };

      const response = await fetch(`/api/payables/${payableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        const updatedPayable = newStatus === 'paid' 
          ? { 
              ...payable, 
              status: 'paid' as const, 
              paymentStatus: 'completed' as const,
              paymentDate: new Date().toISOString(),
              updatedAt: new Date().toISOString() 
            }
          : { 
              ...payable, 
              status: newStatus as 'pending' | 'paid' | 'overdue' | 'cancelled' | 'approved', 
              updatedAt: new Date().toISOString() 
            };
        
        setPayable(updatedPayable);
        
        if (newStatus === 'paid') {
          toast.success('Payable marked as paid successfully!');
          sessionStorage.setItem('lastPaymentAction', Date.now().toString());
        }
      } else {
        toast.error('Failed to update payable status. Please try again.');
      }
    } catch {
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleMarkPaidConfirm = async (args: { txHash?: string; chainId?: number; paymentReference?: string; proofUrl?: string }) => {
    if (!payable) return;

    try {
      setUpdatingStatus(true);

      const result = await markPayableAsPaid({
        payableId,
        txHash: args.txHash,
        chainId: args.chainId,
        paymentReference: args.paymentReference,
        proofUrl: args.proofUrl,
      });

      if (result.success) {
        // Reload payable to get updated data
        await loadPayable();
        toast.success('Payable marked as paid successfully!');
        sessionStorage.setItem('lastPaymentAction', Date.now().toString());
      } else {
        toast.error(result.error || 'Failed to mark payable as paid');
      }
    } catch (error) {
      console.error('Error marking payable as paid:', error);
      toast.error('Failed to mark payable as paid. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeletePayable = async () => {
    if (!payable) return;

    if (!confirm('Are you sure you want to delete this payable? This action cannot be undone.')) {
      return;
    }

    try {
      const { deletePayable } = await import('@/app/actions/payable-actions');
      const result = await deletePayable(payableId);

      if (result.success) {
        router.push('/dashboard/services/payables?refresh=true');
      } else {
        toast.error(result.error || 'Failed to delete payable');
      }
    } catch (error) {
      console.error('Error deleting payable:', error);
      toast.error('Failed to delete payable. Please try again.');
    }
  };

  // Map payable to InvoicePdfData for receipt PDF (react-pdf)
  const payableToPdfData = (p: Payable): InvoicePdfData => {
    const addr = (r: Record<string, unknown> | undefined) => ({
      street: (r?.street as string) ?? '',
      city: (r?.city as string) ?? '',
      state: (r?.state as string) ?? '',
      zipCode: (r?.zipCode as string) ?? '',
      country: (r?.country as string) ?? '',
    });
    return {
      invoiceName: 'Payment Receipt',
      issueDate: p.issueDate,
      dueDate: p.dueDate,
      companyName: p.companyName ?? '',
      companyEmail: p.companyEmail ?? '',
      companyPhone: p.companyPhone ?? '',
      companyAddress: addr(p.companyAddress as Record<string, unknown> | undefined),
      clientName: p.vendorName ?? '',
      clientEmail: p.vendorEmail ?? '',
      clientPhone: p.vendorPhone ?? '',
      clientAddress: addr(p.vendorAddress as Record<string, unknown> | undefined),
      currency: p.currency ?? 'USD',
      paymentMethod: (p.paymentMethod === 'crypto' ? 'crypto' : 'fiat') as 'fiat' | 'crypto',
      paymentNetwork: p.paymentNetwork,
      paymentAddress: p.paymentAddress,
      items: (p.items ?? []).map((item) => ({
        id: item.id,
        description: item.description ?? '',
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        discount: item.discount ?? 0,
        tax: item.tax ?? 0,
        amount: item.amount ?? 0,
      })),
      subtotal: p.subtotal ?? 0,
      totalTax: p.totalTax ?? 0,
      total: p.total ?? 0,
      memo: p.memo,
    };
  };

  // Handle Receipt download (react-pdf)
  const handleDownloadReceipt = async () => {
    if (!payable) return;

    try {
      setDownloadingReceipt(true);
      const pdfData = payableToPdfData(payable);
      const blob = await generatePdfBlob(pdfData, payable.payableNumber ?? undefined, 'receipt');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${payable.payableNumber || 'payable'}_${payable.paymentDate ? new Date(payable.paymentDate).toLocaleDateString().replace(/\//g, '-') : new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download receipt. Please try again.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock3 className="h-4 w-4" />;
      case 'approved': return <CheckCircle2 className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock3 className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'urgent': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderAddress = (address?: Record<string, unknown>) => {
    if (!address) return null;
    const street = (address.street as string | undefined)?.trim() || '';
    const city = (address.city as string | undefined)?.trim() || '';
    const state = (address.state as string | undefined)?.trim() || '';
    const zipCode = (address.zipCode as string | undefined)?.trim() || '';
    const country = (address.country as string | undefined)?.trim() || '';

    const hasLine1 = !!street;
    const hasLine2 = city || state || zipCode;
    const hasLine3 = !!country;

    if (!hasLine1 && !hasLine2 && !hasLine3) return null;

    return (
      <div className="text-gray-600">
        {hasLine1 && <p>{street}</p>}
        {hasLine2 && (
          <p>
            {[city, state, zipCode].filter(Boolean).join(', ')}
          </p>
        )}
        {hasLine3 && <p>{country}</p>}
      </div>
    );
  };

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const getCurrencySymbol = useCallback(() => {
    if (!payable?.currency) return '';
    return getCurrencyByCode(payable.currency)?.symbol || payable.currency;
  }, [payable?.currency]);

  // Compute display name with invoice prefix (shortened)
  const displayPayableName = useMemo(() => {
    if (!payable) return '';
    
    // If payable has invoice number, shorten it to "Invoice Payment....{last4}"
    if (payable.invoiceNumber) {
      const invoiceNum = payable.invoiceNumber;
      const last4 = invoiceNum.length > 4 ? invoiceNum.slice(-4) : invoiceNum;
      return `Invoice Payment....${last4}`;
    }
    
    // Otherwise use the payable name as is
    return payable.payableName || 'Payable';
  }, [payable]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-blue-200">Loading payable...</p>
        </div>
      </div>
    );
  }

  if (error || !payable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Payable Not Found</h1>
          <p className="text-blue-200 mb-6">{error || 'The payable you are looking for does not exist or you do not have permission to view it.'}</p>
          <button
            onClick={() => router.push('/dashboard/services/payables?refresh=true')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payables
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-0 sm:h-16 gap-3 sm:gap-0">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <button
                onClick={() => router.push('/dashboard/services/payables?refresh=true')}
                className="p-2 text-blue-200 hover:text-white transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-semibold text-white truncate">{displayPayableName}</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(payable.status)}`}>
                {getStatusIcon(payable.status)}
                <span className="ml-1 capitalize">{payable.status}</span>
              </span>
              
              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getPriorityColor(payable.priority)}`}>
                <span className="capitalize">{payable.priority}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mobile: show Actions card at top for quick access */}
          <div className="lg:hidden">
            {/* Actions */}
            <div className="bg-white rounded-lg shadow-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
                  onClick={() => setShowMobileActions((v) => !v)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>{showMobileActions ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <div className={`space-y-3 ${showMobileActions ? '' : 'hidden'}`}>
                {(payable.status === 'pending' || payable.status === 'submitted') && (
                  <button
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{updatingStatus ? 'Updating...' : 'Approve Payable'}</span>
                  </button>
                )}
                
                {(payable.status === 'approved' || payable.status === 'pending' || payable.status === 'submitted') && (
                  <>
                    {(payable.paymentMethod === 'crypto' || payable.paymentMethodDetails?.method === 'crypto') && 
                     payable.paymentAddress && (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={updatingStatus}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                      >
                        <Wallet className="h-4 w-4" />
                        <span>Pay Now</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusUpdate('paid')}
                      disabled={updatingStatus}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingStatus ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span>{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
                    </button>
                  </>
                )}
                {payable.status === 'paid' && (
                  <button
                    onClick={handleDownloadReceipt}
                    disabled={downloadingReceipt}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingReceipt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    <span>{downloadingReceipt ? 'Generating...' : 'Download Receipt'}</span>
                  </button>
                )}
                
                <button
                  onClick={handleDeletePayable}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payable Document */}
            <div className="bg-white rounded-lg shadow-lg border">
              {/* Document Header */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                  {/* Left Side - Payable Name */}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">{displayPayableName}</h1>
                    {payable.payableNumber && (
                      <p className="text-lg text-gray-600 mt-2">Payable #: {payable.payableNumber}</p>
                    )}
                  </div>

                  {/* Right Side - Dates and Status */}
                  <div className="text-right">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">Issue Date</p>
                        <p className="font-medium text-gray-900">{formatDate(payable.issueDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Due Date</p>
                        <p className="font-medium text-gray-900">{formatDate(payable.dueDate)}</p>
                      </div>
                      {payable.paymentDate && (
                        <div>
                          <p className="text-sm text-gray-500">Payment Date</p>
                          <p className="font-medium text-gray-900">{formatDate(payable.paymentDate)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Company and Vendor Info */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
                {/* Mobile: collapsible From/To section */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between md:hidden mb-4 text-left"
                  onClick={() => setShowMobileParties((v) => !v)}
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parties</p>
                    <p className="text-sm text-gray-800">
                      {isVendorLinkPayable ? 'Vendor and your company' : 'Your company and vendor'}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transform transition-transform ${
                      showMobileParties ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left column: From */}
                  <div className={`${showMobileParties ? 'block' : 'hidden'} md:block`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                      {isVendorLinkPayable ? 'From (Vendor)' : 'From'}
                    </h3>
                    <div className="space-y-2">
                      {isVendorLinkPayable ? (
                        <>
                          <p className="font-medium text-gray-900">{payable.vendorName}</p>
                          <p className="text-gray-600">{payable.vendorEmail}</p>
                          {payable.vendorPhone && (
                            <p className="text-gray-600">{payable.vendorPhone}</p>
                          )}
                          {renderAddress(payable.vendorAddress as Record<string, unknown> | undefined)}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">{payable.companyName}</p>
                          <p className="text-gray-600">{payable.companyEmail}</p>
                          {payable.companyPhone && (
                            <p className="text-gray-600">{payable.companyPhone}</p>
                          )}
                          {renderAddress(payable.companyAddress as Record<string, unknown> | undefined)}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right column: To */}
                  <div className={`${showMobileParties ? 'block' : 'hidden'} md:block`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2 text-green-600" />
                      {isVendorLinkPayable ? 'To (Your company)' : 'To'}
                    </h3>
                    <div className="space-y-2">
                      {isVendorLinkPayable ? (
                        <>
                          <p className="font-medium text-gray-900">{payable.companyName}</p>
                          <p className="text-gray-600">{payable.companyEmail}</p>
                          {payable.companyPhone && (
                            <p className="text-gray-600">{payable.companyPhone}</p>
                          )}
                          {renderAddress(payable.companyAddress as Record<string, unknown> | undefined)}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">{payable.vendorName}</p>
                          <p className="text-gray-600">{payable.vendorEmail}</p>
                          {payable.vendorPhone && (
                            <p className="text-gray-600">{payable.vendorPhone}</p>
                          )}
                          {renderAddress(payable.vendorAddress as Record<string, unknown> | undefined)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 sm:p-8 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payable.items.map((item, index) => {
                        const currencySymbol = getCurrencySymbol();
                        return (
                          <tr key={`${item.id || index}-${item.description}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {currencySymbol}{item.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {currencySymbol}{item.amount.toFixed(2)}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 sm:p-8">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    {(() => {
                      const currencySymbol = getCurrencySymbol();
                      return (
                        <>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Subtotal:</span>
                      <span className="font-medium text-gray-900">
                        {currencySymbol}
                        {payable.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Tax:</span>
                      <span className="font-medium text-gray-900">
                        {currencySymbol}
                        {payable.totalTax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-gray-900">
                        {currencySymbol}
                        {payable.total.toFixed(2)}
                      </span>
                    </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {payable.memo && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-gray-600">{payable.memo}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                Payment Information
              </h3>
              
              <div className="space-y-4">
                {payable.externalInvoiceNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Invoice Number (Vendor)</p>
                    <p className="font-medium text-gray-900">{payable.externalInvoiceNumber}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">{payable.paymentMethod}</p>
                </div>

                {payable.paymentMethod === 'fiat' && payable.fiatPaymentSubtype && (
                  <div>
                    <p className="text-sm text-gray-500">Fiat Type</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {payable.fiatPaymentSubtype === 'mpesa_paybill'
                        ? 'M-Pesa Paybill'
                        : payable.fiatPaymentSubtype === 'mpesa_till'
                          ? 'M-Pesa Till'
                          : payable.fiatPaymentSubtype === 'phone'
                            ? 'Phone Number'
                            : 'Bank Transfer'}
                    </p>
                  </div>
                )}

                {payable.paymentPhoneNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="font-medium text-gray-900">{payable.paymentPhoneNumber}</p>
                  </div>
                )}

                {payable.bankName && (
                  <div>
                    <p className="text-sm text-gray-500">Bank Name</p>
                    <p className="font-medium text-gray-900">{payable.bankName}</p>
                  </div>
                )}

                {payable.accountName && (
                  <div>
                    <p className="text-sm text-gray-500">Account Name</p>
                    <p className="font-medium text-gray-900">{payable.accountName}</p>
                  </div>
                )}

                {payable.accountNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Account Number</p>
                    <p className="font-medium text-gray-900">{payable.accountNumber}</p>
                  </div>
                )}

                {payable.swiftCode && (
                  <div>
                    <p className="text-sm text-gray-500">SWIFT Code</p>
                    <p className="font-medium text-gray-900">{payable.swiftCode}</p>
                  </div>
                )}

                {payable.paybillNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Paybill Number</p>
                    <p className="font-medium text-gray-900">{payable.paybillNumber}</p>
                  </div>
                )}

                {payable.mpesaAccountNumber && (
                  <div>
                    <p className="text-sm text-gray-500">M-Pesa Account Number</p>
                    <p className="font-medium text-gray-900">{payable.mpesaAccountNumber}</p>
                  </div>
                )}

                {payable.tillNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Till Number</p>
                    <p className="font-medium text-gray-900">{payable.tillNumber}</p>
                  </div>
                )}

                {payable.businessName && (
                  <div>
                    <p className="text-sm text-gray-500">Business Name</p>
                    <p className="font-medium text-gray-900">{payable.businessName}</p>
                  </div>
                )}
                
                {payable.paymentNetwork && (
                  <div>
                    <p className="text-sm text-gray-500">Network</p>
                    <p className="font-medium text-gray-900">{payable.paymentNetwork}</p>
                  </div>
                )}
                
                {payable.paymentAddress && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Address</p>
                    <div className="flex items-center space-x-2">
                      <p className="font-mono text-sm text-gray-900 break-all">{payable.paymentAddress}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(payable.paymentAddress!)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {payable.vendorPaymentDetails && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Submitted payment instructions</p>
                    <div className="space-y-2 text-sm text-gray-700">
                      {Object.entries(payable.vendorPaymentDetails).map(([key, value]) => {
                        if (value === null || value === undefined || value === '') return null;
                        const display =
                          typeof value === 'string' || typeof value === 'number'
                            ? String(value)
                            : JSON.stringify(value);
                        return (
                          <div key={key} className="flex items-start justify-between gap-3">
                            <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-medium text-gray-900 text-right break-all">{display}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Transaction Hash (for paid crypto payables) */}
                {payable.status === 'paid' && payable.txHash && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Transaction Hash</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const chainId = payable.chainId || (payable.paymentMethodDetails?.cryptoDetails as { chainId?: number })?.chainId;
                        const explorerUrl = getExplorerUrl(payable.txHash, chainId);
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
                                {payable.txHash}
                              </code>
                              <ExternalLink className="h-4 w-4 flex-shrink-0" />
                            </a>
                          );
                        }
                        // If no explorer URL, just show the hash
                        return (
                          <code className="text-sm font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded break-all">
                            {payable.txHash}
                          </code>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500">Currency</p>
                  <p className="font-medium text-gray-900">{payable.currency || '—'}</p>
                </div>

                {payable.paymentReference && (
                  <div>
                    <p className="text-sm text-gray-500">Payment Reference</p>
                    <p className="font-medium text-gray-900 break-all">{payable.paymentReference}</p>
                  </div>
                )}

                {(payable.paymentDetails as { proofUrl?: string } | null | undefined)?.proofUrl && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Payment Proof</p>
                    <a
                      href={(payable.paymentDetails as { proofUrl: string }).proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      View uploaded proof
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payable.paymentStatus)}`}>
                    {getStatusIcon(payable.paymentStatus)}
                    <span className="ml-1 capitalize">{payable.paymentStatus}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Attached document (e.g. vendor invoice image/PDF) */}
            {(payable.invoiceFileUrl || (Array.isArray(payable.attachedFiles) && payable.attachedFiles.length > 0)) && (
              <div className="bg-white rounded-lg shadow-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  Attached document
                </h3>
                {payable.invoiceFileUrl && (
                  <div className="space-y-3">
                    <AttachmentCard
                      url={payable.invoiceFileUrl as string}
                      onOpen={(url) => {
                        setAttachmentUrl(url);
                        setAttachmentImgFailed(false);
                        setShowAttachmentModal(true);
                      }}
                    />
                  </div>
                )}
                {!payable.invoiceFileUrl && Array.isArray(payable.attachedFiles) && payable.attachedFiles.length > 0 && (
                  <p className="text-sm text-gray-600">
                    This payable has attached files that were added in the app.
                  </p>
                )}
              </div>
            )}

            {/* Actions (desktop sidebar only; mobile actions are shown at top) */}
            <div className="hidden lg:block bg-white rounded-lg shadow-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

              <div className="space-y-3">
                {(payable.status === 'pending' || payable.status === 'submitted') && (
                  <button
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{updatingStatus ? 'Updating...' : 'Approve Payable'}</span>
                  </button>
                )}
                
                {(payable.status === 'approved' || payable.status === 'pending' || payable.status === 'submitted') && (
                  <>
                    {/* Pay Now button for crypto payables */}
                    {(payable.paymentMethod === 'crypto' || payable.paymentMethodDetails?.method === 'crypto') && 
                     payable.paymentAddress && (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={updatingStatus}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                      >
                        <Wallet className="h-4 w-4" />
                        <span>Pay Now</span>
                      </button>
                    )}
                    {/* Mark as Paid button (for fiat or manual marking) */}
                  <button
                    onClick={() => handleStatusUpdate('paid')}
                    disabled={updatingStatus}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
                  </button>
                  </>
                )}
                {payable.status === 'paid' && (
                  <button
                    onClick={handleDownloadReceipt}
                    disabled={downloadingReceipt}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingReceipt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    <span>{downloadingReceipt ? 'Generating...' : 'Download Receipt'}</span>
                  </button>
                )}
                
                <button
                  onClick={handleDeletePayable}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Payment & attachment modals */}
      {payable && (
        <>
          {/* Mark as Paid Modal */}
          <MarkPaidModal
            isOpen={showMarkPaidModal}
            onClose={() => setShowMarkPaidModal(false)}
            onConfirm={handleMarkPaidConfirm}
            isCrypto={payable.paymentMethod === 'crypto'}
            payableId={payableId}
            chainId={(payable.paymentMethodDetails?.cryptoDetails as { chainId?: number })?.chainId || payable.chainId}
            network={payable.paymentMethodDetails?.network || payable.paymentNetwork}
          />

          <PayablePaymentModal
            isOpen={showPaymentModal}
            onCloseAction={() => setShowPaymentModal(false)}
            payable={payable}
            onPaymentSuccess={() => {
              loadPayable();
              setShowPaymentModal(false);
            }}
          />

          {showAttachmentModal && attachmentUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowAttachmentModal(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h2 className="text-sm font-medium text-gray-900">Attached document preview</h2>
                  <button
                    type="button"
                    onClick={() => setShowAttachmentModal(false)}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 bg-gray-50 flex items-center justify-center p-4 overflow-auto">
                  {!attachmentImgFailed && (attachmentUrl.includes('/api/files/') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(attachmentUrl)) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachmentUrl}
                      alt="Attached document"
                      className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm bg-white"
                      onError={() => setAttachmentImgFailed(true)}
                    />
                  ) : (
                    <iframe
                      src={attachmentUrl}
                      className="w-full h-[70vh] bg-white rounded-lg"
                      title="Attached document"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}