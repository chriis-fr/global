import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { OrganizationService } from '@/lib/services/organizationService';
import { getOrganizationMpesaCredentialsDecrypted } from '@/app/actions/mpesa-org-actions';
import { isLocalhostUrl, resolvePublicBaseUrl } from '@/lib/utils/publicBaseUrl';

type SessionUserShape = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  organizationId?: string | null;
  organizationRole?: string | null;
  adminTag?: boolean;
};

function parseDarajaEnvironment(value: unknown): 'sandbox' | 'production' {
  return String(value ?? '')
    .toLowerCase()
    .trim() === 'sandbox'
    ? 'sandbox'
    : 'production';
}

function getBaseUrl(env: 'sandbox' | 'production') {
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

const ACCOUNT_BALANCE_TEMP_DISABLED = true;

function parseAccountBalanceString(value: string) {
  // Example: Working Account|KES|700000.00|700000.00|0.00|0.00&Utility Account|KES|228037.00|...
  const segments = value.split('&').map((s) => s.trim()).filter(Boolean);
  return segments.map((segment) => {
    const [accountName = '', currency = '', available = '0', uncleared = '0', reserved = '0'] = segment.split('|');
    return {
      accountName,
      currency,
      available: Number(available) || 0,
      uncleared: Number(uncleared) || 0,
      reserved: Number(reserved) || 0,
      raw: segment,
    };
  });
}

async function getToken(consumerKey: string, consumerSecret: string, environment: 'sandbox' | 'production') {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const base = getBaseUrl(environment);
  const tokenRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const raw = await tokenRes.text().catch(() => '');
  if (!tokenRes.ok) throw new Error(`Failed to get access token (${tokenRes.status})`);
  const parsed = JSON.parse(raw) as { access_token?: string };
  if (!parsed.access_token) throw new Error('No access token returned');
  return parsed.access_token;
}

async function authorize(session: { user?: SessionUserShape } | null) {
  const user = session?.user;
  const role = user?.organizationRole;
  const isSuper = user?.adminTag === true;
  const orgId = user?.organizationId ?? null;
  if (!user?.id || (!orgId && !isSuper)) return null;
  if (!isSuper && role !== 'owner' && role !== 'admin') return null;
  return { user, orgId: orgId as string };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await authorize(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const db = await connectToDatabase();
  const col = db.collection('mpesa_balance_requests');
  const latest = await col.findOne(
    { organizationId: new ObjectId(auth.orgId) },
    { sort: { updatedAt: -1, createdAt: -1 } }
  );
  return NextResponse.json({ success: true, latest: latest ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await authorize(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (ACCOUNT_BALANCE_TEMP_DISABLED) {
    return NextResponse.json(
      {
        success: false,
        error: 'Till balance fetch is temporarily disabled while callback setup is being finalized.',
      },
      { status: 503 }
    );
  }

  try {
    await req.json().catch(() => ({})); // Body intentionally ignored: query runs from server config.
    const creds = await getOrganizationMpesaCredentialsDecrypted(auth.orgId);
    const org = await OrganizationService.getOrganizationById(auth.orgId);
    const shortCode = String(org?.settings?.mpesa?.businessShortCode || '').trim();
    if (!shortCode) {
      return NextResponse.json({ success: false, error: 'No short code configured for this organization' }, { status: 400 });
    }

    const environment = parseDarajaEnvironment(creds?.environment ?? process.env.DARAJA_ENV ?? 'production');
    const consumerKey = creds?.consumerKey ?? process.env.DARAJA_CONSUMER_KEY ?? '';
    const consumerSecret = creds?.consumerSecret ?? process.env.DARAJA_CONSUMER_SECRET ?? '';
    if (!consumerKey || !consumerSecret) {
      return NextResponse.json({ success: false, error: 'Consumer key/secret not configured' }, { status: 400 });
    }

    const initiator = String(creds?.balanceInitiator ?? '').trim();
    const securityCredential = String(creds?.balanceSecurityCredential ?? '').trim();
    const identifierType = String(creds?.balanceIdentifierType ?? '4').trim();
    const commandId = String(creds?.balanceCommandId ?? 'AccountBalance').trim();
    const remarks = String(creds?.balanceRemarks ?? 'ok').trim();
    if (!initiator || !securityCredential) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Account balance is not fully configured for this business. Set Balance Initiator and Balance Security Credential in Admin > M-Pesa credentials.',
        },
        { status: 400 }
      );
    }

    const base = getBaseUrl(environment);
    const resolvedPublicBase = resolvePublicBaseUrl({ requestOrigin: req.nextUrl.origin });
    if (!resolvedPublicBase) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No public app base URL configured. Set FRONTEND_URL/NEXT_PUBLIC_BASE_URL so Safaricom callbacks can reach this app.',
        },
        { status: 400 }
      );
    }
    const callbackUrl = `${resolvedPublicBase}/api/mpesa/account-balance/callback`;
    const queueTimeoutUrl = String(creds?.balanceQueueTimeoutUrl ?? callbackUrl).trim();
    const resultUrl = String(creds?.balanceResultUrl ?? callbackUrl).trim();
    if (process.env.NODE_ENV === 'production' && (isLocalhostUrl(queueTimeoutUrl) || isLocalhostUrl(resultUrl))) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Production callback URLs cannot be localhost. Update balance callback overrides in Admin > M-Pesa credentials.',
        },
        { status: 400 }
      );
    }
    const token = await getToken(consumerKey, consumerSecret, environment);

    const payload = {
      Initiator: initiator,
      SecurityCredential: securityCredential,
      CommandID: commandId || 'AccountBalance',
      PartyA: shortCode,
      IdentifierType: identifierType,
      Remarks: remarks.slice(0, 120) || 'ok',
      QueueTimeOutURL: queueTimeoutUrl,
      ResultURL: resultUrl,
    };

    const res = await fetch(`${base}/mpesa/accountbalance/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => '');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }

    console.log('[account-balance query] Safaricom response', {
      status: res.status,
      ok: res.ok,
      organizationId: auth.orgId,
      shortCode,
      environment,
      requestMeta: {
        Initiator: payload.Initiator,
        CommandID: payload.CommandID,
        PartyA: payload.PartyA,
        IdentifierType: payload.IdentifierType,
        QueueTimeOutURL: payload.QueueTimeOutURL,
        ResultURL: payload.ResultURL,
      },
      response: parsed,
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Balance query failed (${res.status})`, details: parsed },
        { status: res.status }
      );
    }

    const db = await connectToDatabase();
    const col = db.collection('mpesa_balance_requests');
    await col.insertOne({
      organizationId: new ObjectId(auth.orgId),
      requestedByUserId: auth.user.id && ObjectId.isValid(auth.user.id) ? new ObjectId(auth.user.id) : null,
      requestedByName: auth.user.name || auth.user.email || 'Admin',
      environment,
      shortCode,
      payload,
      ack: parsed,
      status: 'pending',
      parsedBalances: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, ack: parsed });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to query balance' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  // Optional utility: parse raw account balance string and return parsed view.
  const body = await req.json().catch(() => ({}));
  const raw = String(body?.rawBalance || '').trim();
  if (!raw) return NextResponse.json({ success: false, error: 'rawBalance is required' }, { status: 400 });
  return NextResponse.json({ success: true, parsed: parseAccountBalanceString(raw) });
}
