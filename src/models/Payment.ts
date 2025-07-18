import { ObjectId } from 'mongodb';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';
export type PaymentMethodType = 'crypto' | 'bank_transfer';

export interface Payment {
  _id?: ObjectId;
  invoiceId: ObjectId; // Reference to Invoices
  payerId: ObjectId; // Reference to Clients or Users
  amount: number;
  currency: string;
  transactionHash?: string; // For crypto payments
  paymentMethod: PaymentMethodType;
  status: PaymentStatus;
  paymentDate: Date;
  confirmationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  invoiceId: ObjectId;
  payerId: ObjectId;
  amount: number;
  currency: string;
  transactionHash?: string;
  paymentMethod: PaymentMethodType;
  status: PaymentStatus;
  paymentDate: Date;
  confirmationDate?: Date;
}

export interface UpdatePaymentInput {
  amount?: number;
  currency?: string;
  transactionHash?: string;
  paymentMethod?: PaymentMethodType;
  status?: PaymentStatus;
  paymentDate?: Date;
  confirmationDate?: Date;
} 