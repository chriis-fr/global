import { NextRequest, NextResponse } from 'next/server';
import { mpesaSessionService } from '@/lib/services/mpesaSessionService';

/**
 * POST /api/mpesa/c2b-confirmation
 *
 * Safaricom fires this after a successful C2B payment (including STK push completions).
 * It arrives a few seconds after the STK push callback and is the ONLY place
 * Safaricom gives us the customer's name.
 *
 * Register this URL once via /api/mpesa/c2b-register (admin endpoint).
 * The URL must be HTTPS and publicly reachable in production.
 *
 * Payload shape (C2B v2 — masked MSISDN):
 * {
 *   TransactionType: "Pay Bill",
 *   TransID: "RKL51ZDR4F",        ← same as MpesaReceiptNumber in STK callback
 *   TransTime: "20231121121325",
 *   TransAmount: "200.00",
 *   BusinessShortCode: "600966",
 *   BillRefNumber: "...",
 *   MSISDN: "2547 ***** 126",      ← masked
 *   FirstName: "JOHN",
 *   MiddleName: "",
 *   LastName: "DOE",
 *   OrgAccountBalance: "...",
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[C2B confirmation] Raw body:', JSON.stringify(body, null, 2));

    const transId: string | undefined = body?.TransID;
    const firstName: string | undefined = body?.FirstName?.trim() || undefined;
    const middleName: string | undefined = body?.MiddleName?.trim() || undefined;
    const lastName: string | undefined = body?.LastName?.trim() || undefined;

    if (!transId) {
      console.warn('[C2B confirmation] Missing TransID — ignoring payload');
      // Always respond 200 so Safaricom does not keep retrying
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
    }

    console.log('[C2B confirmation] TransID:', transId, 'Name:', firstName, middleName, lastName);

    // Link by receipt number — the STK callback already stored this on the session
    await mpesaSessionService.updateSessionCustomerName({
      mpesaReceiptNumber: transId,
      firstName,
      middleName,
      lastName,
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
  } catch (error) {
    console.error('[C2B confirmation] Error:', error);
    // Still return 200 — Safaricom interprets non-200 as failure and retries
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
  }
}
