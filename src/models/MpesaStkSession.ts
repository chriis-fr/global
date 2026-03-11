import { ObjectId } from 'mongodb';

export type MpesaStkStatus = 'pending' | 'success' | 'failed';

export interface MpesaStkSession {
  _id?: ObjectId;

  // Ownership / attribution
  organizationId?: ObjectId;
  waiterUserId?: ObjectId; // User that initiated the STK (waiter)

  // Core STK data
  phoneNumber: string; // 2547XXXXXXXX
  amount: number; // KES
  status: MpesaStkStatus;

  // Daraja identifiers
  merchantRequestId?: string;
  checkoutRequestId?: string;

  // Result data
  mpesaReceiptNumber?: string;
  resultCode?: string;
  resultDescription?: string;

  // Optional contextual metadata (kept minimal)
  tableRef?: string; // Table/seat identifier for restaurants/bars
  reference?: string; // Internal reference if needed

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

