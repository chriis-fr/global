import { ObjectId } from 'mongodb';
import { Address } from './Organization';

export interface WalletAddress {
  address: string;
  currency: string; // e.g., "ETH", "BTC"
  network: string; // e.g., "Ethereum", "Bitcoin"
}

export interface UserSettings {
  currencyPreference: string; // e.g., "USD", "EUR"
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
    // Specific notification types
    invoiceCreated: boolean;
    invoicePaid: boolean;
    invoiceOverdue: boolean;
    paymentReceived: boolean;
    paymentFailed: boolean;
    systemUpdates: boolean;
    securityAlerts: boolean;
    reminders: boolean;
    approvals: boolean;
    // Frequency settings
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    quietHours: {
      enabled: boolean;
      start: string; // "22:00"
      end: string; // "08:00"
      timezone: string; // "UTC"
    };
  };
}

export interface UserServices {
  // Core Invoicing & Payments
  smartInvoicing: boolean;
  emailService: boolean;
  accountsReceivable: boolean;
  accountsPayable: boolean;
  
  // Business Operations
  expenses: boolean;
  payroll: boolean;
  
  // Blockchain Benefits
  immutableRecords: boolean;
  auditTrail: boolean;
  smartPayments: boolean;
  enhancedSecurity: boolean;
  
  // Integrations & APIs
  accounting: boolean;
  accountsPayableReceivableAPI: boolean;
  cryptoToFiat: boolean;
  offrampAPI: boolean;
}

export interface ServiceOnboarding {
  // Smart Invoicing
  smartInvoicing?: {
    invoiceTemplate: 'standard' | 'custom';
    paymentTerms: number; // days
    defaultCurrency: string;
    taxRates: Array<{
      name: string;
      rate: number;
      description?: string;
    }>;
    logo?: string;
    businessInfo: {
      name: string;
      address: Address;
      phone?: string;
      email: string;
      website?: string;
      taxId?: string;
    };
  };
  
  // Other services can be added here as needed
  [key: string]: unknown;
}

export interface User {
  _id?: ObjectId;
  email: string;
  password?: string; // hashed, optional for OAuth users
  name: string;
  role: string; // e.g., "admin", "user", "accountant"
  userType: 'individual' | 'business';
  
  // Profile
  phone?: string;
  profilePicture?: string; // URL to image
  avatar?: string; // Alternative avatar field
  googleId?: string; // Google OAuth ID
  googleEmail?: string; // Google email
  
  // Business Context
  industry?: string;
  organizationId?: ObjectId; // Reference to Organizations
  
  // Address
  address: Address;
  taxId?: string;
  
  // Crypto
  walletAddresses: WalletAddress[];
  
  // Settings & Services
  settings: UserSettings;
  services: UserServices;
  
  // Payment Methods (for individual users)
  paymentMethodSettings?: {
    defaultFiatMethod?: ObjectId;
    defaultCryptoMethod?: ObjectId;
    autoSelectPaymentMethod: boolean;
    allowMultipleMethods: boolean;
    supportedCurrencies: string[];
    supportedNetworks: string[];
  };
  
  // Onboarding
  onboarding: {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    serviceOnboarding: ServiceOnboarding;
  };
  
  // Status
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  
  // Legal Agreements
  termsAgreement?: {
    agreed: boolean;
    agreedAt: Date;
    termsVersion: string;
  };
  logos?: Array<{
    id: string;
    name: string;
    url: string;
    isDefault: boolean;
    createdAt: Date;
  }>;
}

export interface CreateUserInput {
  email: string;
  password?: string; // Optional for OAuth users
  name: string;
  role: string;
  userType: 'individual' | 'business';
  organizationId?: ObjectId;
  walletAddresses?: WalletAddress[];
  phone?: string;
  profilePicture?: string;
  avatar?: string;
  googleId?: string;
  googleEmail?: string;
  industry?: string;
  address: Address;
  taxId?: string;
  settings?: Partial<UserSettings>;
  services?: Partial<UserServices>;
  onboarding?: {
    completed?: boolean;
    currentStep?: number;
    completedSteps?: string[];
    serviceOnboarding?: Partial<ServiceOnboarding>;
  };
  termsAgreement?: {
    agreed: boolean;
    agreedAt: Date;
    termsVersion: string;
  };
}

export interface UpdateUserInput {
  name?: string;
  role?: string;
  userType?: 'individual' | 'business';
  organizationId?: ObjectId;
  walletAddresses?: WalletAddress[];
  phone?: string;
  profilePicture?: string;
  avatar?: string;
  googleId?: string;
  googleEmail?: string;
  industry?: string;
  address?: Address;
  taxId?: string;
  settings?: Partial<UserSettings>;
  services?: Partial<UserServices>;
  onboarding?: {
    completed?: boolean;
    currentStep?: number;
    completedSteps?: string[];
    serviceOnboarding?: Partial<ServiceOnboarding>;
  };
  status?: 'pending' | 'active' | 'suspended';
  emailVerified?: boolean;
  lastLoginAt?: Date;
  termsAgreement?: {
    agreed: boolean;
    agreedAt: Date;
    termsVersion: string;
  };
} 