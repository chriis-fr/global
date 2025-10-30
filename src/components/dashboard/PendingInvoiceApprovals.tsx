'use client'

import { useState, useEffect, useRef } from 'react';
import { approveInvoice, rejectInvoice, getPendingApprovals } from '@/lib/actions/invoiceApproval';
import { autoSendApprovedInvoice } from '@/lib/utils/autoSendInvoice';
import { CheckCircle, XCircle, Clock, DollarSign, User, Mail } from 'lucide-react';

interface PendingInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceName: string;
  total: number;
  currency: string;
  clientName: string;
  clientEmail: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  approvalCount: number;
  requiredApprovals: number;
  approvals: Array<{
    approverId: string;
    approverName: string;
    approverEmail: string;
    approvedAt: string;
    comments?: string;
  }>;
}

export default function PendingInvoiceApprovals() {
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchPendingApprovals();
    }
  }, []);

  const fetchPendingApprovals = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Check localStorage cache first
      const cacheKey = `invoice_approvals_${Date.now().toString().slice(0, -6)}`; // Cache by hour
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!forceRefresh && cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 10 minutes old
          if ((now - parsed.timestamp) < (10 * 60 * 1000)) {
            setPendingInvoices(parsed.invoices);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(cacheKey);
        }
      }

      const result = await getPendingApprovals();
      if (result.success && result.data) {
        setPendingInvoices(result.data as unknown as PendingInvoice[]);
        
        // Cache in localStorage
        const cacheData = {
          invoices: result.data as unknown as PendingInvoice[],
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } else {
        setPendingInvoices([]);
      }
    } catch {
      console.error('Error fetching pending invoice approvals');
      setPendingInvoices([]);
    } finally {
      setLoading(false);
    }
  };

         const handleApprove = async (invoiceId: string) => {
           try {
             setActionLoading(invoiceId);
             const result = await approveInvoice(invoiceId);
             
             if (result.success) {
               // Check if the invoice is fully approved and ready to send
               if (result.fullyApproved && result.invoiceData) {
                 console.log('🚀 [Auto-Send] Invoice fully approved, starting auto-send process...');
                 
                 // Show loading message
                 alert('✅ Invoice approved! Generating PDF and sending to recipient...');
                 
                 // Auto-send the invoice with PDF
                const autoSendResult = await autoSendApprovedInvoice(result.invoiceData as unknown as { _id: string; invoiceNumber: string; clientEmail: string; greetingName: string; total: number; currency: string; dueDate: string; companyName: string; clientName: string; paymentMethods: string[] });
                 
                 if (autoSendResult.success) {
                   alert(`🎉 ${autoSendResult.message}`);
                 } else {
                   alert(`⚠️ ${autoSendResult.message}`);
                 }
               } else {
                 // Regular approval (not fully approved yet)
                 alert(result.message);
               }
               
               // Remove from pending list
               setPendingInvoices(prev => prev.filter(invoice => invoice._id !== invoiceId));
               
               // Clear invoice approval cache since data has changed
               Object.keys(localStorage).forEach(key => {
                 if (key.startsWith('invoice_approvals_')) {
                   localStorage.removeItem(key);
                 }
               });
             } else {
               // Show more detailed error message for owners trying to approve their own invoices
               if (result.message.includes('cannot approve your own invoices')) {
                 alert('❌ You cannot approve your own invoices.\n\nPlease ask another admin or approver to review and approve this invoice. They will receive an email notification about this pending approval.\n\nNote: If your organization has insufficient approvers, you may be able to approve your own invoices to prevent deadlocks.');
               } else {
                 alert(result.message);
               }
             }
           } catch (error) {
             console.error('Error approving invoice:', error);
             alert('Failed to approve invoice');
           } finally {
             setActionLoading(null);
           }
         };

         const handleReject = async (invoiceId: string) => {
           const reason = prompt('Please provide a reason for rejection:');
           if (!reason) return;

           try {
             setActionLoading(invoiceId);
             const result = await rejectInvoice(invoiceId, reason);
             if (result.success) {
               // Remove from pending list
               setPendingInvoices(prev => prev.filter(invoice => invoice._id !== invoiceId));
               
               // Clear invoice approval cache since data has changed
               Object.keys(localStorage).forEach(key => {
                 if (key.startsWith('invoice_approvals_')) {
                   localStorage.removeItem(key);
                 }
               });
               
               alert(result.message);
             } else {
               // Show more detailed error message for owners trying to reject their own invoices
               if (result.message.includes('cannot reject your own invoices')) {
                 alert('❌ You cannot reject your own invoices.\n\nPlease ask another admin or approver to review this invoice. They will receive an email notification about this pending approval.\n\nNote: If your organization has insufficient approvers, you may be able to reject your own invoices to prevent deadlocks.');
               } else {
                 alert(result.message);
               }
             }
           } catch (error) {
             console.error('Error rejecting invoice:', error);
             alert('Failed to reject invoice');
           } finally {
             setActionLoading(null);
           }
         };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-white/20 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-white/20 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-white/20 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Don't render anything if there are no pending approvals (but only after loading is complete)
  if (!loading && pendingInvoices.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-yellow-500" />
          Pending Invoice Approvals ({pendingInvoices.length})
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {pendingInvoices.map((invoice) => (
          <div key={invoice._id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    {invoice.invoiceName}
                  </h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    <span className="font-medium text-gray-900">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    <span>{invoice.clientName}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    <span>{invoice.clientEmail}</span>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  Created: {formatDate(invoice.createdAt)} by {invoice.createdByName} ({invoice.createdByEmail})
                </div>
                
                {/* Approval Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Approval Progress:</span>
                    <span className="font-medium text-gray-900">
                      {invoice.approvalCount}/{invoice.requiredApprovals}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(invoice.approvalCount / invoice.requiredApprovals) * 100}%` }}
                    ></div>
                  </div>
                  {invoice.approvalCount > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Approved by: {invoice.approvals.map(approval => approval.approverName).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => handleApprove(invoice._id)}
                  disabled={actionLoading === invoice._id}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {actionLoading === invoice._id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  Approve
                </button>
                
                <button
                  onClick={() => handleReject(invoice._id)}
                  disabled={actionLoading === invoice._id}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {actionLoading === invoice._id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
