import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { registerPullTransactions } from '@/lib/services/darajaPullTransactionsService';
import { isLocalhostUrl, resolvePublicBaseUrl } from '@/lib/utils/publicBaseUrl';

/**
 * POST /api/mpesa/pulltransactions/register
 *
 * Registers an organization's shortcode for Pull Transactions (one-time operation).
 * Admin-only (global admin dashboard).
 *
 * Body: { organizationId, shortCode?, nominatedNumber, callbackUrl? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = String(body?.organizationId || '').trim();
    const nominatedNumber = String(body?.nominatedNumber || '').trim();
    const shortCode = body?.shortCode ? String(body.shortCode).trim() : undefined;
    const requestedCallbackUrl = String(body?.callbackUrl || '').trim();
    const fallbackBase = resolvePublicBaseUrl({ requestOrigin: req.nextUrl.origin });
    const callbackUrl = requestedCallbackUrl || (fallbackBase ? `${fallbackBase}/api/mpesa/pulltransactions/callback` : '');

    if (!organizationId) return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
    if (!nominatedNumber) return NextResponse.json({ success: false, error: 'nominatedNumber is required' }, { status: 400 });
    if (!callbackUrl) {
      return NextResponse.json(
        { success: false, error: 'No callback URL available. Set FRONTEND_URL/NEXT_PUBLIC_BASE_URL or provide callbackUrl.' },
        { status: 400 }
      );
    }
    if (process.env.NODE_ENV === 'production' && isLocalhostUrl(callbackUrl)) {
      return NextResponse.json(
        { success: false, error: 'Production callback URL cannot be localhost.' },
        { status: 400 }
      );
    }

    const result = await registerPullTransactions({
      organizationId,
      shortCode,
      nominatedNumber,
      callbackUrl,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[pulltransactions register] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

