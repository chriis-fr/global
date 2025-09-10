import { ObjectId } from 'mongodb';

export type LedgerEntryType = 'receivable' | 'payable';
export type LedgerEntryStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethodType = 'fiat' | 'crypto';
export type CurrencyType = 'USD' | 'EUR' | 'GBP' | 'USDC' | 'USDT' | 'DAI' | 'ETH' | 'BTC' | string;

export interface Counterparty {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  taxId?: string;
  notes?: string;
}

export interface PaymentDetails {
  method: PaymentMethodType;
  network?: string; // For crypto payments
  address?: string; // Wallet address or bank account
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  // M-Pesa fields
  paybillNumber?: string;
  tillNumber?: string;
  mpesaAccountNumber?: string;
}

export interface LedgerItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  amount: number;
}

export interface FinancialLedgerEntry {
  _id?: ObjectId;
  
  // Core identification
  entryId: string; // Unique identifier like INV-XXXX-YYYYMM-NNNN or PAY-XXXX-YYYYMM-NNNN
  type: LedgerEntryType; // 'receivable' or 'payable'
  
  // Ownership and organization
  ownerId: string; // User email for individuals, organizationId for businesses
  ownerType: 'individual' | 'organization';
  userId: string; // Creator's email
  organizationId?: string;
  issuerId: string; // User ID who created the entry
  
  // Related entities
  relatedInvoiceId?: ObjectId; // Reference to original invoice
  relatedPayableId?: ObjectId; // Reference to original payable
  counterpartyId?: ObjectId; // Reference to client/vendor
  
  // Financial details
  counterparty: Counterparty;
  amount: number;
  currency: CurrencyType;
  subtotal: number;
  totalTax: number;
  items: LedgerItem[];
  
  // Payment information
  paymentDetails: PaymentDetails;
  paymentLink?: string; // Generated payment link
  
  // Dates
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  
  // Status and workflow
  status: LedgerEntryStatus;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  
  // Approval workflow
  approvalWorkflow?: {
    requiresApproval: boolean;
    submittedBy: string;
    submittedAt: Date;
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    comments?: string;
  };
  
  // Blockchain integration
  transactionHash?: string; // For crypto payments
  blockchainNetwork?: string;
  walletAddress?: string;
  
  // Additional information
  notes?: string;
  memo?: string;
  attachedFiles?: Array<{
    filename: string;
    originalName: string;
    size: number;
    contentType: string;
    uploadedAt: Date;
  }>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Sync information
  lastSyncedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export interface CreateLedgerEntryInput {
  type: LedgerEntryType;
  counterparty: Counterparty;
  amount: number;
  currency: CurrencyType;
  subtotal: number;
  totalTax: number;
  items: LedgerItem[];
  paymentDetails: PaymentDetails;
  issueDate: Date;
  dueDate: Date;
  status?: LedgerEntryStatus;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  notes?: string;
  memo?: string;
  relatedInvoiceId?: ObjectId;
  relatedPayableId?: ObjectId;
  counterpartyId?: ObjectId;
}

export interface UpdateLedgerEntryInput {
  counterparty?: Counterparty;
  amount?: number;
  currency?: CurrencyType;
  subtotal?: number;
  totalTax?: number;
  items?: LedgerItem[];
  paymentDetails?: PaymentDetails;
  issueDate?: Date;
  dueDate?: Date;
  status?: LedgerEntryStatus;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  notes?: string;
  memo?: string;
  paidDate?: Date;
  transactionHash?: string;
  blockchainNetwork?: string;
  walletAddress?: string;
}

export interface LedgerStats {
  totalReceivables: number;
  totalPayables: number;
  netBalance: number; // receivables - payables
  pendingReceivables: number;
  pendingPayables: number;
  overdueReceivables: number;
  overduePayables: number;
  paidReceivables: number;
  paidPayables: number;
  totalReceivablesAmount: number;
  totalPayablesAmount: number;
  currency: string;
}

export interface LedgerFilters {
  type?: LedgerEntryType;
  status?: LedgerEntryStatus;
  currency?: CurrencyType;
  counterparty?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
}

export interface LedgerPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
