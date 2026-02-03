'use client';

import { useSession } from '@/lib/auth-client';
import { PendingApprovalsList } from '@/components/approval/PendingApprovalsList';
import PendingInvoiceApprovals from '@/components/dashboard/PendingInvoiceApprovals';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { ApprovalGuard } from '@/components/PermissionGuard';

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const services = (session?.user as { services?: Record<string, boolean> })?.services;
  const hasSmartInvoicing = services?.smartInvoicing === true;
  const hasAccountsPayable = services?.accountsPayable === true;

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
          {/* Invoice Approvals - only when subscribed to Smart Invoicing */}
          {hasSmartInvoicing && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Pending Invoice Approvals</h2>
              <PendingInvoiceApprovals />
            </div>
          )}

          {/* Bill Approvals - only when subscribed to Accounts Payable */}
          {hasAccountsPayable && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Pending Bill Approvals</h2>
              <PendingApprovalsList />
            </div>
          )}

          {!hasSmartInvoicing && !hasAccountsPayable && (
            <p className="text-blue-200">
              You don’t have any services that use approvals. Enable Smart Invoicing or Accounts Payable to see pending approvals here.
            </p>
          )}
        </div>
      </ApprovalGuard>

      <DashboardFloatingButton />
    </div>
  );
}