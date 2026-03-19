import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reconcileOrg, getReconSummary } from '@/lib/services/reconEngine';

/**
 * GET  /api/mpesa/reconcile  — fetch current reconciliation summary (no re-run)
 * POST /api/mpesa/reconcile  — trigger a full reconciliation run for the org
 *
 * Admin-only (owner | admin | superAdmin).
 */

async function authorise(session: Awaited<ReturnType<typeof getServerSession>>) {
  const userId = session?.user?.id as string | undefined;
  const orgId  = session?.user?.organizationId as string | undefined;
  const role   = (session?.user as { organizationRole?: string })?.organizationRole;
  const isSuper = (session?.user as { adminTag?: boolean })?.adminTag === true;

  if (!userId || (!orgId && !isSuper)) return null;
  if (!isSuper && role !== 'owner' && role !== 'admin') return null;

  return { userId, orgId: orgId!, isSuper };
}

export async function GET(_req: NextRequest) {
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

    const result = await reconcileOrg(auth.orgId, {
      stkSessionId,
      actor: auth.userId,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('[reconcile POST]', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
