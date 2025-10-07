'use client';

import { PendingApprovalsList } from '@/components/approval/PendingApprovalsList';
import PendingInvoiceApprovals from '@/components/dashboard/PendingInvoiceApprovals';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { ApprovalGuard } from '@/components/PermissionGuard';
import { useState, useEffect } from 'react';

export default function ApprovalsPage() {
  const [hasPayables, setHasPayables] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPayables = async () => {
      try {
        const response = await fetch('/api/user/settings');
        const data = await response.json();
        
        if (data.success && data.organizationData?.subscription?.planId) {
          const planId = data.organizationData.subscription.planId;
          setHasPayables(planId.includes('payables') || planId.includes('combined'));
        }
      } catch (error) {
        console.error('Error checking payables:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPayables();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Approvals</h1>
        <p className="text-blue-200">
          Review and approve bills and payment requests
        </p>
      </div>

      <ApprovalGuard>
        <div className="space-y-8">
          {/* Invoice Approvals */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Pending Invoice Approvals</h2>
            <PendingInvoiceApprovals />
          </div>
          
          {/* Bill Approvals - Only show if organization has payables */}
          {hasPayables && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Pending Bill Approvals</h2>
              <PendingApprovalsList />
            </div>
          )}
        </div>
      </ApprovalGuard>

      <DashboardFloatingButton />
    </div>
  );
}