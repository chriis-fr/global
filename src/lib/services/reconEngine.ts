/**
 * Reconciliation Engine
 *
 * Implements INTENT → ATTEMPT → CONFIRMATION → SETTLEMENT pipeline.
 *
 * Matching strategy (enterprise-grade, tiered):
 *   1. Exact match   — mpesaReceiptNumber present and unique
 *   2. Soft match    — amount + phone + time window (±5 min)
 *   3. Heuristic     — weighted score across amount / phone / time / ref
 *
 * Match classification:
 *   matched          — STK success + receipt confirmed, amounts align
 *   amount_mismatch  — Receipt confirmed but confirmed amount ≠ expected amount
 *   missing_external — STK sent, no callback after timeout window
 *   duplicate        — Same receipt on multiple sessions
 *   failed           — User cancelled / STK rejected (expected outcome, not discrepancy)
 *   pending          — STK sent, still within callback window
 *
 * Provider-agnostic: `provider` field is set per-transaction so the same engine
 * can be extended to Stripe, Flutterwave, bank transfers, USDC, etc.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/database';
import type { ReconTransaction, MatchStatus, ReconSummary } from '@/models/ReconTransaction';
import type { ReconLog } from '@/models/ReconLog';
import type { MpesaStkSession } from '@/models/MpesaStkSession';

// STK prompt is considered "timed out" if still pending after this many minutes
const PENDING_TIMEOUT_MINUTES = 20;

// Amount tolerance for soft matching (KES)
const AMOUNT_TOLERANCE = 1;

// (Soft-match heuristic reserved for future: current engine classifies using exact
// receipt / amount / timeout rules only, to avoid unnecessary complexity.)

// ─────────────────────────────────────────────────────────────────────────────
// Classify a single session into a matchStatus
// ─────────────────────────────────────────────────────────────────────────────

function classifySession(
  session: MpesaStkSession & { _id: ObjectId },
  isDuplicateReceipt: boolean
): { matchStatus: MatchStatus; matchConfidence: number; matchNote: string } {
  const now = Date.now();
  const createdAt = session.createdAt ? new Date(session.createdAt).getTime() : now;
  const ageMs = now - createdAt;
  const timedOut = ageMs > PENDING_TIMEOUT_MINUTES * 60 * 1000;

  if (isDuplicateReceipt) {
    return {
      matchStatus: 'duplicate',
      matchConfidence: 1,
      matchNote: `Receipt ${session.mpesaReceiptNumber} appears on multiple sessions.`,
    };
  }

  if (session.status === 'failed') {
    return {
      matchStatus: 'failed',
      matchConfidence: 1,
      matchNote: session.resultDescription ?? 'STK prompt was rejected or cancelled.',
    };
  }

  if (session.status === 'success') {
    if (!session.mpesaReceiptNumber) {
      // Rare: status=success but no receipt stored — treat as missing external
      return {
        matchStatus: 'missing_external',
        matchConfidence: 0.5,
        matchNote: 'Session marked success but no receipt number recorded.',
      };
    }

    // Check for amount mismatch when C2B is active and confirmed amount differs
    const expected = session.amount ?? 0;
    const confirmed = session.confirmedAmount ?? expected; // fallback to expected if not set
    if (Math.abs(expected - confirmed) > AMOUNT_TOLERANCE) {
      return {
        matchStatus: 'amount_mismatch',
        matchConfidence: 0.9,
        matchNote: `Expected KES ${expected}, M-Pesa confirmed KES ${confirmed}. Difference: KES ${Math.abs(expected - confirmed)}.`,
      };
    }

    return {
      matchStatus: 'matched',
      matchConfidence: 1,
      matchNote: `Receipt ${session.mpesaReceiptNumber} confirmed by M-Pesa callback.`,
    };
  }

  // status === 'pending'
  if (timedOut) {
    return {
      matchStatus: 'missing_external',
      matchConfidence: 0.85,
      matchNote: `STK prompt sent ${Math.round(ageMs / 60000)} min ago with no M-Pesa response.`,
    };
  }

  return {
    matchStatus: 'pending',
    matchConfidence: 1,
    matchNote: 'Awaiting M-Pesa callback.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main reconciliation function
// ─────────────────────────────────────────────────────────────────────────────

export interface ReconcileOptions {
  /** Limit to a single session (used on callback for real-time mini-recon) */
  stkSessionId?: string;
  /** Actor — 'system' for auto, userId for manual trigger */
  actor?: string;
}

