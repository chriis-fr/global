import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryPullTransactionsAndIngest } from '@/lib/services/darajaPullTransactionsService';

/**
 * POST /api/mpesa/pulltransactions/query
 *
 * Org admin endpoint (owner | admin | superAdmin). Pulls transactions for the last 48 hours
 * by default, ingests them into reconciliation data, and returns counts.
 *
 * Body: { organizationId?: string, startDate?: string, endDate?: string, offsetValue?: string }
 * - If organizationId is omitted, uses session user's org (non-superAdmin).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { adminTag, organizationId: userOrgId, organizationRole } = session.user;
  const isSuper = adminTag === true;
  const orgIdFromSession: string | undefined = userOrgId || undefined;
  const role: string | undefined = organizationRole ?? undefined;
  if (!isSuper && (role !== 'owner' && role !== 'admin')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const organizationId = (String(body?.organizationId || '').trim() || orgIdFromSession || '').trim();
    if (!organizationId) return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });

    const startDate = body?.startDate ? new Date(String(body.startDate)) : undefined;
    const endDate = body?.endDate ? new Date(String(body.endDate)) : undefined;
    const offsetValue = body?.offsetValue ? String(body.offsetValue) : undefined;

    const result = await queryPullTransactionsAndIngest({
      organizationId,
      startDate,
      endDate,
      offsetValue,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[pulltransactions query] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

