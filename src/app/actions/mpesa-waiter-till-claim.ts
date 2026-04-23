'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { ObjectId, type Filter } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { OrganizationService } from '@/lib/services/organizationService';
import type { ReconTransaction } from '@/models/ReconTransaction';

export type TillPaymentSearchRow = {
  id: string;
  mpesaReceiptNumber: string;
  amount: number;
  /** Full number from DB — only show masked in UI for waiters. */
  phoneNumber: string;
  timestamp: string | null;
  tableRef?: string | null;
  matchStatus?: string | null;
  /** If true, payment is already assigned — UI shows details only, no claim. */
  claimed: boolean;
  /** Who it was recorded to (waiter name or external label). */
  claimedAsLabel?: string | null;
  claimedAt?: string | null;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireWaiterInOrg(): Promise<
  | { ok: true; userId: string; organizationId: string; displayName: string }
  | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) {
    return { ok: false, error: 'You must be signed in to an organization.' };
  }

  const userId = session.user.id;
  const organizationId = session.user.organizationId;

  const org = await OrganizationService.getOrganizationById(organizationId);
  if (!org?._id) {
    return { ok: false, error: 'Organization not found.' };
  }

  const member = org.members.find((m) => m.userId.toString() === userId);
  if (member?.role !== 'waiter') {
    return { ok: false, error: 'Only waiters can claim till payments this way.' };
  }

  const displayName = session.user.name || session.user.email || 'Waiter';
  return { ok: true, userId, organizationId, displayName };
}

function isUnclaimed(tx: ReconTransaction): boolean {
  return !tx.waiterUserId && !tx.externalWaiterName;
}

function isClaimed(tx: ReconTransaction): boolean {
  return !!(tx.waiterUserId || tx.externalWaiterName);
}

/**
 * Find M-Pesa reconciliation rows whose receipt contains the given fragment (claimed and unclaimed).
 */
export async function searchTillPaymentsByReceipt(
  fragment: string
): Promise<{ success: true; data: TillPaymentSearchRow[] } | { success: false; error: string }> {
  const auth = await requireWaiterInOrg();
  if (!auth.ok) return { success: false, error: auth.error };

  const trimmed = fragment.trim();
  if (trimmed.length < 3) {
    return {
      success: false,
      error: 'Enter at least 3 characters (often the last 3–4 digits of the receipt are enough).',
    };
  }
  if (trimmed.length > 40) {
    return { success: false, error: 'Search text is too long.' };
  }

  try {
    const db = await connectToDatabase();
    const reconCol = db.collection<ReconTransaction>('recon_transactions');
    const usersCol = db.collection('users');
    const orgObjectId = new ObjectId(auth.organizationId);
    const pattern = new RegExp(escapeRegex(trimmed), 'i');

    const docs = await reconCol
      .find({
        organizationId: orgObjectId,
        provider: 'mpesa',
        status: 'success',
        mpesaReceiptNumber: { $regex: pattern },
      })
      .sort({ mpesaTimestamp: -1, createdAt: -1 })
      .limit(40)
      .toArray();

    const slice = docs.slice(0, 25);
    const waiterIdsForNames = [
      ...new Set(
        slice
          .filter((d) => isClaimed(d) && d.waiterUserId && !d.externalWaiterName)
          .map((d) => (d.waiterUserId as ObjectId).toString())
      ),
    ];
    const waiterNames = new Map<string, string>();
    if (waiterIdsForNames.length > 0) {
      const users = await usersCol
        .find({ _id: { $in: waiterIdsForNames.map((id) => new ObjectId(id)) } })
        .project({ name: 1 })
        .toArray();
      users.forEach((u) => {
        waiterNames.set(u._id.toString(), ((u.name as string) || 'Waiter').trim() || 'Waiter');
      });
    }

    const data: TillPaymentSearchRow[] = slice.map((d) => {
      const claimed = isClaimed(d);
      let claimedAsLabel: string | null = null;
      if (claimed) {
        const extRaw =
          d.externalWaiterName != null ? String(d.externalWaiterName).trim() : '';
        if (extRaw) {
          claimedAsLabel = `External: ${extRaw}`;
        } else if (d.waiterUserId) {
          const nm = waiterNames.get(d.waiterUserId.toString()) ?? 'Waiter';
          claimedAsLabel = `Waiter: ${nm}`;
        } else {
          claimedAsLabel = 'Already recorded';
        }
      }
      return {
        id: d._id!.toString(),
        mpesaReceiptNumber: String(d.mpesaReceiptNumber ?? ''),
        amount: Number(d.mpesaAmount ?? d.expectedAmount ?? 0),
        phoneNumber: String(d.phoneNumber ?? ''),
        timestamp: (d.mpesaTimestamp ?? d.createdAt)?.toISOString() ?? null,
        tableRef: d.tableRef ? String(d.tableRef) : null,
        matchStatus: d.matchStatus != null ? String(d.matchStatus) : null,
        claimed,
        claimedAsLabel,
        claimedAt: d.claimedAt ? new Date(d.claimedAt).toISOString() : null,
      };
    });

    return { success: true, data };
  } catch (e) {
    console.error('[searchTillPaymentsByReceipt]', e);
    return { success: false, error: 'Could not search payments. Try again.' };
  }
}

/** @deprecated Use searchTillPaymentsByReceipt — kept for any stale imports. */
export const searchUnclaimedTillPaymentsByReceipt = searchTillPaymentsByReceipt;

/**
 * Waiter claims an unclaimed reconciliation row; maps payment to this waiter. Fails if already claimed.
 */
export async function claimTillPaymentAsWaiter(
  transactionId: string
): Promise<{ success: true } | { success: false; error: string; code?: 'gone' | 'conflict' }> {
  const auth = await requireWaiterInOrg();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!ObjectId.isValid(transactionId)) {
    return { success: false, error: 'Invalid payment reference.' };
  }

  try {
    const db = await connectToDatabase();
    const reconCol = db.collection<ReconTransaction>('recon_transactions');
    const orgObjectId = new ObjectId(auth.organizationId);
    const txId = new ObjectId(transactionId);
    const waiterIdObj = new ObjectId(auth.userId);

    const tx = await reconCol.findOne({ _id: txId, organizationId: orgObjectId });
    if (!tx) {
      return { success: false, error: 'Payment not found.', code: 'gone' };
    }
    if (!isUnclaimed(tx)) {
      return {
        success: false,
        error: 'This payment is already claimed.',
        code: 'conflict',
      };
    }

    const unclaimedFilter: Filter<ReconTransaction> = {
      _id: txId,
      organizationId: orgObjectId,
      $and: [
        { $or: [{ waiterUserId: { $exists: false } }, { waiterUserId: null }] },
        {
          $or: [
            { externalWaiterName: { $exists: false } },
            { externalWaiterName: null },
            { externalWaiterName: '' },
          ],
        },
      ],
    } as Filter<ReconTransaction>;

    const result = await reconCol.updateOne(
      unclaimedFilter,
      {
        $set: {
          waiterUserId: waiterIdObj,
          claimType: 'waiter' as const,
          claimedAt: new Date(),
          claimedByUserId: waiterIdObj,
          claimedByName: auth.displayName,
          matchNote: tx.matchNote || `Claimed by waiter (${auth.displayName}) from dashboard`,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: 'This payment was just claimed by someone else.',
        code: 'conflict',
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/services/mpesa');
    revalidatePath(`/dashboard/services/mpesa/waiter/${auth.userId}`);

    return { success: true };
  } catch (e) {
    console.error('[claimTillPaymentAsWaiter]', e);
    return { success: false, error: 'Could not save claim. Try again.' };
  }
}
