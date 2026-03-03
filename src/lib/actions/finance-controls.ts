'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type {
  AccountingPeriod,
  InvoicePaymentEntry,
  Adjustment,
  JournalEntry,
  FinanceAuditLogEntry,
} from '@/models/FinanceControls';
import type { OrganizationMember } from '@/models/Organization';
import { RBACService } from '@/lib/services/rbacService';

const COLL = {
  ORGS: 'organizations',
  PERIODS: 'accounting_periods',
  PAYMENTS: 'invoice_payment_entries',
  ADJUSTMENTS: 'adjustments',
  JOURNAL: 'journal_entries',
  AUDIT: 'finance_audit_log',
  INVOICES: 'invoices',
} as const;

async function getOrgIdAndMember(
  db: Awaited<ReturnType<typeof getDatabase>>,
  userId: string,
  userEmail: string
): Promise<{ organizationId: ObjectId; member: OrganizationMember } | null> {
  const user = await db.collection('users').findOne({ email: userEmail });
  if (!user?.organizationId) return null;

  const org = await db.collection(COLL.ORGS).findOne({ _id: user.organizationId });
  if (!org) return null;

  const member = org.members?.find((m: OrganizationMember) => m.userId.toString() === user._id?.toString());
  if (!member) return null;

  return {
    organizationId: user.organizationId as ObjectId,
    member,
  };
}

function getFinanceSettings(
  db: Awaited<ReturnType<typeof getDatabase>>,
  organizationId: ObjectId
): Promise<{ periodLocking: boolean; bulkActions: boolean; carryForward: boolean; auditLog: boolean } | null> {
  return db
    .collection(COLL.ORGS)
    .findOne({ _id: organizationId }, { projection: { 'settings.financeControls': 1 } })
    .then((org) => org?.settings?.financeControls ?? null);
}

async function appendAudit(
  db: Awaited<ReturnType<typeof getDatabase>>,
  orgId: ObjectId,
  userId: ObjectId,
  entityType: string,
  entityId: ObjectId,
  action: string,
  before?: unknown,
  after?: unknown
) {
  const entry: Omit<FinanceAuditLogEntry, '_id'> = {
    organizationId: orgId,
    entityType,
    entityId,
    action,
    before: before !== undefined ? JSON.stringify(before) : undefined,
    after: after !== undefined ? JSON.stringify(after) : undefined,
    userId,
    timestamp: new Date(),
  };
  await db.collection(COLL.AUDIT).insertOne(entry);
}

/** Get finance controls settings for current org (feature flags). */
export async function getFinanceControlsSettings(): Promise<{
  success: boolean;
  data?: { periodLocking: boolean; bulkActions: boolean; carryForward: boolean; auditLog: boolean };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    if (!settings)
      return {
        success: true,
        data: {
          periodLocking: false,
          bulkActions: false,
          carryForward: false,
          auditLog: false,
        },
      };

    return { success: true, data: settings };
  } catch (e) {
    console.error('[finance-controls] getFinanceControlsSettings:', e);
    return { success: false, error: 'Failed to load settings' };
  }
}

