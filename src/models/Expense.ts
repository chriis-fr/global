import { ObjectId } from 'mongodb';

export type ExpenseStatus = 'submitted' | 'approved' | 'reimbursed' | 'rejected';
export type ExpenseCategory = 'travel' | 'software' | 'office' | 'meals' | 'transportation' | 'other';

export interface Expense {
  _id?: ObjectId;
  userId: ObjectId; // Reference to Users
  organizationId: ObjectId; // Reference to Organizations
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  receiptUrl?: string; // URL to receipt file
  submittedAt: Date;
  approvedAt?: Date;
  reimbursedAt?: Date;
  approverId?: ObjectId; // Reference to Users (approver)
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseInput {
  userId: ObjectId;
  organizationId: ObjectId;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  receiptUrl?: string;
  submittedAt: Date;
  approvedAt?: Date;
  reimbursedAt?: Date;
  approverId?: ObjectId;
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  currency?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  receiptUrl?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  reimbursedAt?: Date;
  approverId?: ObjectId;
} 