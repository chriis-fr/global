'use client';

import React, { useState, useEffect } from 'react';
import { Plus, FileText, DollarSign, Calendar, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BillCreationForm } from '@/components/approval/BillCreationForm';
import { ApprovalWorkflow } from '@/components/approval/ApprovalWorkflow';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { BillCreationGuard } from '@/components/PermissionGuard';
import { usePermissions } from '@/lib/contexts/PermissionContext';

interface Bill {
  _id: string;
  vendor: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  dueDate: string;
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  paymentStatus: 'pending' | 'scheduled' | 'completed' | 'failed';
  createdAt: string;
  approvalWorkflow?: any;
}

export default function BillsPage() {
  const { permissions } = usePermissions();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/bills');
      const data = await response.json();

      if (data.success) {
        setBills(data.data);
      } else {
        setError(data.message || 'Failed to fetch bills');
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError('Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  const handleBillCreated = () => {
    setShowCreateForm(false);
    fetchBills(); // Refresh the list
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending_approval': return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-400" />;
      default: return <FileText className="h-4 w-4 text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'pending_approval': return 'text-yellow-400';
      case 'paid': return 'text-green-400';
      default: return 'text-blue-400';
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Bills</h1>
          <p className="text-blue-200">Manage your organization's bills and payments</p>
        </div>
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Bills</h1>
          <p className="text-blue-200">Manage your organization's bills and payments</p>
        </div>
        <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <XCircle className="h-6 w-6 text-red-400" />
            <div>
              <h3 className="text-red-300 font-medium">Error Loading Bills</h3>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchBills}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (selectedBill) {
    return (
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => setSelectedBill(null)}
          className="mb-4 flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>← Back to Bills</span>
        </button>
        {selectedBill.approvalWorkflow && (
          <ApprovalWorkflow
            workflow={selectedBill.approvalWorkflow}
            canApprove={permissions.canApproveBills}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Bills</h1>
            <p className="text-blue-200">Manage your organization's bills and payments</p>
          </div>
          <BillCreationGuard>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Bill</span>
            </button>
          </BillCreationGuard>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-8">
          <BillCreationForm
            onSubmit={handleBillCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {bills.length === 0 ? (
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-6 text-center">
          <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-blue-300 font-medium mb-2">No Bills Found</h3>
          <p className="text-blue-200 text-sm mb-4">
            {permissions.canCreateBills 
              ? "Create your first bill to get started with the approval workflow."
              : "No bills have been created yet."
            }
          </p>
          {permissions.canCreateBills && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Bill</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {bills.map((bill) => (
            <div
              key={bill._id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/15 transition-colors cursor-pointer"
              onClick={() => setSelectedBill(bill)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(bill.approvalStatus)}
                  <div>
                    <h3 className="text-white font-medium">{bill.vendor}</h3>
                    <p className="text-blue-200 text-sm">{bill.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    {bill.currency} {bill.amount.toLocaleString()}
                  </div>
                  <div className={`text-sm ${getStatusColor(bill.approvalStatus)}`}>
                    {bill.approvalStatus.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-200">Due:</span>
                  <span className="text-white">
                    {new Date(bill.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-200">Category:</span>
                  <span className="text-white capitalize">{bill.category}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-200 text-sm">Click to view details</span>
                </div>
                <div className="text-xs text-gray-400">
                  Created {new Date(bill.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DashboardFloatingButton />
    </div>
  );
}
