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

export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'pending_approval' | 'approved' | 'rejected' | 'proposed';
export type PaymentMethod = 'crypto' | 'fiat';
export type InvoiceType = 'regular' | 'recurring';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringEndType = 'specific_count' | 'specific_date' | 'manual_cancel';

export interface CompanyDetails {
  name: string;
  firstName: string;
  lastName: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  taxNumber: string;
  logo?: string; // URL to uploaded logo
}

export interface ClientDetails {
  email: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  country: string;
  region?: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  taxNumber?: string;
}

export interface PaymentSettings {
  method: PaymentMethod;
  paymentMethodId?: ObjectId; // Reference to PaymentMethod
  currency: string;
  enableMultiCurrency?: boolean;
  cryptoNetwork?: string;
  cryptoCurrency?: string;
  walletAddress?: string;
  chainId?: number; // Chain ID for crypto payments (e.g., 42220 for Celo)
  tokenAddress?: string; // Contract address for the crypto token
  bankAccount?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    accountType: string;
  };
}

export interface RecurringSettings {
  frequency: RecurringFrequency;
  startDate: Date;
  endType: RecurringEndType;
  endDate?: Date;
  numberOfInvoices?: number;
  isActive: boolean;
}

export interface Invoice {
  _id?: ObjectId;
  invoiceNumber: string; // Unique per organization
  organizationId: ObjectId; // Reference to organization
  issuerId: ObjectId; // Reference to Users or Organizations
  clientId?: ObjectId; // Reference to Clients (optional for new clients)
  
  // Invoice Type and Status
  type: InvoiceType;
  status: InvoiceStatus;
  
  // Dates
  issueDate: Date;
  dueDate: Date;
  
  // Company and Client Details
  companyDetails: CompanyDetails;
  clientDetails: ClientDetails;
  
  // Financial Information
  currency: string;
  items: InvoiceItem[];
  taxes: InvoiceTax[];
  subtotal: number;
  total: number; // Primary total field
  totalAmount: number; // Backward compatibility
  
  // Payment Settings
  paymentSettings: PaymentSettings;
  
  // Recurring Settings (if applicable)
  recurringSettings?: RecurringSettings;
  
  // Additional Information
  notes?: string;
  pdfUrl?: string; // URL to generated invoice PDF
  attachedFiles?: Array<{
    filename: string;
    originalName: string;
    size: number;
    contentType: string;
    uploadedAt: Date;
  }>;
  
  // Approval Workflow
  approvalWorkflow?: {
    requiresApproval: boolean;
    submittedBy: ObjectId; // User who submitted for approval
    submittedAt: Date;
    approvedBy?: ObjectId; // Admin who approved
    approvedAt?: Date;
    rejectedBy?: ObjectId; // Admin who rejected
    rejectedAt?: Date;
    rejectionReason?: string;
    comments?: string;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Template Information (for saving as template)
  isTemplate: boolean;
  templateName?: string;
  
  // Recipient type for conditional approval display
  recipientType?: 'individual' | 'organization';
  
  // Delivery method
  sentVia?: 'email' | 'whatsapp';
  
  // Blockchain Payment Fields (for crypto payments)
  tokenAddress?: string; // ERC20 token contract address
  tokenDecimals?: number; // Token decimals (e.g., 18 for most tokens)
  payeeAddress?: string; // Recipient wallet address for crypto payments
  chainId?: number; // Blockchain network ID (e.g., 42220 for Celo)
  txHash?: string; // Transaction hash after payment
  safeTxHash?: string; // Safe transaction hash (for multisig payments)
  
  // Receiving Address Metadata (Request Finance pattern)
  receivingMethod?: 'manual' | 'wallet'; // How the receiving address was entered
  receivingWalletType?: string | null; // Type of wallet if connected (safe, metamask, walletconnect, etc.)
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  organizationId: ObjectId;
  issuerId: ObjectId;
  clientId?: ObjectId;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  companyDetails: CompanyDetails;
  clientDetails: ClientDetails;
  currency: string;
  items: InvoiceItem[];
  taxes: InvoiceTax[];
  subtotal: number;
  totalAmount: number;
  paymentSettings: PaymentSettings;
  recurringSettings?: RecurringSettings;
  notes?: string;
  isTemplate?: boolean;
  templateName?: string;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  issueDate?: Date;
  dueDate?: Date;
  companyDetails?: Partial<CompanyDetails>;
  clientDetails?: Partial<ClientDetails>;
  currency?: string;
  items?: InvoiceItem[];
  taxes?: InvoiceTax[];
  subtotal?: number;
  totalAmount?: number;
  paymentSettings?: Partial<PaymentSettings>;
  recurringSettings?: Partial<RecurringSettings>;
  notes?: string;
  isTemplate?: boolean;
  templateName?: string;
}

// Currency options for the dropdown
export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' }
];

// Crypto currencies for payment
export const CRYPTO_CURRENCIES = [
  { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC' },
  { code: 'USDT', name: 'Tether', symbol: 'USDT' },
  { code: 'DAI', name: 'Dai', symbol: 'DAI' }
];

// Crypto networks
export const CRYPTO_NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'binance', name: 'Binance Smart Chain', symbol: 'BNB' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB' },
  { id: 'optimism', name: 'Optimism', symbol: 'OP' }
];

// Invoice number generation utility
export const generateInvoiceNumber = (organizationId: string, lastInvoiceNumber?: string): string => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  if (!lastInvoiceNumber) {
    return `INV-${organizationId.slice(-6)}-${currentYear}${currentMonth}-0001`;
  }
  
  // Extract the sequence number from the last invoice
  const match = lastInvoiceNumber.match(/-(\d{4})$/);
  if (match) {
    const sequence = parseInt(match[1]) + 1;
    return `INV-${organizationId.slice(-6)}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Fallback if parsing fails
  return `INV-${organizationId.slice(-6)}-${currentYear}${currentMonth}-0001`;
}; 