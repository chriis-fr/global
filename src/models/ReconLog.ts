import { ObjectId } from 'mongodb';
import type { MatchStatus } from './ReconTransaction';

export type ReconAction =
  | 'auto_created'
  | 'auto_matched'
  | 'status_changed'
  | 'match_status_changed'
  | 'duplicate_detected'
  | 'mismatch_detected'
  | 'manual_override'
  | 'reconcile_run';

export interface ReconLog {
  _id?: ObjectId;
  organizationId: ObjectId;
  transactionId?: ObjectId;    // null for org-level events like 'reconcile_run'
  action: ReconAction;
  previousMatchStatus?: MatchStatus;
  newMatchStatus?: MatchStatus;
  actor: 'system' | string;   // 'system' or userId
  note?: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}