export interface ReconcileResult {
  processed: number;
  created: number;
  updated: number;
  summary: ReconSummary;
  durationMs: number;
}

export async function reconcileOrg(
  organizationId: string,
  options: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const start = Date.now();
  const actor = options.actor ?? 'system';

  const db = await connectToDatabase();
  const stkCol   = db.collection<MpesaStkSession>('mpesa_stk_sessions');
  const reconCol = db.collection<ReconTransaction>('recon_transactions');
  const logCol   = db.collection<ReconLog>('recon_logs');

  const orgObjectId = new ObjectId(organizationId);

  // ── 1. Fetch STK sessions ─────────────────────────────────────────────────
  const stkFilter: Record<string, unknown> = { organizationId: orgObjectId };
  if (options.stkSessionId && ObjectId.isValid(options.stkSessionId)) {
    stkFilter._id = new ObjectId(options.stkSessionId);
  }

  const stkSessions = (await stkCol.find(stkFilter).toArray()) as (MpesaStkSession & { _id: ObjectId })[];

  // ── 2. Detect duplicate receipts ─────────────────────────────────────────
  const receiptCount = new Map<string, number>();
  for (const s of stkSessions) {
    if (s.mpesaReceiptNumber) {
      receiptCount.set(s.mpesaReceiptNumber, (receiptCount.get(s.mpesaReceiptNumber) ?? 0) + 1);
    }
  }
  const duplicateReceipts = new Set<string>(
    [...receiptCount.entries()].filter(([, c]) => c > 1).map(([r]) => r)
  );

  // ── 3. Fetch existing recon_transactions for this org ─────────────────────
  const existingRecon = await reconCol
    .find({ organizationId: orgObjectId })
    .toArray() as (ReconTransaction & { _id: ObjectId })[];

  const reconByStkId = new Map<string, ReconTransaction & { _id: ObjectId }>();
  for (const r of existingRecon) {
    if (r.stkSessionId) reconByStkId.set(r.stkSessionId.toString(), r);
  }

  // ── 4. Process each STK session ───────────────────────────────────────────
  let created = 0;
  let updated = 0;
  const logs: ReconLog[] = [];

  for (const session of stkSessions) {
    const sessionId = session._id.toString();
    const isDuplicate = session.mpesaReceiptNumber
      ? duplicateReceipts.has(session.mpesaReceiptNumber)
      : false;

    const { matchStatus, matchConfidence, matchNote } = classifySession(session, isDuplicate);

    const reconDoc: ReconTransaction = {
      organizationId: orgObjectId,
      stkSessionId: session._id,
      stkRequestId: session.checkoutRequestId,
      phoneNumber: session.phoneNumber,
      initiatedAt: session.createdAt,
      waiterUserId: session.waiterUserId,
      tableRef: session.tableRef,
      expectedAmount: session.amount,
      currency: 'KES',
      mpesaReceiptNumber: session.mpesaReceiptNumber,
      mpesaAmount: session.confirmedAmount,
      mpesaTimestamp: session.transactionDate ?? session.completedAt,
      status: session.status,
      matchStatus,
      matchConfidence,
      matchNote,
      settled: false,
      source: 'mpesa_stk',
      provider: 'mpesa',
      createdAt: session.createdAt,
      updatedAt: new Date(),
    };

    const existing = reconByStkId.get(sessionId);

    if (!existing) {
      // Insert new
      const result = await reconCol.insertOne(reconDoc);
      created++;
      logs.push({
        organizationId: orgObjectId,
        transactionId: result.insertedId,
        action: 'auto_created',
        newMatchStatus: matchStatus,
        actor,
        note: matchNote,
        timestamp: new Date(),
      });
    } else if (
      existing.matchStatus !== matchStatus ||
      existing.status !== session.status ||
      existing.mpesaReceiptNumber !== session.mpesaReceiptNumber
    ) {
      // Update changed fields
      await reconCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: session.status,
            matchStatus,
            matchConfidence,
            matchNote,
            mpesaReceiptNumber: session.mpesaReceiptNumber,
            mpesaAmount: session.confirmedAmount,
            mpesaTimestamp: session.transactionDate ?? session.completedAt,
            updatedAt: new Date(),
          },
        }
      );
      updated++;
      if (existing.matchStatus !== matchStatus) {
        logs.push({
          organizationId: orgObjectId,
          transactionId: existing._id,
          action: 'match_status_changed',
          previousMatchStatus: existing.matchStatus,
          newMatchStatus: matchStatus,
          actor,
          note: matchNote,
          timestamp: new Date(),
        });
      }
    }
  }

  // ── 5. Bulk-insert audit logs ─────────────────────────────────────────────
  if (logs.length > 0) {
    await logCol.insertMany(logs);
  }

  // Log the run itself (org-level event)
  await logCol.insertOne({
    organizationId: orgObjectId,
    action: 'reconcile_run',
    actor,
    note: `Processed ${stkSessions.length} sessions. Created: ${created}, Updated: ${updated}.`,
    meta: { processed: stkSessions.length, created, updated },
    timestamp: new Date(),
  });

  // ── 6. Build summary from latest recon_transactions ───────────────────────
  const allRecon = options.stkSessionId
    ? (await reconCol.find({ organizationId: orgObjectId }).toArray()) as ReconTransaction[]
    : ([...existingRecon, ...(created > 0 ? await reconCol
        .find({ organizationId: orgObjectId, stkSessionId: { $in: stkSessions.map((s) => s._id) } })
        .toArray() as ReconTransaction[] : [])] as ReconTransaction[]);

  const summary = buildSummary(allRecon);

  return {
    processed: stkSessions.length,
    created,
    updated,
    summary,
    durationMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildSummary(docs: ReconTransaction[]): ReconSummary {
  const byStatus = (s: MatchStatus) => docs.filter((d) => d.matchStatus === s);

  const matched        = byStatus('matched');
  const failed         = byStatus('failed');
  const pending        = byStatus('pending');
  const amountMismatch = byStatus('amount_mismatch');
  const missingExt     = byStatus('missing_external');
  const duplicate      = byStatus('duplicate');
  const orphaned       = byStatus('orphaned');

  const totalCollected = matched.reduce((s, d) => s + (d.mpesaAmount ?? d.expectedAmount ?? 0), 0);
  const totalDiscrepancy = amountMismatch.reduce(
    (s, d) => s + Math.abs((d.expectedAmount ?? 0) - (d.mpesaAmount ?? 0)),
    0
  );

  // Match rate = matched / (matched + mismatch + missing_external + duplicate + orphaned)
  const denominator = matched.length + amountMismatch.length + missingExt.length + duplicate.length + orphaned.length;
  const matchRate = denominator > 0 ? Math.round((matched.length / denominator) * 100) : 0;

  return {
    total: docs.length,
    matched: matched.length,
    failed: failed.length,
    pending: pending.length,
    amountMismatch: amountMismatch.length,
    missingExternal: missingExt.length,
    duplicate: duplicate.length,
    orphaned: orphaned.length,
    matchRate,
    totalCollected,
    totalDiscrepancy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch current summary without re-running the engine
// ─────────────────────────────────────────────────────────────────────────────

export async function getReconSummary(organizationId: string): Promise<ReconSummary & { lastRunAt?: Date }> {
  const db = await connectToDatabase();
  const reconCol = db.collection<ReconTransaction>('recon_transactions');
  const logCol   = db.collection<ReconLog>('recon_logs');

  const orgObjectId = new ObjectId(organizationId);
  const docs = (await reconCol.find({ organizationId: orgObjectId }).toArray()) as ReconTransaction[];
  const summary = buildSummary(docs);

  // Find last reconcile_run log
  const lastRun = await logCol.findOne(
    { organizationId: orgObjectId, action: 'reconcile_run' },
    { sort: { timestamp: -1 } }
  );

  return { ...summary, lastRunAt: lastRun?.timestamp };
}
