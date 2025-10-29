'use client';

import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { ApprovalWorkflow as ApprovalWorkflowType } from '@/types/approval';

interface ApprovalWorkflowProps {
  workflow: ApprovalWorkflowType;
  onApprovalDecision?: (workflowId: string, decision: 'approved' | 'rejected', comments?: string) => void;
  canApprove?: boolean;
  currentUserId?: string;
}

export function ApprovalWorkflow({ 
  workflow, 
  onApprovalDecision, 
  canApprove = false, 
  currentUserId 
}: ApprovalWorkflowProps) {
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprovalDecision = async (decision: 'approved' | 'rejected') => {
    if (!onApprovalDecision) return;

    setIsProcessing(true);
    try {
      await onApprovalDecision(workflow._id!, decision, comments);
      setComments('');
    } catch (error) {
      console.error('Error processing approval decision:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-400" />;
      case 'pending': return <Clock className="h-5 w-5 text-yellow-400" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getCurrentStep = () => {
    return workflow.approvals.find(step => step.stepNumber === workflow.currentStep);
  };

  // Removed unused helper to satisfy linting (covered by canCurrentUserApprove)

  const canCurrentUserApprove = () => {
    const currentStep = getCurrentStep();
    const currentApproverId = currentStep?.approverId?.toString();
    const userIdStr = currentUserId?.toString();
    const isApprover = currentStep && currentApproverId === userIdStr;
    const canApproveNow = canApprove && isApprover && workflow.status === 'pending';
    
    // Approval permission check
    
    return canApproveNow;
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Approval Workflow</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(workflow.status)} bg-white/10`}>
          {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
        </div>
      </div>

      {/* Payable Details */}
      {workflow.bill && (
        <div className="mb-6 p-4 bg-green-600/10 border border-green-500/30 rounded-lg">
          <h4 className="text-green-300 font-medium mb-3">Payable Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-green-200">Vendor:</span>
              <span className="text-white ml-2 font-medium">{workflow.bill.vendor || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-green-200">Amount:</span>
              <span className="text-white ml-2 font-medium">{workflow.bill.currency} {workflow.bill.amount?.toLocaleString() || '0'}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-green-200">Description:</span>
              <span className="text-white ml-2">{workflow.bill.description || 'No description'}</span>
            </div>
            {workflow.bill.dueDate && (
              <div>
                <span className="text-green-200">Due Date:</span>
                <span className="text-white ml-2">{new Date(workflow.bill.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {workflow.bill.category && (
              <div>
                <span className="text-green-200">Category:</span>
                <span className="text-white ml-2">{workflow.bill.category}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Progress */}
      <div className="mb-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
        <h4 className="text-blue-300 font-medium mb-2">Approval Progress</h4>
        <div className="text-sm">
          <span className="text-blue-200">Step {workflow.currentStep} of {workflow.approvals.length}</span>
          <span className="text-white ml-2">({workflow.approvals.length} approver{workflow.approvals.length !== 1 ? 's' : ''} required)</span>
        </div>
      </div>

      {/* Current Approver Actions */}
      {canCurrentUserApprove() && (
        <div className="mb-6 p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
          <h4 className="text-blue-300 font-medium mb-3">Your Approval Required</h4>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Add any comments about your decision..."
              rows={3}
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => handleApprovalDecision('approved')}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => handleApprovalDecision('rejected')}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="h-4 w-4" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* Approvers List */}
      <div className="space-y-2">
        <h4 className="text-white font-medium">Approvers</h4>
        {workflow.approvals.map((step, index) => (
          <div
            key={step._id || index}
            className={`p-3 rounded-lg border ${
              step.stepNumber === workflow.currentStep
                ? 'border-blue-500 bg-blue-600/10'
                : step.decision === 'approved'
                ? 'border-green-500 bg-green-600/10'
                : step.decision === 'rejected'
                ? 'border-red-500 bg-red-600/10'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(step.decision)}
                <span className="text-white font-medium">{step.approverEmail}</span>
                <span className="text-blue-200 text-sm">({step.approverRole})</span>
                {step.isFallback && (
                  <span className="text-yellow-400 text-xs">Fallback</span>
                )}
              </div>
              <div className="text-sm text-blue-200">
                Step {step.stepNumber}
              </div>
            </div>
            {step.comments && (
              <div className="mt-2 text-sm text-gray-300">
                &quot;{step.comments}&quot;
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
