'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CurrencyService } from '@/lib/services/currencyService';
import { UserService } from '@/lib/services/userService';

export type PreferredCurrencyResult = {
  preferredCurrency: string;
  symbol: string;
} | null;

/**
 * Get the current user's preferred currency (server action).
 * Use this instead of GET /api/currency/convert to avoid extra API round-trips.
 * Call once per session and cache on client; layout can preload and pass as initial data.
 */
export async function getPreferredCurrency(): Promise<PreferredCurrencyResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) return null;

    const preferredCurrency = user.preferences?.currency || 'USD';
    const symbol = CurrencyService.getCurrencySymbol(preferredCurrency);

    return { preferredCurrency, symbol };
  } catch {
    return null;
  }
}
