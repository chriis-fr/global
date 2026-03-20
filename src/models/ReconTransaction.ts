import { ObjectId } from 'mongodb';

export type MatchStatus =
  | 'matched'           // STK + M-Pesa confirmation align perfectly
  | 'amount_mismatch'   // Paid ≠ expected (C2B amount differs from STK amount)
  | 'missing_external'  // STK was sent, never received M-Pesa confirmation
  | 'missing_internal'  // M-Pesa confirmation arrived with no matching STK session
  | 'duplicate'         // Same M-Pesa receipt on multiple sessions
  | 'orphaned'          // Cannot map to any intent or session
  | 'failed'            // User cancelled / network error — not a discrepancy, just a fact
  | 'pending';          // STK sent, still within callback window

export type TransactionSource = 'mpesa_stk' | 'c2b_manual' | 'manual';
export type PaymentProvider = 'mpesa' | 'stripe' | 'flutterwave' | 'bank' | 'usdc';

export interface ReconTransaction {
  _id?: ObjectId;
  organizationId: ObjectId;

  // ── Intent layer (optional — wired when POS / invoice integration exists) ──
  intentId?: string;          // invoiceId / orderId / table session
  expectedAmount?: number;    // What the business expected to receive
  currency: string;

  // ── Attempt layer (STK push) ───────────────────────────────────────────────
  stkSessionId?: ObjectId;    // _id of mpesa_stk_sessions
  stkRequestId?: string;      // CheckoutRequestID from Daraja
  phoneNumber: string;
  initiatedAt?: Date;
  waiterUserId?: ObjectId;
  tableRef?: string;

  // ── Confirmation layer (M-Pesa callback) ──────────────────────────────────
  mpesaReceiptNumber?: string;
  mpesaAmount?: number;       // What M-Pesa actually charged (from callback)
  mpesaTimestamp?: Date;

  // ── Status & matching ──────────────────────────────────────────────────────
  status: 'success' | 'failed' | 'pending';
  matchStatus: MatchStatus;
  matchConfidence: number;    // 0–1 score
  matchNote?: string;         // Human-readable reason for match decision

  // ── Settlement layer (future-proof) ───────────────────────────────────────
  settled: boolean;
  settledAt?: Date;
  settlementBatchId?: string;

  // ── Meta ──────────────────────────────────────────────────────────────────
  source: TransactionSource;
  provider: PaymentProvider;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconSummary {
  total: number;
  matched: number;
  failed: number;
  pending: number;
  amountMismatch: number;
  missingExternal: number;
  duplicate: number;
  orphaned: number;
  matchRate: number;           // 0–100 percent
  totalCollected: number;      // sum of mpesaAmount for matched
  totalDiscrepancy: number;    // sum of |expectedAmount - mpesaAmount| for mismatches
  lastRunAt?: Date;
}
