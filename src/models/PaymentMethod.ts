import { ObjectId } from 'mongodb';

// Payment Method Types
export type PaymentMethodType = 'fiat' | 'crypto';

// Fiat Payment Subtypes
export type FiatPaymentSubtype = 'bank' | 'mpesa_paybill' | 'mpesa_till';

// Fiat Payment Method Details
export interface FiatPaymentDetails {
  subtype: FiatPaymentSubtype;
  // Bank details (for bank subtype)
  bankName?: string;
  swiftCode?: string;
  bankCode?: string;
  branchCode?: string;
  accountName?: string;
  accountNumber?: string;
  branchAddress?: string;
  accountType?: 'checking' | 'savings' | 'business';
  // Custom bank fields (for banks not in the predefined list) - dynamic key-value pairs
  customFields?: Record<string, string>; // e.g., { "Bank Address": "123 Main St", "Routing Number": "123456" }
  // M-Pesa Paybill details (for mpesa_paybill subtype)
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  // M-Pesa Till details (for mpesa_till subtype)
  tillNumber?: string;
  // Common fields
  businessName?: string;
  currency: string; // e.g., "USD", "EUR", "GBP", "KES"
  country: string;
}

// Safe Wallet Details (extends crypto payment method)
export interface SafeWalletDetails {
  safeAddress: string;
  owners: string[]; // Array of owner addresses
  threshold: number; // Number of signatures required (e.g., 2 of 3)
  version?: string; // Safe version
  modules?: string[]; // Connected modules
  networks?: string[]; // Connected networks
  nonce?: number; // Current nonce
  connectionMethod?: 'safe_app' | 'wallet_connect' | 'manual' | 'imported';
  safeAppAuthorized?: boolean; // If connected via Safe App
  authorizedAt?: Date; // When Safe App was authorized
  chainId?: number; // Chain ID where Safe is deployed
}

// Crypto Payment Method Details
export interface CryptoPaymentDetails {
  address: string;
  network: string; // e.g., "Ethereum", "Bitcoin", "Polygon", "Celo"
  currency: string; // e.g., "ETH", "BTC", "USDC"
  chainId?: number; // Blockchain network ID (e.g., 42220 for Celo)
  tokenAddress?: string; // ERC20 token contract address
  label?: string; // Optional label for the wallet
  isDefault?: boolean;
  // Safe wallet details (if this is a Safe wallet)
  safeDetails?: SafeWalletDetails;
}


// Base Payment Method Interface
export interface PaymentMethod {
  _id?: ObjectId;
  name: string; // User-friendly name like "Main Bank Account" or "Ethereum Wallet"
  type: PaymentMethodType;
  isDefault: boolean;
  isActive: boolean;
  
  // Fiat or Crypto specific details
  fiatDetails?: FiatPaymentDetails;
  cryptoDetails?: CryptoPaymentDetails;
  
  // Metadata
  description?: string;
  tags?: string[]; // For categorization like "primary", "backup", "international"
  
  // Ownership
  organizationId?: ObjectId; // For organization payment methods
  userId?: ObjectId; // For individual user payment methods
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Input interfaces for creating/updating payment methods
export interface CreateFiatPaymentMethodInput {
  name: string;
  subtype: FiatPaymentSubtype;
  // Bank details (for bank subtype)
  bankName?: string;
  swiftCode?: string;
  bankCode?: string;
  branchCode?: string;
  accountName?: string;
  accountNumber?: string;
  branchAddress?: string;
  accountType?: 'checking' | 'savings' | 'business';
  // Custom bank fields (for banks not in the predefined list) - dynamic key-value pairs
  customFields?: Record<string, string>; // e.g., { "Bank Address": "123 Main St", "Routing Number": "123456" }
  // M-Pesa Paybill details (for mpesa_paybill subtype)
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  // M-Pesa Till details (for mpesa_till subtype)
  tillNumber?: string;
  // Common fields
  businessName?: string;
  currency: string;
  country: string;
  isDefault?: boolean;
  description?: string;
  tags?: string[];
}

export interface CreateCryptoPaymentMethodInput {
  name: string;
  address: string;
  network: string;
  currency: string;
  label?: string;
  isDefault?: boolean;
  description?: string;
  tags?: string[];
  safeDetails?: SafeWalletDetails; // For Safe wallet connections
}


export interface CreatePaymentMethodInput {
  name: string;
  type: PaymentMethodType;
  isDefault?: boolean;
  description?: string;
  tags?: string[];
  fiatDetails?: CreateFiatPaymentMethodInput;
  cryptoDetails?: CreateCryptoPaymentMethodInput;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
  description?: string;
  tags?: string[];
  fiatDetails?: Partial<FiatPaymentDetails>;
  cryptoDetails?: Partial<CryptoPaymentDetails>;
  safeDetails?: Partial<SafeWalletDetails>; // For updating Safe wallet details
}

// Payment Method Settings for Organizations/Users
export interface PaymentMethodSettings {
  defaultFiatMethod?: ObjectId;
  defaultCryptoMethod?: ObjectId;
  autoSelectPaymentMethod: boolean; // Auto-select based on invoice currency
  allowMultipleMethods: boolean; // Allow multiple payment methods per invoice
  supportedCurrencies: string[]; // Supported currencies for this entity
  supportedNetworks: string[]; // Supported crypto networks
}

// Payment Method Validation
export interface PaymentMethodValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Payment Method Statistics
export interface PaymentMethodStats {
  totalMethods: number;
  fiatMethods: number;
  cryptoMethods: number;
  activeMethods: number;
  defaultMethods: {
    fiat?: ObjectId;
    crypto?: ObjectId;
  };
} 