import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrganizationMpesaCredentialsDecrypted } from '@/app/actions/mpesa-org-actions';
import { OrganizationService } from '@/lib/services/organizationService';
import { isLocalhostUrl, resolvePublicBaseUrl } from '@/lib/utils/publicBaseUrl';

/**
 * POST /api/mpesa/c2b-register
 *
 * Admin-only endpoint. Registers the C2B Confirmation URL (and optional Validation URL)
 * with Safaricom for a given organization's shortcode.
 *
 * Must be called ONCE per shortcode in production (Safaricom allows re-registration
 * only after deletion via their portal).
 *
 * Body: { organizationId: string, confirmationUrl?: string, validationUrl?: string, responseType?: 'Completed' | 'Cancelled' }
 *
 * If confirmationUrl is omitted, we derive it from the org's callbackUrl base.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.adminTag) {
      return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { organizationId, confirmationUrl: bodyConfirmUrl, validationUrl: bodyValidUrl, responseType: bodyResponseType } = body as {
      organizationId: string;
      confirmationUrl?: string;
      validationUrl?: string;
      responseType?: 'Completed' | 'Cancelled';
    };

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
    }

    const org = await OrganizationService.getOrganizationById(organizationId);
    if (!org) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });

    const orgMpesa = org.settings?.mpesa;
    const shortCode = orgMpesa?.businessShortCode?.trim();
    if (!shortCode) {
      return NextResponse.json({ success: false, error: 'No Business Short Code configured for this org' }, { status: 400 });
    }

    const creds = await getOrganizationMpesaCredentialsDecrypted(organizationId);
    const consumerKey = creds?.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
    const consumerSecret = creds?.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';
    const environment: 'sandbox' | 'production' = (creds?.environment ?? process.env.DARAJA_ENV ?? 'production') as 'sandbox' | 'production';

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json({ success: false, error: 'Consumer key/secret not configured' }, { status: 400 });
    }

    // Derive base URL from explicit input, org callback, or public app URL env.
    const existingCallback = String(creds?.callbackUrl ?? process.env.NEXT_PUBLIC_DARAJA_CALLBACK_URL ?? '').trim();
    const orgBaseUrl = existingCallback ? existingCallback.replace(/\/api\/mpesa\/callback\/?$/, '') : '';
    const fallbackBase = resolvePublicBaseUrl({ requestOrigin: req.nextUrl.origin });
    const baseUrl = bodyConfirmUrl
      ? ''
      : orgBaseUrl || fallbackBase || '';

    if (!baseUrl && !bodyConfirmUrl) {
      return NextResponse.json({
        success: false,
        error: 'Cannot derive base URL. Provide confirmationUrl explicitly or set callbackUrl in org credentials.',
      }, { status: 400 });
    }

    const confirmationUrl = bodyConfirmUrl || `${baseUrl}/api/mpesa/c2b-confirmation`;
    const validationUrl   = bodyValidUrl   || `${baseUrl}/api/mpesa/c2b-validation`;
    if (process.env.NODE_ENV === 'production' && (isLocalhostUrl(confirmationUrl) || isLocalhostUrl(validationUrl))) {
      return NextResponse.json(
        { success: false, error: 'Production C2B callback URLs cannot be localhost.' },
        { status: 400 }
      );
    }

    // Get OAuth token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const darajaBase = environment === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke';

    const tokenRes = await fetch(
      `https://${darajaBase}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.json({ success: false, error: 'Failed to get Daraja access token', raw: tokenData }, { status: 500 });
    }

    const responseType: 'Completed' | 'Cancelled' =
      bodyResponseType === 'Cancelled' || bodyResponseType === 'Completed' ? bodyResponseType : 'Completed';

    const registerPayload = {
      ShortCode: shortCode,
      ResponseType: responseType,
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    };

    console.log('[C2B register] Payload:', JSON.stringify(registerPayload, null, 2), 'env:', environment);

    const registerRes = await fetch(
      `https://${darajaBase}/mpesa/c2b/v2/registerurl`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerPayload),
      }
    );

    const registerData = await registerRes.json();
    console.log('[C2B register] Response:', JSON.stringify(registerData, null, 2));

    if (registerData?.ResponseCode === '0') {
      return NextResponse.json({
        success: true,
        message: 'C2B URLs registered successfully',
        confirmationUrl,
        validationUrl,
        response: registerData,
      });
    }

    return NextResponse.json({
      success: false,
      error: registerData?.ResponseDescription || 'Registration failed',
      raw: registerData,
    }, { status: 400 });
  } catch (error) {
    console.error('[C2B register] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
