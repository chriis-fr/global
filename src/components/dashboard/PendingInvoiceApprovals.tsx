'use client'

import { useState, useEffect } from 'react';
import { approveInvoice, rejectInvoice, getPendingApprovals } from '@/lib/actions/invoiceApproval';
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
}

export default function PendingInvoiceApprovals() {
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const result = await getPendingApprovals();
      console.log('🔍 [PendingInvoiceApprovals] Fetch result:', result);
      if (result.success && result.data) {
        setPendingInvoices(result.data);
        console.log('✅ [PendingInvoiceApprovals] Set pending invoices:', result.data);
      } else {
        console.log('❌ [PendingInvoiceApprovals] Failed to fetch or no data:', result.message);
      }
    } catch (error) {
      console.error('❌ [PendingInvoiceApprovals] Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (invoiceId: string) => {
    try {
      setActionLoading(invoiceId);
      const result = await approveInvoice(invoiceId);
      if (result.success) {
        // Remove from pending list
        setPendingInvoices(prev => prev.filter(invoice => invoice._id !== invoiceId));
        alert(result.message);
      } else {
        alert(result.message);
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
        alert(result.message);
      } else {
        alert(result.message);
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (pendingInvoices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No pending invoice approvals</p>
          </div>
        </div>
      </div>
    );
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
                  Created: {formatDate(invoice.createdAt)}
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
