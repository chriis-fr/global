"use server"

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { registerPullTransactions } from '@/lib/services/darajaPullTransactionsService';
import { isLocalhostUrl, resolvePublicBaseUrl } from '@/lib/utils/publicBaseUrl';

export interface RegisterPullTransactionsInput {
  organizationId: string;
  /** Optional override; normally read from organization settings. */
  shortCode?: string;
  /** Safaricom MSISDN in 2547XXXXXXXX format (recommended). */
  nominatedNumber: string;
  /** Optional override. If omitted, derived from public app base URL env vars. */
  callbackUrl?: string;
}

export async function registerC2B(input: RegisterPullTransactionsInput) {
  // NOTE: kept function name for backward compatibility with existing imports.
  const session = await getServerSession(authOptions);
  if (!session?.user?.adminTag) {
    return { success: false, error: 'Admin only' };
  }

  const callbackBase = resolvePublicBaseUrl();
  const callbackUrl = input.callbackUrl?.trim() || (callbackBase ? `${callbackBase}/api/mpesa/pulltransactions/callback` : '');
  if (!callbackUrl) {
    return { success: false, error: 'No callback URL available. Set FRONTEND_URL/NEXT_PUBLIC_BASE_URL or provide callbackUrl.' };
  }
  if (process.env.NODE_ENV === 'production' && isLocalhostUrl(callbackUrl)) {
    return { success: false, error: 'Production callback URL cannot be localhost.' };
  }

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