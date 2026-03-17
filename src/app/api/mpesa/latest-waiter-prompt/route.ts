import { NextRequest, NextResponse } from 'next/server';
import { getWaiterRecentPrompts } from '@/app/actions/mpesa-waiter-stats';

export async function GET(_req: NextRequest) {
  const result = await getWaiterRecentPrompts(1);
  if (!result.success || !result.data || result.data.length === 0) {
    return NextResponse.json({ success: false }, { status: 200 });
  }
  return NextResponse.json({ success: true, prompt: result.data[0] }, { status: 200 });
}

