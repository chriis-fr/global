import { ObjectId } from 'mongodb';

export type PaymentEventType =
  | 'MPESA_STK_REQUESTED'
  | 'MPESA_STK_COMPLETED'
  | 'MPESA_STK_FAILED';

export interface PaymentEvent {
  _id?: ObjectId;

  organizationId?: ObjectId;
  userId?: ObjectId; // waiter / actor

  type: PaymentEventType;

  // Reference to related entity (e.g. MpesaStkSession._id as string)
  referenceId?: string;

  // Minimal JSON payload for audit/debug (keep small to save space)
  data?: Record<string, unknown>;

  createdAt: Date;
}