/** Update finance controls settings (admin/owner only). */
export async function setFinanceControlsSettings(settings: {
  periodLocking?: boolean;
  bulkActions?: boolean;
  carryForward?: boolean;
  auditLog?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };
    if (ctx.member.role !== 'owner' && ctx.member.role !== 'admin')
      return { success: false, error: 'Only admins can change finance settings' };

    await db.collection(COLL.ORGS).updateOne(
      { _id: ctx.organizationId },
      {
        $set: {
          'settings.financeControls': {
            periodLocking: settings.periodLocking ?? false,
            bulkActions: settings.bulkActions ?? false,
            carryForward: settings.carryForward ?? false,
            auditLog: settings.auditLog ?? false,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: true };
  } catch (e) {
    console.error('[finance-controls] setFinanceControlsSettings:', e);
    return { success: false, error: 'Failed to save settings' };
  }
}

/** Get open period for org (first OPEN period by endDate desc). */
export async function getOpenPeriod(): Promise<{
  success: boolean;
  data?: AccountingPeriod & { _id: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const period = await db
      .collection<AccountingPeriod>(COLL.PERIODS)
      .findOne({ organizationId: ctx.organizationId, status: 'OPEN' }, { sort: { endDate: -1 } });
    if (!period) return { success: true, data: undefined };

    return {
      success: true,
      data: {
        ...period,
        _id: (period as { _id?: ObjectId })._id?.toString() ?? '',
      } as AccountingPeriod & { _id: string },
    };
  } catch (e) {
    console.error('[finance-controls] getOpenPeriod:', e);
    return { success: false, error: 'Failed to load period' };
  }
}

/** Get period that contains the given date. */
export async function getPeriodForDate(date: Date): Promise<{
  success: boolean;
  data?: (AccountingPeriod & { _id: string }) | null;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const d = new Date(date);
    const period = await db.collection<AccountingPeriod>(COLL.PERIODS).findOne({
      organizationId: ctx.organizationId,
      startDate: { $lte: d },
      endDate: { $gte: d },
    });
    if (!period) return { success: true, data: null };

    return {
      success: true,
      data: {
        ...period,
        _id: (period as { _id?: ObjectId })._id?.toString() ?? '',
      } as AccountingPeriod & { _id: string },
    };
  } catch (e) {
    console.error('[finance-controls] getPeriodForDate:', e);
    return { success: false, error: 'Failed to load period' };
  }
}

/** Create an accounting period (admin/owner or when periodLocking enabled and canClosePeriod). */
export async function createAccountingPeriod(startDate: Date, endDate: Date): Promise<{
  success: boolean;
  data?: { periodId: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    if (!settings?.periodLocking) return { success: false, error: 'Period locking is not enabled' };

    if (!RBACService.canClosePeriod(ctx.member))
      return { success: false, error: 'Insufficient permission to manage periods' };

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) return { success: false, error: 'startDate must be before endDate' };

    const existing = await db.collection(COLL.PERIODS).findOne({
      organizationId: ctx.organizationId,
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (existing) return { success: false, error: 'Period overlaps with an existing period' };

    const period: Omit<AccountingPeriod, '_id'> = {
      organizationId: ctx.organizationId,
      startDate: start,
      endDate: end,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection(COLL.PERIODS).insertOne(period as AccountingPeriod);
    if (!result.insertedId) return { success: false, error: 'Failed to create period' };

    if (settings.auditLog && session.user.id) {
      await appendAudit(
        db,
        ctx.organizationId,
        new ObjectId(session.user.id),
        'accounting_period',
        result.insertedId as ObjectId,
        'CREATE',
        undefined,
        period
      );
    }

    return { success: true, data: { periodId: result.insertedId.toString() } };
  } catch (e) {
    console.error('[finance-controls] createAccountingPeriod:', e);
    return { success: false, error: 'Failed to create period' };
  }
}

/** Close period (set status to CLOSED). */
export async function closePeriod(periodId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    if (!RBACService.canClosePeriod(ctx.member))
      return { success: false, error: 'Insufficient permission' };

    const pid = new ObjectId(periodId);
    const period = await db.collection<AccountingPeriod>(COLL.PERIODS).findOne({
      _id: pid,
      organizationId: ctx.organizationId,
    });
    if (!period) return { success: false, error: 'Period not found' };
    if (period.status !== 'OPEN') return { success: false, error: 'Period is not open' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    const userId = session.user.id ? new ObjectId(session.user.id) : undefined;

    await db.collection(COLL.PERIODS).updateOne(
      { _id: pid, organizationId: ctx.organizationId },
      {
        $set: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: userId,
          updatedAt: new Date(),
        },
      }
    );

    if (settings?.auditLog && userId) {
      await appendAudit(db, ctx.organizationId, userId, 'accounting_period', pid, 'CLOSE', { status: 'OPEN' }, { status: 'CLOSED' });
    }

    return { success: true };
  } catch (e) {
    console.error('[finance-controls] closePeriod:', e);
    return { success: false, error: 'Failed to close period' };
  }
}

/** Lock period (no invoice edits; only credit notes allowed). */
export async function lockPeriod(periodId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    if (!RBACService.canClosePeriod(ctx.member))
      return { success: false, error: 'Insufficient permission' };

    const pid = new ObjectId(periodId);
    const period = await db.collection<AccountingPeriod>(COLL.PERIODS).findOne({
      _id: pid,
      organizationId: ctx.organizationId,
    });
    if (!period) return { success: false, error: 'Period not found' };
    if (period.status === 'LOCKED') return { success: true };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    const userId = session.user.id ? new ObjectId(session.user.id) : undefined;

    await db.collection(COLL.PERIODS).updateOne(
      { _id: pid, organizationId: ctx.organizationId },
      {
        $set: {
          status: 'LOCKED',
          closedAt: period.closedAt ?? new Date(),
          closedBy: userId ?? period.closedBy,
          updatedAt: new Date(),
        },
      }
    );

    if (settings?.auditLog && userId) {
      await appendAudit(db, ctx.organizationId, userId, 'accounting_period', pid, 'LOCK', { status: period.status }, { status: 'LOCKED' });
    }

    return { success: true };
  } catch (e) {
    console.error('[finance-controls] lockPeriod:', e);
    return { success: false, error: 'Failed to lock period' };
  }
}

/** Sum of payment entries for an invoice. */
async function sumPaymentsForInvoice(
  db: Awaited<ReturnType<typeof getDatabase>>,
  invoiceId: ObjectId
): Promise<number> {
  const rows = await db
    .collection<InvoicePaymentEntry>(COLL.PAYMENTS)
    .find({ invoiceId })
    .toArray();
  return rows.reduce((s, r) => s + r.amount, 0);
}

/** Create a payment entry and update invoice status from ledger (paid if sum >= total, else partial). */
export async function createPaymentEntry(
  invoiceId: string,
  amount: number,
  paymentDate: Date,
  method: string,
  reference?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const iid = new ObjectId(invoiceId);
    const invoice = await db.collection(COLL.INVOICES).findOne({
      _id: iid,
      organizationId: ctx.organizationId,
    });
    if (!invoice) return { success: false, error: 'Invoice not found' };

    const total = invoice.total ?? invoice.totalAmount ?? 0;
    if (amount <= 0 || amount > total) return { success: false, error: 'Invalid amount' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    if (settings?.auditLog && session.user.id) {
      await appendAudit(
        db,
        ctx.organizationId,
        new ObjectId(session.user.id),
        'invoice',
        iid,
        'PAYMENT_ENTRY',
        undefined,
        { amount, paymentDate, method, reference }
      );
    }

    const entry: Omit<InvoicePaymentEntry, '_id'> = {
      organizationId: ctx.organizationId,
      invoiceId: iid,
      amount,
      currency: invoice.currency ?? 'USD',
      paymentDate: new Date(paymentDate),
      method,
      reference,
      createdBy: new ObjectId(session.user.id!),
      createdAt: new Date(),
    };
    await db.collection(COLL.PAYMENTS).insertOne(entry);

    const sum = await sumPaymentsForInvoice(db, iid);
    const newStatus = sum >= total ? 'paid' : 'partial';
    await db.collection(COLL.INVOICES).updateOne(
      { _id: iid },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );

    return { success: true };
  } catch (e) {
    console.error('[finance-controls] createPaymentEntry:', e);
    return { success: false, error: 'Failed to record payment' };
  }
}

/** Bulk create payment entries for multiple invoices (same date/method/reference); each invoice gets one full-amount entry. */
export async function bulkCreatePaymentEntries(
  invoiceIds: string[],
  paymentDate: Date,
  method: string,
  reference?: string
): Promise<{ success: boolean; created: number; errors?: string[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, created: 0, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, created: 0, error: 'Organization not found' };

    if (!RBACService.canBulkUpdate(ctx.member))
      return { success: false, created: 0, error: 'Insufficient permission for bulk update' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    if (!settings?.bulkActions) return { success: false, created: 0, error: 'Bulk actions not enabled' };

    const userId = new ObjectId(session.user.id!);
    const date = new Date(paymentDate);
    const errors: string[] = [];
    let created = 0;

    for (const id of invoiceIds) {
      try {
        const iid = new ObjectId(id);
        const invoice = await db.collection(COLL.INVOICES).findOne({
          _id: iid,
          organizationId: ctx.organizationId,
        });
        if (!invoice) {
          errors.push(`Invoice ${id} not found`);
          continue;
        }
        const total = invoice.total ?? invoice.totalAmount ?? 0;
        if (total <= 0) {
          errors.push(`Invoice ${id} has no amount`);
          continue;
        }

        if (settings.auditLog) {
          await appendAudit(db, ctx.organizationId, userId, 'invoice', iid, 'BULK_PAYMENT_ENTRY', undefined, { amount: total, paymentDate: date, method, reference });
        }

        const entry: Omit<InvoicePaymentEntry, '_id'> = {
          organizationId: ctx.organizationId,
          invoiceId: iid,
          amount: total,
          currency: invoice.currency ?? 'USD',
          paymentDate: date,
          method,
          reference,
          createdBy: userId,
          createdAt: new Date(),
        };
        await db.collection(COLL.PAYMENTS).insertOne(entry);

        const sum = await sumPaymentsForInvoice(db, iid);
        const newStatus = sum >= total ? 'paid' : 'partial';
        await db.collection(COLL.INVOICES).updateOne(
          { _id: iid },
          { $set: { status: newStatus, updatedAt: new Date() } }
        );
        created++;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { success: true, created, errors: errors.length ? errors : undefined };
  } catch (e) {
    console.error('[finance-controls] bulkCreatePaymentEntries:', e);
    return { success: false, created: 0, error: 'Failed to process bulk payments' };
  }
}

/** Get payment entries for an invoice (for display / derived status). */
export async function getPaymentEntriesForInvoice(invoiceId: string): Promise<{
  success: boolean;
  data?: InvoicePaymentEntry[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const iid = new ObjectId(invoiceId);
    const invoice = await db.collection(COLL.INVOICES).findOne({
      _id: iid,
      organizationId: ctx.organizationId,
    });
    if (!invoice) return { success: false, error: 'Invoice not found' };

    const rows = await db
      .collection<InvoicePaymentEntry>(COLL.PAYMENTS)
      .find({ invoiceId: iid })
      .sort({ paymentDate: 1 })
      .toArray();

    return {
      success: true,
      data: rows,
    };
  } catch (e) {
    console.error('[finance-controls] getPaymentEntriesForInvoice:', e);
    return { success: false, error: 'Failed to load payments' };
  }
}

/** Create write-off / credit / correction. */
export async function createAdjustment(
  entityType: 'invoice' | 'payable',
  entityId: string,
  type: 'WRITE_OFF' | 'CREDIT' | 'CORRECTION',
  amount: number,
  reason: string,
  currency?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    if (!RBACService.canWriteOff(ctx.member))
      return { success: false, error: 'Insufficient permission to create adjustments' };

    const eid = new ObjectId(entityId);
    const coll = entityType === 'invoice' ? COLL.INVOICES : 'payables';
    const entity = await db.collection(coll).findOne({
      _id: eid,
      organizationId: ctx.organizationId,
    });
    if (!entity) return { success: false, error: `${entityType} not found` };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    const adj: Omit<Adjustment, '_id'> = {
      organizationId: ctx.organizationId,
      entityType,
      entityId: eid,
      type,
      amount,
      currency: currency ?? entity.currency ?? 'USD',
      reason,
      createdBy: new ObjectId(session.user.id!),
      createdAt: new Date(),
    };
    const result = await db.collection(COLL.ADJUSTMENTS).insertOne(adj as Adjustment);
    if (!result.insertedId) return { success: false, error: 'Failed to create adjustment' };

    if (settings?.auditLog && session.user.id) {
      await appendAudit(
        db,
        ctx.organizationId,
        new ObjectId(session.user.id),
        'adjustment',
        result.insertedId as ObjectId,
        'CREATE',
        undefined,
        adj
      );
    }

    return { success: true };
  } catch (e) {
    console.error('[finance-controls] createAdjustment:', e);
    return { success: false, error: 'Failed to create adjustment' };
  }
}

/** Carry forward: create OPENING_BALANCE journal entries for next period from unpaid balances (simplified: sum unpaid invoice totals). */
export async function carryForward(
  fromPeriodId: string,
  toPeriodStartDate: Date,
  toPeriodEndDate: Date
): Promise<{ success: boolean; data?: { journalEntryIds: string[] }; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const settings = await getFinanceSettings(db, ctx.organizationId);
    if (!settings?.carryForward) return { success: false, error: 'Carry forward is not enabled' };

    if (!RBACService.canClosePeriod(ctx.member))
      return { success: false, error: 'Insufficient permission' };

    const fromPeriod = await db.collection<AccountingPeriod>(COLL.PERIODS).findOne({
      _id: new ObjectId(fromPeriodId),
      organizationId: ctx.organizationId,
    });
    if (!fromPeriod || fromPeriod.status !== 'CLOSED' && fromPeriod.status !== 'LOCKED')
      return { success: false, error: 'Source period must be closed or locked' };

    const unpaid = await db
      .collection(COLL.INVOICES)
      .find({
        organizationId: ctx.organizationId,
        status: { $in: ['sent', 'pending', 'overdue'] },
        issueDate: { $gte: fromPeriod.startDate, $lte: fromPeriod.endDate },
      })
      .toArray();

    const byCurrency: Record<string, number> = {};
    for (const inv of unpaid) {
      const t = inv.total ?? inv.totalAmount ?? 0;
      const cur = inv.currency ?? 'USD';
      byCurrency[cur] = (byCurrency[cur] ?? 0) + t;
    }

    const toStart = new Date(toPeriodStartDate);
    const toEnd = new Date(toPeriodEndDate);
    const userId = new ObjectId(session.user.id!);
    const journalEntryIds: string[] = [];

    for (const [currency, amount] of Object.entries(byCurrency)) {
      if (amount <= 0) continue;
      const entry: Omit<JournalEntry, '_id'> = {
        organizationId: ctx.organizationId,
        type: 'OPENING_BALANCE',
        referencePeriodId: fromPeriod._id as ObjectId,
        amount,
        currency,
        reason: `Carry forward from period ${fromPeriodId}`,
        createdAt: new Date(),
        createdBy: userId,
      };
      const res = await db.collection(COLL.JOURNAL).insertOne(entry as JournalEntry);
      if (res.insertedId) journalEntryIds.push(res.insertedId.toString());
    }

    if (settings.auditLog && userId) {
      await appendAudit(
        db,
        ctx.organizationId,
        userId,
        'carry_forward',
        new ObjectId(fromPeriodId),
        'CARRY_FORWARD',
        undefined,
        { toPeriodStart: toStart, toPeriodEnd: toEnd, journalEntryIds, byCurrency }
      );
    }

    return { success: true, data: { journalEntryIds } };
  } catch (e) {
    console.error('[finance-controls] carryForward:', e);
    return { success: false, error: 'Failed to carry forward' };
  }
}

/** Get finance audit log (paginated). */
export async function getFinanceAuditLog(options?: {
  limit?: number;
  skip?: number;
  entityType?: string;
  entityId?: string;
}): Promise<{
  success: boolean;
  data?: { entries: FinanceAuditLogEntry[]; total: number };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    if (!RBACService.canViewFinanceAudit(ctx.member))
      return { success: false, error: 'Insufficient permission to view audit log' };

    const filter: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (options?.entityType) filter.entityType = options.entityType;
    if (options?.entityId) filter.entityId = new ObjectId(options.entityId);

    const limit = Math.min(options?.limit ?? 50, 200);
    const skip = options?.skip ?? 0;

    const [entries, total] = await Promise.all([
      db
        .collection<FinanceAuditLogEntry>(COLL.AUDIT)
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(COLL.AUDIT).countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        entries,
        total,
      },
    };
  } catch (e) {
    console.error('[finance-controls] getFinanceAuditLog:', e);
    return { success: false, error: 'Failed to load audit log' };
  }
}

