import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reconcileOrg, getReconSummary } from '@/lib/services/reconEngine';
import { queryPullTransactionsAndIngest } from '@/lib/services/darajaPullTransactionsService';

/**
 * GET  /api/mpesa/reconcile  — fetch current reconciliation summary (no re-run)
 * POST /api/mpesa/reconcile  — trigger a full reconciliation run for the org
 *
 * Admin-only (owner | admin | superAdmin).
 */

type SessionUserShape = {
  id?: string | null;
  organizationId?: string | null;
  organizationRole?: string | null;
  adminTag?: boolean;
};

async function authorise(session: { user?: SessionUserShape } | null) {
  const user = session?.user ?? {};
  const userId = user.id;
  const orgId = user.organizationId;
  const role = user.organizationRole;
  const isSuper = user.adminTag === true;

  if (!userId || (!orgId && !isSuper)) return null;
  if (!isSuper && role !== 'owner' && role !== 'admin') return null;

  return { userId, orgId: orgId!, isSuper };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await authorise(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const summary = await getReconSummary(auth.orgId);
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[reconcile GET]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await authorise(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const stkSessionId = body?.stkSessionId as string | undefined;
    const pullTransactions = body?.pullTransactions === true;

    let pullResult: unknown = null;
    if (pullTransactions) {
      pullResult = await queryPullTransactionsAndIngest({ organizationId: auth.orgId });
      console.log('[reconcile] Pull transactions result:', pullResult);
    }

    const result = await reconcileOrg(auth.orgId, {
      stkSessionId,
      actor: auth.userId,
    });

    return NextResponse.json({ success: true, result, pullResult });
  } catch (err) {
    console.error('[reconcile POST]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
