import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

const CLICKUP_TOKEN_URL = 'https://api.clickup.com/api/v2/oauth/token';

function ensureAbsoluteUrl(base: string): string {
  const trimmed = (base || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export async function GET(request: NextRequest) {
  console.log('[ClickUp Callback] GET /api/integrations/clickup/callback called');

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    console.log('[ClickUp Callback] No session, redirecting to /auth');
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const errorParam = request.nextUrl.searchParams.get('error');
  const state = request.nextUrl.searchParams.get('state');
  console.log('[ClickUp Callback] Query params – has code:', !!code, 'error:', errorParam ?? 'none', 'state:', state ?? 'none');

  // When callback is hit on localhost, redirect back to localhost; otherwise use env base URL (e.g. production).
  const origin = request.nextUrl.origin;
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(origin) || origin.includes('127.0.0.1');
  const baseUrl = isLocalhost
    ? origin
    : (ensureAbsoluteUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.FRONTEND_URL || '') || ensureAbsoluteUrl(origin) || origin);
  const successRedirect = `${baseUrl.replace(/\/$/, '')}/dashboard/settings/integrations/clickup?connected=1`;
  const failRedirect = `${baseUrl.replace(/\/$/, '')}/dashboard/settings/integrations/clickup?error=1`;

  if (errorParam || !code) {
    console.log('[ClickUp Callback] Missing code or error from ClickUp, redirecting to fail – error:', errorParam);
    return NextResponse.redirect(new URL(failRedirect));
  }

  const clientId = process.env.CLICKUP_CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn('[ClickUp Callback] Missing env – clientId:', !!clientId, 'clientSecret:', !!clientSecret, 'redirectUri:', !!redirectUri);
    return NextResponse.redirect(new URL(failRedirect));
  }

  console.log('[ClickUp Callback] Exchanging code for token...');
  try {
    const tokenRes = await fetch(CLICKUP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn('[ClickUp Callback] Token exchange failed – status:', tokenRes.status, 'body:', errText);
      return NextResponse.redirect(new URL(failRedirect));
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    const accessToken = tokenData?.access_token;

    if (!accessToken) {
      console.warn('[ClickUp Callback] Token response had no access_token');
      return NextResponse.redirect(new URL(failRedirect));
    }
    console.log('[ClickUp Callback] Token received, storing for org...');

    const user = await UserService.getUserByEmail(session.user.email);
    const isAdmin = (session.user as { adminTag?: boolean }).adminTag === true;
    const hasOrg = !!user?.organizationId;

    if (!hasOrg && !isAdmin) {
      console.warn('[ClickUp Callback] User has no organizationId and is not admin – connect from an organization account or create/join an org');
      const noOrgRedirect = failRedirect.includes('?') ? failRedirect.replace(/\berror=[^&]+/, 'error=no_org') : `${failRedirect}?error=no_org`;
      return NextResponse.redirect(new URL(noOrgRedirect));
    }

    const db = await getDatabase();
    const collection = db.collection('integration_connections');

    if (hasOrg) {
      await collection.updateOne(
        { organizationId: user!.organizationId, provider: 'clickup' },
        {
          $set: {
            organizationId: user!.organizationId,
            provider: 'clickup',
            accessToken,
            refreshToken: tokenData?.refresh_token || null,
            connectedBy: user!._id?.toString(),
            connectedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } else {
      // Admin without org: store by userId so only this admin sees the connection
      const userIdStr = user!._id?.toString();
      if (!userIdStr) {
        const noOrgRedirect = failRedirect.includes('?') ? failRedirect.replace(/\berror=[^&]+/, 'error=no_org') : `${failRedirect}?error=no_org`;
        return NextResponse.redirect(new URL(noOrgRedirect));
      }
      await collection.updateOne(
        { userId: userIdStr, provider: 'clickup' },
        {
          $set: {
            userId: userIdStr,
            organizationId: null,
            provider: 'clickup',
            accessToken,
            refreshToken: tokenData?.refresh_token || null,
            connectedBy: userIdStr,
            connectedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    console.log('[ClickUp Callback] Connection saved, redirecting to success');
    return NextResponse.redirect(new URL(successRedirect));
  } catch (e) {
    console.error('[ClickUp Callback] Error:', e);
    return NextResponse.redirect(new URL(failRedirect));
  }
}
