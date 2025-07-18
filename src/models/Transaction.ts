import { ObjectId } from 'mongodb';

export type TransactionType = 'invoice_payment' | 'expense_reimbursement' | 'crypto_transfer' | 'bank_transfer';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  _id?: ObjectId;
  type: TransactionType;
  relatedId: ObjectId; // Reference to Invoices, Expenses, etc.
  userId: ObjectId; // Reference to Users
  organizationId: ObjectId; // Reference to Organizations
  amount: number;
  currency: string;
  transactionHash?: string; // For crypto transactions
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionInput {
  type: TransactionType;
  relatedId: ObjectId;
  userId: ObjectId;
  organizationId: ObjectId;
  amount: number;
  currency: string;
  transactionHash?: string;
  status: TransactionStatus;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  relatedId?: ObjectId;
  userId?: ObjectId;
  organizationId?: ObjectId;
  amount?: number;
  currency?: string;
  transactionHash?: string;
  status?: TransactionStatus;
} 