/** Financial insights (AR aging, payment velocity, overdue count, volume trend) — calculated from existing data, no new API. */
export async function getFinancialInsights(periodStart?: Date, periodEnd?: Date): Promise<{
  success: boolean;
  data?: {
    arAging: { current: number; days30: number; days60: number; days90Plus: number };
    paymentVelocity: number; // avg days from issue to paid
    overdueCount: number;
    totalOutstanding: number;
    volumeTrend: number; // total invoiced in period
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };

    const db = await getDatabase();
    const ctx = await getOrgIdAndMember(db, session.user.id!, session.user.email);
    if (!ctx) return { success: false, error: 'Organization not found' };

    const now = new Date();
    const start = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = periodEnd ? new Date(periodEnd) : now;

    const unpaidInvoices = await db
      .collection(COLL.INVOICES)
      .find({
        organizationId: ctx.organizationId,
        status: { $in: ['sent', 'pending', 'overdue'] },
        total: { $gt: 0 },
      })
      .toArray();

    let current = 0,
      days30 = 0,
      days60 = 0,
      days90Plus = 0;
    let totalOutstanding = 0;
    for (const inv of unpaidInvoices) {
      const amt = inv.total ?? inv.totalAmount ?? 0;
      totalOutstanding += amt;
      const due = inv.dueDate ? new Date(inv.dueDate) : now;
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
      if (daysOverdue <= 0) current += amt;
      else if (daysOverdue <= 30) days30 += amt;
      else if (daysOverdue <= 60) days60 += amt;
      else days90Plus += amt;
    }

    const paidInPeriodRaw = await db.collection(COLL.PAYMENTS).find({
      organizationId: ctx.organizationId,
      paymentDate: { $gte: start, $lte: end },
    }).toArray();
    const paidInPeriod = paidInPeriodRaw as Array<{ invoiceId?: ObjectId }>;
    const paidInvIds = [
      ...new Set(
        paidInPeriod
          .map((p) => p.invoiceId?.toString())
          .filter((id): id is string => Boolean(id))
      ),
    ];
    let sumDaysToPay = 0;
    let countPaid = 0;
    for (const invId of paidInvIds) {
      const inv = await db.collection(COLL.INVOICES).findOne({
        _id: new ObjectId(invId),
        organizationId: ctx.organizationId,
        status: 'paid',
      });
      if (inv?.issueDate && inv?.updatedAt) {
        const paidAt = inv.updatedAt ? new Date(inv.updatedAt) : now;
        sumDaysToPay += Math.floor((paidAt.getTime() - new Date(inv.issueDate).getTime()) / (24 * 60 * 60 * 1000));
        countPaid++;
      }
    }
    const paymentVelocity = countPaid > 0 ? sumDaysToPay / countPaid : 0;

    const overdueCount = await db.collection(COLL.INVOICES).countDocuments({
      organizationId: ctx.organizationId,
      status: { $in: ['sent', 'pending', 'overdue'] },
      dueDate: { $lt: now },
    });

    const volumeTrend = await db.collection(COLL.INVOICES).aggregate([
      {
        $match: {
          organizationId: ctx.organizationId,
          issueDate: { $gte: start, $lte: end },
          status: { $ne: 'draft' },
        },
      },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]).toArray();
    const volume = (volumeTrend[0] as { total?: number } | undefined)?.total ?? 0;

    return {
      success: true,
      data: {
        arAging: { current, days30, days60, days90Plus },
        paymentVelocity,
        overdueCount,
        totalOutstanding,
        volumeTrend: volume,
      },
    };
  } catch (e) {
    console.error('[finance-controls] getFinancialInsights:', e);
    return { success: false, error: 'Failed to compute insights' };
  }
}

/** Check if an invoice's period is locked (for use in invoice update path). */
export async function isInvoiceInLockedPeriod(invoiceId: string, organizationId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    const invoice = await db.collection(COLL.INVOICES).findOne({
      _id: new ObjectId(invoiceId),
      organizationId: new ObjectId(organizationId),
    });
    if (!invoice?.issueDate) return false;

    const settings = await getFinanceSettings(db, new ObjectId(organizationId));
    if (!settings?.periodLocking) return false;

    const period = await db.collection<AccountingPeriod>(COLL.PERIODS).findOne({
      organizationId: new ObjectId(organizationId),
      startDate: { $lte: new Date(invoice.issueDate) },
      endDate: { $gte: new Date(invoice.issueDate) },
      status: 'LOCKED',
    });
    return !!period;
  } catch {
    return false;
  }
}
