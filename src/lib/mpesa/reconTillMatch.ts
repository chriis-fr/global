import type { ObjectId } from 'mongodb';

/**
 * Reconciliation rows that represent till/C2B money attributed to a waiter,
 * excluding rows linked to an STK session so totals are not double-counted with mpesa_stk_sessions.
 */
export function reconTillAttributedNoStkLink(orgOid: ObjectId) {
  return {
    organizationId: orgOid,
    provider: 'mpesa' as const,
    status: 'success' as const,
    waiterUserId: { $exists: true, $ne: null },
    $or: [{ stkSessionId: { $exists: false } }, { stkSessionId: null }],
  };
}
