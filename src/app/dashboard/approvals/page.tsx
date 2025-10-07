'use client';

import { PendingApprovalsList } from '@/components/approval/PendingApprovalsList';
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
        <PendingApprovalsList />
      </ApprovalGuard>

      <DashboardFloatingButton />
    </div>
  );
}