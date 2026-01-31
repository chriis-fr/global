'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Get the current session (server action).
 * Use this instead of GET /api/auth/session — no client API call.
 */
export async function getSessionAction() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}
