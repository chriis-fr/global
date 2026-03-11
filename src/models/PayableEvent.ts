import { ObjectId } from 'mongodb';

export type PayableEventType =
  | 'invoice_submitted'
  | 'invoice_approved'
  | 'invoice_rejected'
  | 'payment_proof_uploaded'
  | 'payment_marked_paid'
  | 'note_added';

export interface PayableEvent {
  _id?: ObjectId;
  organizationId?: ObjectId;
  payableId: ObjectId;
  vendorId?: ObjectId;
  actorUserId?: ObjectId;
  eventType: PayableEventType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

