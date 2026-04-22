"use server"

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { registerPullTransactions } from '@/lib/services/darajaPullTransactionsService';

export interface RegisterPullTransactionsInput {
  organizationId: string;
  /** Optional override; normally read from organization settings. */
  shortCode?: string;
  /** Safaricom MSISDN in 2547XXXXXXXX format (recommended). */
  nominatedNumber: string;
  /** Optional override. Default is `http://localhost:3000/api/mpesa/pulltransactions/callback`. */
  callbackUrl?: string;
}

export async function registerC2B(input: RegisterPullTransactionsInput) {
  // NOTE: kept function name for backward compatibility with existing imports.
  const session = await getServerSession(authOptions);
  if (!session?.user?.adminTag) {
    return { success: false, error: 'Admin only' };
  }

  const callbackUrl = input.callbackUrl?.trim() || 'http://localhost:3000/api/mpesa/pulltransactions/callback';

  try {
    const result = await registerPullTransactions({
      organizationId: input.organizationId,
      shortCode: input.shortCode,
      nominatedNumber: input.nominatedNumber,
      callbackUrl,
    });
    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register pull transactions',
    };
  }
}

export default registerC2B;