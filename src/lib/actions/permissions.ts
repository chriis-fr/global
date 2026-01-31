'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import type { OrganizationMember } from '@/models/Organization';

export type PermissionsResult = {
  permissions: {
    canManageTreasury: boolean;
    canManageTeam: boolean;
    canManageSettings: boolean;
    canCreateBills: boolean;
    canApproveBills: boolean;
    canExecutePayments: boolean;
    canViewFinancialData: boolean;
    canExportData: boolean;
    canMarkInvoiceAsPaid: boolean;
  };
  member: (OrganizationMember & { approvalLimits?: { maxAmount: number; requiresDualApproval: boolean } }) | null;
} | null;

/**
 * Get the current user's permissions (server action).
 * Use this instead of GET /api/user/permissions to avoid extra API round-trips.
 */
export async function getPermissions(): Promise<PermissionsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email,
    });

    if (!user) return null;

    if (!user.organizationId) {
      return {
        permissions: {
          canManageTreasury: true,
          canManageTeam: true,
          canManageSettings: true,
          canCreateBills: true,
          canApproveBills: true,
          canExecutePayments: true,
          canViewFinancialData: true,
          canExportData: true,
          canMarkInvoiceAsPaid: true,
        },
        member: null,
      };
    }

    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId,
    });

    if (!organization) return null;

    const member = organization.members.find(
      (m: { userId: { toString: () => string } }) => m.userId.toString() === user._id?.toString()
    );
    if (!member) return null;

    const permissions = {
      canManageTreasury: RBACService.canManageTreasury(member),
      canManageTeam: RBACService.canManageTeam(member),
      canManageSettings: RBACService.canManageSettings(member),
      canCreateBills: RBACService.canCreateBills(member),
      canApproveBills: RBACService.canApproveBills(member),
      canExecutePayments: RBACService.canExecutePayments(member),
      canViewFinancialData: RBACService.hasPermission(member, 'read', 'transaction'),
      canExportData: RBACService.hasPermission(member, 'export', 'report'),
      canMarkInvoiceAsPaid: RBACService.canMarkInvoiceAsPaid(member),
    };

    const approvalLimits = RBACService.getApprovalLimits(member);

    return {
      permissions,
      member: {
        ...member,
        approvalLimits,
      } as OrganizationMember & { approvalLimits: { maxAmount: number; requiresDualApproval: boolean } },
    };
  } catch {
    return null;
  }
}
