'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { PendingApprovalsList } from '@/components/approval/PendingApprovalsList';
import PendingInvoiceApprovals from '@/components/dashboard/PendingInvoiceApprovals';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { ApprovalGuard } from '@/components/PermissionGuard';
import { Settings, ArrowRight } from 'lucide-react';

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const services = (session?.user as { services?: Record<string, boolean> })?.services;
  const hasSmartInvoicing = services?.smartInvoicing === true;
  const hasAccountsPayable = services?.accountsPayable === true;
  const hasApprovalRelevantService = hasSmartInvoicing || hasAccountsPayable;
  const hasOrganization = !!session?.user?.organizationId;

  const [approvalSettingsLoaded, setApprovalSettingsLoaded] = useState(false);
  const [approvalRequireEnabled, setApprovalRequireEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasOrganization || !hasApprovalRelevantService) {
      setApprovalSettingsLoaded(true);
      return;
    }
    let cancelled = false;
    fetch('/api/organization/approval-settings')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setApprovalRequireEnabled(data.success && data.data?.requireApproval === true);
      })
      .catch(() => {
        if (!cancelled) setApprovalRequireEnabled(null);
      })
      .finally(() => {
        if (!cancelled) setApprovalSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasOrganization, hasApprovalRelevantService]);

  const showSetupNotice = hasOrganization && hasApprovalRelevantService && approvalSettingsLoaded && approvalRequireEnabled === false;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Approvals</h1>
        <p className="text-blue-200">
          Review and approve bills and payment requests
        </p>
      </div>

      {showSetupNotice && (
        <div className="mb-6 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <Settings className="h-5 w-5 text-blue-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-100">You haven’t set up approvals yet</p>
            <p className="text-xs text-blue-200/90 mt-0.5">
              Configure approval workflows in Organization Settings to start receiving approval requests here.
            </p>
          </div>
          <Link
            href="/dashboard/settings/organization#approval-settings"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shrink-0"
          >
            <span>Open Organization Settings</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

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