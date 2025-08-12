import { ObjectId } from 'mongodb';

// Payment Method Types
export type PaymentMethodType = 'fiat' | 'crypto';

// Fiat Payment Method Details
export interface FiatPaymentDetails {
  bankName: string;
  swiftCode: string;
  bankCode: string;
  branchCode: string;
  accountName: string;
  accountNumber: string;
  branchAddress: string;
  accountType: 'checking' | 'savings' | 'business';
  currency: string; // e.g., "USD", "EUR", "GBP"
  country: string;
}

// Crypto Payment Method Details
export interface CryptoPaymentDetails {
  address: string;
  network: string; // e.g., "Ethereum", "Bitcoin", "Polygon"
  currency: string; // e.g., "ETH", "BTC", "USDC"
  label?: string; // Optional label for the wallet
  isDefault?: boolean;
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
  bankName: string;
  swiftCode: string;
  bankCode: string;
  branchCode: string;
  accountName: string;
  accountNumber: string;
  branchAddress: string;
  accountType: 'checking' | 'savings' | 'business';
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