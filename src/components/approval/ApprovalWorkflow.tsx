'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, MessageSquare, Calendar } from 'lucide-react';
import { ApprovalWorkflow as ApprovalWorkflowType, ApprovalStep } from '@/types/approval';

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

  const isCurrentUserApprover = () => {
    const currentStep = getCurrentStep();
    return currentStep && currentStep.approverId === currentUserId;
  };

  const canCurrentUserApprove = () => {
    return canApprove && isCurrentUserApprover() && workflow.status === 'pending';
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Approval Workflow</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(workflow.status)} bg-white/10`}>
          {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
        </div>
      </div>

      {/* Workflow Rules Applied */}
      <div className="mb-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
        <h4 className="text-blue-300 font-medium mb-2">Applied Rules</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-200">Amount Threshold:</span>
            <span className="text-white ml-2 capitalize">{workflow.appliedRules.amountThreshold}</span>
          </div>
          <div>
            <span className="text-blue-200">Required Approvers:</span>
            <span className="text-white ml-2">{workflow.appliedRules.requiredApprovers}</span>
          </div>
          <div>
            <span className="text-blue-200">Auto-Approved:</span>
            <span className="text-white ml-2">{workflow.appliedRules.autoApproved ? 'Yes' : 'No'}</span>
          </div>
          {workflow.appliedRules.reason && (
            <div className="col-span-2">
              <span className="text-blue-200">Reason:</span>
              <span className="text-white ml-2">{workflow.appliedRules.reason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Approval Steps */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Approval Steps</h4>
        {workflow.approvals.map((step, index) => (
          <div
            key={step._id || index}
            className={`p-4 rounded-lg border ${
              step.stepNumber === workflow.currentStep
                ? 'border-blue-500 bg-blue-600/10'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon(step.decision)}
                <div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-400" />
                    <span className="text-white font-medium">{step.approverEmail}</span>
                    <span className="text-blue-200 text-sm">({step.approverRole})</span>
                  </div>
                  {step.isFallback && (
                    <span className="text-yellow-400 text-xs">Fallback Approver</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-200">
                  Step {step.stepNumber} of {workflow.approvals.length}
                </div>
                {step.completedAt && (
                  <div className="text-xs text-gray-400">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(step.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {step.comments && (
              <div className="mt-3 p-3 bg-white/5 rounded-lg">
                <div className="flex items-start space-x-2">
                  <MessageSquare className="h-4 w-4 text-blue-400 mt-0.5" />
                  <div>
                    <div className="text-blue-200 text-sm font-medium">Comments:</div>
                    <div className="text-white text-sm">{step.comments}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Step Actions */}
            {step.stepNumber === workflow.currentStep && canCurrentUserApprove() && (
              <div className="mt-4 p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                <h5 className="text-blue-300 font-medium mb-3">Your Approval Required</h5>
                
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
          </div>
        ))}
      </div>

      {/* Workflow Timeline */}
      <div className="mt-6 pt-6 border-t border-white/20">
        <h4 className="text-white font-medium mb-3">Timeline</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-200">Created:</span>
            <span className="text-white">
              {new Date(workflow.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-200">Last Updated:</span>
            <span className="text-white">
              {new Date(workflow.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
