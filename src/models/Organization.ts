import { ObjectId } from 'mongodb';

export interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface OrganizationMember {
  userId: ObjectId; // Reference to Users
  role: string; // e.g., "owner", "member", "accountant"
}

export interface Organization {
  _id?: ObjectId;
  name: string;
  billingEmail: string;
  address: Address;
  taxId?: string;
  logo?: string; // URL to logo
  members: OrganizationMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  billingEmail: string;
  address: Address;
  taxId?: string;
  logo?: string;
  members?: OrganizationMember[];
}

export interface UpdateOrganizationInput {
  name?: string;
  billingEmail?: string;
  address?: Address;
  taxId?: string;
  logo?: string;
  members?: OrganizationMember[];
} 