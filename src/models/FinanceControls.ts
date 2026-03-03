import { ObjectId } from 'mongodb';

/** Accounting period for period locking (month/quarter/year). */
export type AccountingPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface AccountingPeriod {
  _id?: ObjectId;
  organizationId: ObjectId;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
  closedAt?: Date;
  closedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Ledger-style payment entry; never modify invoice directly for "mark as paid" when using finance controls. */
export interface InvoicePaymentEntry {
  _id?: ObjectId;
  organizationId: ObjectId;
  invoiceId: ObjectId;
  amount: number;
  currency: string;
  paymentDate: Date;
  method: string; // e.g. 'bank_transfer', 'cash', 'crypto'
  reference?: string;
  createdBy: ObjectId;
  createdAt: Date;
}

/** Opening balance / carry-forward journal entry. */
export type JournalEntryType = 'OPENING_BALANCE';

export interface JournalEntry {
  _id?: ObjectId;
  organizationId: ObjectId;
  type: JournalEntryType;
  referencePeriodId?: ObjectId;
  amount: number;
  currency: string;
  reason?: string;
  createdAt: Date;
  createdBy: ObjectId;
}

/** Write-off, credit note, or correction. */
export type AdjustmentType = 'WRITE_OFF' | 'CREDIT' | 'CORRECTION';

export interface Adjustment {
  _id?: ObjectId;
  organizationId: ObjectId;
  entityType: 'invoice' | 'payable';
  entityId: ObjectId;
  type: AdjustmentType;
  amount: number;
  currency: string;
  reason: string;
  createdBy: ObjectId;
  createdAt: Date;
}

/** Immutable finance audit log; before/after can be compressed for storage. */
export interface FinanceAuditLogEntry {
  _id?: ObjectId;
  organizationId: ObjectId;
  entityType: string;
  entityId: ObjectId;
  action: string;
  /** Optional: store compressed (e.g. gzip+base64) to save space; empty when not needed. */
  before?: string;
  after?: string;
  userId: ObjectId;
  timestamp: Date;
}
