import { ObjectId } from 'mongodb';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate: number; // e.g., 0.2 for 20% tax
}

export interface InvoiceTax {
  name: string; // e.g., "VAT", "GST"
  rate: number;
  amount: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'crypto' | 'bank_transfer' | 'credit_card';

export interface Invoice {
  _id?: ObjectId;
  invoiceNumber: string;
  issuerId: ObjectId; // Reference to Users or Organizations
  clientId: ObjectId; // Reference to Clients
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  currency: string; // e.g., "USD", "ETH", "BTC"
  items: InvoiceItem[];
  taxes: InvoiceTax[];
  totalAmount: number; // Sum of items and taxes
  paymentMethod: PaymentMethod;
  paymentAddress?: string; // Wallet address or bank details
  notes?: string;
  pdfUrl?: string; // URL to generated invoice PDF
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  issuerId: ObjectId;
  clientId: ObjectId;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  taxes: InvoiceTax[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentAddress?: string;
  notes?: string;
  pdfUrl?: string;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  issueDate?: Date;
  dueDate?: Date;
  amount?: number;
  currency?: string;
  items?: InvoiceItem[];
  taxes?: InvoiceTax[];
  totalAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentAddress?: string;
  notes?: string;
  pdfUrl?: string;
} 