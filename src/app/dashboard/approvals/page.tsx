'use client';

import { PendingApprovalsList } from '@/components/approval/PendingApprovalsList';
import PendingInvoiceApprovals from '@/components/dashboard/PendingInvoiceApprovals';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { ApprovalGuard } from '@/components/PermissionGuard';

export default function ApprovalsPage() {

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
          
          {/* Bill Approvals - Always show for organizations, check for actual pending approvals */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Pending Bill Approvals</h2>
            <PendingApprovalsList />
          </div>
        </div>
      </ApprovalGuard>

      <DashboardFloatingButton />
    </div>
  );
}