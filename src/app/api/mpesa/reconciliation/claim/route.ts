import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import type { ReconTransaction } from '@/models/ReconTransaction';

type SessionUserShape = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  organizationId?: string | null;
  organizationRole?: string | null;
  adminTag?: boolean;
};

async function authorize(session: { user?: SessionUserShape } | null) {
  const user = session?.user;
  const role = user?.organizationRole;
  const isSuper = user?.adminTag === true;
  const orgId = user?.organizationId ?? null;
  if (!user?.id || (!orgId && !isSuper)) return null;
  if (!isSuper && role !== 'owner' && role !== 'admin') return null;
  return { user, orgId: orgId as string };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await authorize(session);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const transactionId = String(body?.transactionId ?? '').trim();
    const waiterUserId = String(body?.waiterUserId ?? '').trim();
    const externalWaiterName = String(body?.externalWaiterName ?? '').trim();

    if (!ObjectId.isValid(transactionId)) {
      return NextResponse.json({ success: false, error: 'Valid transactionId is required' }, { status: 400 });
    }
    if ((!waiterUserId && !externalWaiterName) || (waiterUserId && externalWaiterName)) {
      return NextResponse.json(
        { success: false, error: 'Provide either waiterUserId or externalWaiterName' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const reconCol = db.collection<ReconTransaction>('recon_transactions');
    const usersCol = db.collection('users');
    const orgCol = db.collection('organizations');
    const orgObjectId = new ObjectId(auth.orgId);

    const tx = await reconCol.findOne({ _id: new ObjectId(transactionId), organizationId: orgObjectId });
    if (!tx) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });

    if (tx.waiterUserId || tx.externalWaiterName) {
      return NextResponse.json(
        { success: false, error: 'This payment is already claimed and cannot be reassigned' },
        { status: 409 }
      );
    }

    const updateSet: Record<string, unknown> = {
      claimedAt: new Date(),
      claimedByName: auth.user.name || auth.user.email || 'Admin',
      updatedAt: new Date(),
    };
    if (auth.user.id && ObjectId.isValid(auth.user.id)) {
      updateSet.claimedByUserId = new ObjectId(auth.user.id);
    }

    if (waiterUserId) {
      if (!ObjectId.isValid(waiterUserId)) {
        return NextResponse.json({ success: false, error: 'Invalid waiterUserId' }, { status: 400 });
      }

      const org = await orgCol.findOne({ _id: orgObjectId }, { projection: { members: 1 } }) as
        | { members?: Array<{ userId?: ObjectId; role?: string }> }
        | null;
      const waiterIdObj = new ObjectId(waiterUserId);
      const isOrgMember = (org?.members ?? []).some((m) => m.userId?.toString() === waiterIdObj.toString());
      if (!isOrgMember) {
        return NextResponse.json({ success: false, error: 'Selected waiter is not in this organization' }, { status: 400 });
      }

      const waiter = await usersCol.findOne({ _id: waiterIdObj }, { projection: { name: 1 } });
      updateSet.waiterUserId = waiterIdObj;
      updateSet.claimType = 'waiter';
      updateSet.externalWaiterName = null;
      updateSet.matchNote = tx.matchNote || `Claimed by admin to waiter ${(waiter?.name as string) || 'Unknown'}`;
    } else {
      updateSet.externalWaiterName = externalWaiterName;
      updateSet.claimType = 'external';
      updateSet.matchNote = tx.matchNote || `Claimed by admin to external waiter ${externalWaiterName}`;
    }

    await reconCol.updateOne(
      { _id: new ObjectId(transactionId), organizationId: orgObjectId },
      { $set: updateSet }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to claim transaction' },
      { status: 500 }
    );
  }
}
