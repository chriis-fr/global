'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, User, Calendar, Eye, CheckCircle, XCircle } from 'lucide-react';
import { ApprovalWorkflow } from '@/types/approval';
import { ApprovalWorkflow as ApprovalWorkflowComponent } from './ApprovalWorkflow';
import { useSession } from 'next-auth/react';

interface PendingApprovalsListProps {
  onApprovalDecision?: (workflowId: string, decision: 'approved' | 'rejected', comments?: string) => void;
}

interface EnrichedApproval extends ApprovalWorkflow {
  bill: {
    _id: string;
    vendor: string;
    amount: number;
    currency: string;
    description: string;
    category: string;
    dueDate: string;
    createdAt: string;
  } | null;
}

export function PendingApprovalsList({ onApprovalDecision }: PendingApprovalsListProps) {
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<EnrichedApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<EnrichedApproval | null>(null);
  const hasInitialized = useRef(false);

  const fetchPendingApprovals = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check localStorage cache first
      const cacheKey = `approvals_${session?.user?.email}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!forceRefresh && cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 10 minutes old (approvals change more frequently)
          if ((now - parsed.timestamp) < (10 * 60 * 1000)) {
            setApprovals(parsed.approvals);
            setLoading(false);
            return;
          }
        } catch {
          // If cache is corrupted, remove it and fetch fresh
          localStorage.removeItem(cacheKey);
        }
      }

      const response = await fetch('/api/organization/approvals');
      const data = await response.json();

      if (data.success) {
        setApprovals(data.data);
        
        // Cache in localStorage
        const cacheData = {
          approvals: data.data,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } else {
        setError(data.message || 'Failed to fetch pending approvals');
      }
    } catch {
      console.error('Error fetching pending approvals');
      setError('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  const handleApprovalDecision = async (workflowId: string, decision: 'approved' | 'rejected', comments?: string) => {
    try {
      const response = await fetch('/api/organization/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          decision,
          comments
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state instead of refetching
        setApprovals(prevApprovals => 
          prevApprovals.filter(approval => approval._id !== workflowId)
        );
        
        // Clear approval cache since data has changed
        const cacheKey = `approvals_${session?.user?.email}`;
        localStorage.removeItem(cacheKey);
        
        // Close the detail view
        setSelectedApproval(null);
        
        // Call the parent callback if provided
        if (onApprovalDecision) {
          onApprovalDecision(workflowId, decision, comments);
        }
      } else {
        throw new Error(data.message || 'Failed to process approval decision');
      }
    } catch (err) {
      console.error('Error processing approval decision:', err);
      setError(err instanceof Error ? err.message : 'Failed to process approval decision');
    }
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchPendingApprovals();
    }
  }, [fetchPendingApprovals]);

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

  if (error) {
    return (
      <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <XCircle className="h-6 w-6 text-red-400" />
          <div>
            <h3 className="text-red-300 font-medium">Error Loading Approvals</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchPendingApprovals()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && approvals.length === 0) {
    return (
      <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-6 text-center">
        <CheckCircle className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-blue-300 font-medium mb-2">No Pending Approvals</h3>
        <p className="text-blue-200 text-sm">
          You have no bills waiting for your approval at the moment.
        </p>
      </div>
    );
  }

  if (selectedApproval) {
    return (
      <div>
        <button
          onClick={() => setSelectedApproval(null)}
          className="mb-4 flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>← Back to List</span>
        </button>
        <ApprovalWorkflowComponent
          workflow={selectedApproval}
          onApprovalDecision={handleApprovalDecision}
          canApprove={true}
          currentUserId={session?.user?.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <span className="text-blue-200 text-sm">
          {approvals.length} bill{approvals.length !== 1 ? 's' : ''} waiting
        </span>
      </div>

      {approvals.map((approval) => (
        <div
          key={approval._id}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/15 transition-colors cursor-pointer"
          onClick={() => setSelectedApproval(approval)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-yellow-400" />
              <div>
                <h3 className="text-white font-medium">
                  {approval.bill?.vendor || 'Unknown Vendor'}
                </h3>
                <p className="text-blue-200 text-sm">
                  {approval.bill?.description || 'No description'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold">
                {approval.bill?.currency} {approval.bill?.amount?.toLocaleString()}
              </div>
              <div className="text-blue-200 text-sm">
                Step {approval.currentStep} of {approval.approvals.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-blue-400" />
              <span className="text-blue-200">Current Approver:</span>
              <span className="text-white">
                {approval.approvals.find(a => a.stepNumber === approval.currentStep)?.approverEmail || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-blue-200">Due:</span>
              <span className="text-white">
                {approval.bill?.dueDate ? new Date(approval.bill.dueDate).toLocaleDateString() : 'Not set'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-blue-200 text-sm">Click to view details and approve</span>
            </div>
            <div className="text-xs text-gray-400">
              Created {new Date(approval.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
