import { ObjectId } from 'mongodb';
import { UserServices, ServiceOnboarding } from './User';

export interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface OrganizationMember {
  _id?: ObjectId;
  userId: ObjectId; // Reference to Users
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'financeManager' | 'accountant' | 'approver';
  permissions: PermissionSet;
  status: 'active' | 'suspended' | 'pending';
  invitedBy?: ObjectId;
  joinedAt: Date;
  lastActiveAt?: Date;
}

export interface PermissionSet {
  // Treasury Control (Admin Only)
  canAddPaymentMethods: boolean;
  canModifyPaymentMethods: boolean;
  canManageTreasury: boolean;
  
  // Team Management (Admin Only)
  canManageTeam: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  
  // Company Settings (Admin Only)
  canManageCompanyInfo: boolean;
  canManageSettings: boolean;
  
  // Invoice Management
  canCreateInvoices: boolean;
  canSendInvoices: boolean;
  canManageInvoices: boolean;
  
  // Payables Management
  canCreateBills: boolean;
  canApproveBills: boolean;
  canExecutePayments: boolean;
  canManagePayables: boolean;
  
  // Accounting & Reporting
  canViewAllData: boolean;
  canExportData: boolean;
  canReconcileTransactions: boolean;
  canManageAccounting: boolean;
  
  // Approval Workflow
  canApproveDocuments: boolean;
  canManageApprovalPolicies: boolean;
}

export interface Organization {
  _id?: ObjectId;
  name: string;
  billingEmail: string;
  
  // Business Details
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  
  // Contact
  phone: string;
  website?: string;
  address: Address;
  
  // Branding
  logos?: Array<{
    id: string;
    name: string;
    url: string;
    isDefault: boolean;
    createdAt: Date;
  }>;
  
  // Legal
  taxId: string;
  registrationNumber?: string;
  
  // Primary Contact
  primaryContact: ContactPerson;
  
  // Members
  members: OrganizationMember[];
  
  // Services
  services: UserServices;
  
  // Payment Methods
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
  verified: boolean;
  
  // Safe Wallet (Gnosis Safe) - Optional, for organizations using multisig
  safeAddress?: string; // Deployed Safe wallet address
  safeOwners?: string[]; // Array of owner addresses
  safeThreshold?: number; // Number of signatures required (e.g., 2 of 3)
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  billingEmail: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone: string;
  website?: string;
  address: Address;
  logo?: string;
  logoUrl?: string;
  taxId: string;
  registrationNumber?: string;
  primaryContact: ContactPerson;
  members?: OrganizationMember[];
  services?: Partial<UserServices>;
  onboarding?: {
    completed?: boolean;
    currentStep?: number;
    completedSteps?: string[];
    serviceOnboarding?: Partial<ServiceOnboarding>;
  };
}

export interface UpdateOrganizationInput {
  name?: string;
  billingEmail?: string;
  industry?: string;
  companySize?: '1-10' | '11-50' | '51-200' | '200+';
  businessType?: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone?: string;
  website?: string;
  address?: Address;
  taxId?: string;
  registrationNumber?: string;
  primaryContact?: ContactPerson;
  members?: OrganizationMember[];
  services?: Partial<UserServices>;
  onboarding?: {
    completed?: boolean;
    currentStep?: number;
    completedSteps?: string[];
    serviceOnboarding?: Partial<ServiceOnboarding>;
  };
  status?: 'pending' | 'active' | 'suspended';
  verified?: boolean;
}

// New models for Request Finance pattern
export interface InvitationToken {
  _id?: ObjectId;
  token: string;
  organizationId: ObjectId;
  email: string;
  role: 'admin' | 'financeManager' | 'accountant' | 'approver';
  permissions: PermissionSet;
  invitedBy: ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface ApprovalPolicy {
  _id?: ObjectId;
  organizationId: ObjectId;
  name: string;
  description?: string;
  conditions: {
    amountThreshold?: number;
    vendorCategories?: string[];
    departments?: string[];
    documentTypes?: string[];
  };
  approvers: {
    role: string;
    required: number;
    sequential: boolean;
  };
  escalation: {
    timeoutHours: number;
    escalateTo: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  _id?: ObjectId;
  organizationId: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId: ObjectId;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface TreasuryControl {
  _id?: ObjectId;
  organizationId: ObjectId;
  paymentMethods: {
    canAdd: boolean;
    canModify: boolean;
    canRemove: boolean;
    requires2FA: boolean;
  };
  auditLog: {
    allChanges: boolean;
    immutable: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
} 