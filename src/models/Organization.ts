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
  userId: ObjectId; // Reference to Users
  role: string; // e.g., "owner", "member", "accountant"
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
  logo?: string; // URL to organization logo
  logoUrl?: string; // Alternative logo field
  
  // Legal
  taxId: string;
  registrationNumber?: string;
  
  // Primary Contact
  primaryContact: ContactPerson;
  
  // Members
  members: OrganizationMember[];
  
  // Services
  services: UserServices;
  
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