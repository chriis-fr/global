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
  _id: ObjectId;
  email: string;
  name: string;
  password?: string; // Optional for OAuth users
  avatar?: string;
  phone?: string;
  role: 'user' | 'admin';
  adminTag?: boolean; // Special admin tag for system admin access (separate from role)
  organizationId?: ObjectId;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // OAuth fields
  accounts?: {
    provider: string;
    providerAccountId: string;
    type: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }[];

  // Stripe fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  // Paystack fields
  paystackCustomerCode?: string;

  // Subscription & Billing Fields
  subscription: {
    planId: string; // e.g., 'receivables-free', 'payables-pro'
    status: 'trial' | 'active' | 'cancelled' | 'expired' | 'past_due';
    trialStartDate?: Date;
    trialEndDate?: Date;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    /** Set when payment fails; used for grace period and reminders */
    paymentFailedAt?: Date;
    billingPeriod: 'monthly' | 'yearly';
    stripePriceId?: string;
    paystackSubscriptionCode?: string; // Paystack subscription code
    paystackPlanCode?: string; // Paystack plan code
    seats?: number; // Number of seats purchased (for dynamic pricing plans)
    createdAt: Date;
    updatedAt: Date;
    // New trial system fields
    hasUsedTrial?: boolean; // Track if user has used their 15-day trial
    trialActivatedAt?: Date; // When the 15-day trial was activated
  };

  // Usage tracking
  usage: {
    invoicesThisMonth: number;
    monthlyVolume: number;
    lastResetDate: Date;
  };

  // Onboarding
  onboarding: {
    isCompleted: boolean;
    currentStep: number;
    completedSteps: string[];
    data?: Record<string, unknown>;
  };

  // Services
  services: UserServices;

  // Preferences
  preferences: {
    currency: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      invoiceReminders: boolean;
      paymentNotifications: boolean;
    };
  };

  // Profile / business
  industry?: string;
  address?: Address;
  taxId?: string;
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
  preferences?: {
    currency?: string;
    timezone?: string;
    notifications?: {
      email?: boolean;
      push?: boolean;
      invoiceReminders?: boolean;
      paymentNotifications?: boolean;
    };
  };
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