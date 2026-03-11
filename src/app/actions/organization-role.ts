'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';

/**
 * Get the current user's organization role (owner/admin/financeManager/accountant/approver/waiter)
 * and whether the organization has M-Pesa enabled.
 *
 * Used by the dashboard sidebar to tailor which services are visible for each member.
 */
export async function getCurrentOrganizationRole(): Promise<{
  success: boolean;
  data?: { role: string | null; mpesaEnabled: boolean };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.organizationId) {
      return { success: true, data: { role: null, mpesaEnabled: false } };
    }

    const org = await OrganizationService.getOrganizationById(session.user.organizationId);
    if (!org) {
      return { success: true, data: { role: null, mpesaEnabled: false } };
    }

    const member = org.members.find((m) => m.userId.toString() === session.user.id);
    const role = member?.role ?? null;
    const mpesaEnabled = org.settings?.mpesa?.enabled === true;

    return { success: true, data: { role, mpesaEnabled } };
  } catch (error) {
    console.error('[getCurrentOrganizationRole] Error:', error);
    return {
      success: false,
      error: 'Failed to get organization role',
    };
  }
}

