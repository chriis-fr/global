import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

function parseAccountBalanceString(value: string) {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = (body as { Result?: Record<string, unknown> })?.Result ?? {};
    const conversationId = String(result.ConversationID ?? '').trim();
    const originatorConversationID = String(result.OriginatorConversationID ?? '').trim();

    const resultParameters = (result.ResultParameters as { ResultParameter?: Array<{ Key?: string; Value?: string }> } | undefined)?.ResultParameter ?? [];
    const accountBalanceRaw = resultParameters.find((p) => p?.Key === 'AccountBalance')?.Value ?? '';
    const parsedBalances = accountBalanceRaw ? parseAccountBalanceString(accountBalanceRaw) : [];

    const db = await connectToDatabase();
    const col = db.collection('mpesa_balance_requests');

    const orFilters: Array<Record<string, unknown>> = [];
    if (conversationId) orFilters.push({ 'ack.ConversationID': conversationId });
    if (originatorConversationID) orFilters.push({ 'ack.OriginatorConversationID': originatorConversationID });

    console.log('[account-balance callback] Safaricom callback received', {
      conversationId,
      originatorConversationID,
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc,
      parsedBalances,
      body,
    });

    if (orFilters.length > 0) {
      const updateResult = await col.updateOne(
        { $or: orFilters },
        {
          $set: {
            callback: body,
            parsedBalances,
            status: 'completed',
            updatedAt: new Date(),
          },
        }
      );
      console.log('[account-balance callback] Stored callback result', {
        conversationId,
        originatorConversationID,
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
      });
    } else {
      console.warn('[account-balance callback] No conversation IDs in callback payload', { body });
    }
  } catch (error) {
    console.error('[account-balance callback] Error:', error);
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });
}
