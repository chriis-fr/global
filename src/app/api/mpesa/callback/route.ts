import { NextRequest, NextResponse } from 'next/server';
import { mpesaSessionService } from '@/lib/services/mpesaSessionService';
import { reconcileOrg } from '@/lib/services/reconEngine';

// Daraja callback handler for STK Push.
// This is the ONLY API route we introduce because Safaricom must call an HTTP endpoint.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[M-Pesa callback] Raw body:', JSON.stringify(body, null, 2));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const merchantRequestId: string | undefined = callback.MerchantRequestID;
    const checkoutRequestId: string | undefined = callback.CheckoutRequestID;
    const resultCode: number | undefined = callback.ResultCode;
    const resultDesc: string | undefined = callback.ResultDesc;

    let mpesaReceiptNumber: string | undefined;
    let amount: number | undefined;
    let phoneNumber: string | undefined;
    let transactionDate: Date | undefined;

    if (Array.isArray(callback.CallbackMetadata?.Item)) {
      for (const item of callback.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') {
          mpesaReceiptNumber = item.Value;
        }
        if (item.Name === 'Amount') {
          amount = item.Value;
        }
        if (item.Name === 'PhoneNumber') {
          phoneNumber = item.Value?.toString();
        }
        if (item.Name === 'TransactionDate' && item.Value) {
          // Daraja format: YYYYMMDDHHMMSS (e.g. 20260319154609)
          const raw = String(item.Value);
          if (raw.length === 14) {
            const y = raw.slice(0, 4), mo = raw.slice(4, 6), d = raw.slice(6, 8);
            const h = raw.slice(8, 10), mi = raw.slice(10, 12), s = raw.slice(12, 14);
            transactionDate = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
          }
        }
      }
    }

    if (!checkoutRequestId) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    console.log('[M-Pesa callback] Parsed – CheckoutRequestID:', checkoutRequestId, 'ResultCode:', resultCode, 'ResultDesc:', resultDesc, 'MpesaReceiptNumber:', mpesaReceiptNumber, 'Amount:', amount, 'PhoneNumber:', phoneNumber);

    const updatedSession = await mpesaSessionService.updateSessionStatusByCheckoutId({
      checkoutRequestId,
      status: resultCode === 0 ? 'success' : 'failed',
      mpesaReceiptNumber,
      confirmedAmount: amount,
      resultCode: resultCode != null ? String(resultCode) : undefined,
      resultDescription: resultDesc,
      transactionDate,
    });

    // Real-time mini-reconciliation — fire-and-forget so callback response is not delayed.
    if (updatedSession?.organizationId && updatedSession?._id) {
      reconcileOrg(updatedSession.organizationId.toString(), {
        stkSessionId: (updatedSession._id as import('mongodb').ObjectId).toString(),
        actor: 'system',
      }).catch((err) => console.error('[callback recon]', err));
    }

    return NextResponse.json(
      {
        success: true,
        merchantRequestId,
        checkoutRequestId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error handling M-Pesa callback:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

