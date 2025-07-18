import { ObjectId } from 'mongodb';
import { Address } from './Organization';

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
}

export interface Client {
  _id?: ObjectId;
  name: string;
  email: string;
  organizationId: ObjectId; // Reference to Organizations
  billingAddress: Address;
  taxId?: string;
  contactPerson?: ContactPerson;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientInput {
  name: string;
  email: string;
  organizationId: ObjectId;
  billingAddress: Address;
  taxId?: string;
  contactPerson?: ContactPerson;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  billingAddress?: Address;
  taxId?: string;
  contactPerson?: ContactPerson;
} 