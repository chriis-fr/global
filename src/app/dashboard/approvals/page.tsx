'use client';
import { useState, useEffect } from 'react';
import { Check, X, Eye, Clock, User, DollarSign, Calendar } from 'lucide-react';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';

interface PendingInvoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  submittedBy: {
    name: string;
    email: string;
    profilePicture?: string;
  };
  approvalWorkflow: {
    submittedAt: string;
    comments?: string;
  };
}

export default function ApprovalsPage() {
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch('/api/invoices/pending-approvals');
      const data = await response.json();
      
      if (data.success) {
        setPendingInvoices(data.data.pendingInvoices);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to load pending approvals' });
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      setMessage({ type: 'error', text: 'Failed to load pending approvals' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!selectedInvoice) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/invoices/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice._id,
          action,
          reason: action === 'reject' ? approvalReason : undefined,
          comments: approvalComments
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Invoice ${action === 'approve' ? 'approved' : 'rejected'} successfully!` 
        });
        setShowApprovalModal(false);
        setSelectedInvoice(null);
        setApprovalAction(null);
        setApprovalReason('');
        setApprovalComments('');
        await fetchPendingApprovals();
      } else {
        setMessage({ type: 'error', text: data.message || `Failed to ${action} invoice` });
      }
    } catch (error) {
      console.error(`Error ${action}ing invoice:`, error);
      setMessage({ type: 'error', text: `Failed to ${action} invoice. Please try again.` });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Pending Approvals</h1>
          <p className="text-blue-200">Review and approve invoices submitted by team members.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
          </div>
        </div>
        <DashboardFloatingButton />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Pending Approvals</h1>
        <p className="text-blue-200">
          Review and approve invoices submitted by team members. {pendingInvoices.length} pending approval.
        </p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-600/20 border border-green-500/50 text-green-200' 
            : 'bg-red-600/20 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {pendingInvoices.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
          <Clock className="h-16 w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Pending Approvals</h3>
          <p className="text-blue-200">
            All invoices have been reviewed. New submissions will appear here for approval.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingInvoices.map((invoice) => (
            <div key={invoice._id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    {invoice.submittedBy.profilePicture ? (
                      <img 
                        src={invoice.submittedBy.profilePicture} 
                        alt={invoice.submittedBy.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{invoice.submittedBy.name}</h3>
                    <p className="text-blue-200 text-sm">{invoice.submittedBy.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-yellow-600/20 text-yellow-300 text-sm rounded-full border border-yellow-500/50">
                    Pending Approval
                  </span>
                  <button
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setShowApprovalModal(true);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Review</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-300">Invoice:</span>
                  <span className="text-white ml-2 font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-blue-300">Client:</span>
                  <span className="text-white ml-2">{invoice.clientName}</span>
                </div>
                <div>
                  <span className="text-blue-300">Amount:</span>
                  <span className="text-white ml-2 font-medium">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-300">Due Date:</span>
                  <span className="text-white ml-2">{formatDate(invoice.dueDate)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-blue-200">
                  <span>Submitted on {formatDate(invoice.approvalWorkflow.submittedAt)}</span>
                  {invoice.approvalWorkflow.comments && (
                    <span className="text-blue-300">Has comments</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Review Invoice: {selectedInvoice.invoiceNumber}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-blue-300">Submitted by:</span>
                <span className="text-white">{selectedInvoice.submittedBy.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-300">Amount:</span>
                <span className="text-white font-medium">
                  {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-300">Client:</span>
                <span className="text-white">{selectedInvoice.clientName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-300">Due Date:</span>
                <span className="text-white">{formatDate(selectedInvoice.dueDate)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-blue-300 text-sm font-medium mb-2">
                  Comments (optional)
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add comments about this invoice..."
                  rows={3}
                />
              </div>

              {approvalAction === 'reject' && (
                <div>
                  <label className="block text-red-300 text-sm font-medium mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-red-500/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Explain why this invoice is being rejected..."
                    rows={3}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedInvoice(null);
                  setApprovalAction(null);
                  setApprovalReason('');
                  setApprovalComments('');
                }}
                className="px-4 py-2 text-blue-300 hover:text-white transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
              
              <button
                onClick={() => setApprovalAction('reject')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                disabled={processing}
              >
                <X className="h-4 w-4" />
                <span>Reject</span>
              </button>
              
              <button
                onClick={() => handleApproval('approve')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Approve</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <DashboardFloatingButton />
    </div>
  );
} 