import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { randomBytes } from 'crypto';

const CLICKUP_AUTH_URL = 'https://app.clickup.com/api';

/**
 * GET /api/integrations/clickup/connect
 * Redirects the user to ClickUp OAuth authorization page.
 * Requires: CLICKUP_CLIENT_ID and CLICKUP_REDIRECT_URI in env.
 */
export async function GET(request: NextRequest) {
  console.log('[ClickUp Connect] GET /api/integrations/clickup/connect called');

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    console.log('[ClickUp Connect] No session, redirecting to /auth');
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  console.log('[ClickUp Connect] Session OK, user:', session.user.email);

  const clientId = process.env.CLICKUP_CLIENT_ID;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.warn('[ClickUp Connect] Missing env – has CLICKUP_CLIENT_ID:', !!clientId, 'has CLICKUP_REDIRECT_URI:', !!redirectUri);
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations/clickup?error=config', request.url)
    );
  }

  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `${CLICKUP_AUTH_URL}?${params.toString()}`;
  console.log('[ClickUp Connect] Redirecting user to ClickUp OAuth URL');
  return NextResponse.redirect(authUrl);
}
