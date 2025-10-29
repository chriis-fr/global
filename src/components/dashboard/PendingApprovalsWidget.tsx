'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Eye, CheckCircle } from 'lucide-react';
import { usePermissions } from '@/lib/contexts/PermissionContext';
import { ApprovalWorkflow } from '@/types/approval';

interface PendingApprovalsWidgetProps {
  limit?: number;
}

interface EnrichedApproval extends ApprovalWorkflow {
  bill: {
    _id: string;
    vendor: string;
    amount: number;
    currency: string;
    description: string;
    dueDate: string;
  } | null;
}

export function PendingApprovalsWidget({ limit = 3 }: PendingApprovalsWidgetProps) {
  const { permissions } = usePermissions();
  const [approvals, setApprovals] = useState<EnrichedApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    if (!permissions.canApproveBills) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/organization/approvals');
      const data = await response.json();

      if (data.success) {
        setApprovals(data.data.slice(0, limit));
      } else {
        setError(data.message || 'Failed to fetch pending approvals');
      }
    } catch {
      console.error('Error fetching pending approvals');
      setError('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  }, [permissions.canApproveBills, limit]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  if (!permissions.canApproveBills) {
    return null; // Don't show widget if user can't approve
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Clock className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-white/20 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-red-400" />
          <div>
            <h3 className="text-red-300 font-medium">Error Loading Approvals</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
        </div>
        <p className="text-blue-200 text-sm">
          No bills waiting for your approval.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
        </div>
        <a
          href="/dashboard/approvals"
          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          View All
        </a>
      </div>

      <div className="space-y-3">
        {approvals.map((approval) => (
          <div
            key={approval._id}
            className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => window.location.href = `/dashboard/approvals/${approval._id}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm">
                  {approval.bill?.vendor || 'Unknown Vendor'}
                </h4>
                <p className="text-blue-200 text-xs">
                  {approval.bill?.description || 'No description'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-sm">
                  {approval.bill?.currency} {approval.bill?.amount?.toLocaleString()}
                </div>
                <div className="text-blue-200 text-xs">
                  Step {approval.currentStep}/{approval.approvals.length}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3 text-blue-400" />
                <span className="text-blue-200 text-xs">Click to review</span>
              </div>
              <div className="text-xs text-gray-400">
                {approval.bill?.dueDate ? new Date(approval.bill.dueDate).toLocaleDateString() : 'No due date'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {approvals.length >= limit && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <a
            href="/dashboard/approvals"
            className="block text-center text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            View all pending approvals →
          </a>
        </div>
      )}
    </div>
  );
}
