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
  transactionDate?: Date; // Parsed from Daraja's TransactionDate (YYYYMMDDHHMMSS)

  // Customer identity — populated by C2B confirmation callback (arrives shortly after STK callback)
  customerFirstName?: string;
  customerMiddleName?: string;
  customerLastName?: string;

  // Optional contextual metadata (kept minimal)
  tableRef?: string; // Table/seat identifier for restaurants/bars
  reference?: string; // Internal reference if needed

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

