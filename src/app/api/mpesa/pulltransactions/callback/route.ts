import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/mpesa/pulltransactions/callback
 *
 * Safaricom Pull Transactions API is asynchronous and may post updates here.
 * For now we accept and log.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[pulltransactions callback] body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('[pulltransactions callback] error:', err);
  }

  // Always 200 to avoid retries
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
}

