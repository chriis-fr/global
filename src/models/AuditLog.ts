import { ObjectId } from 'mongodb';

export type AuditAction = 
  | 'create_invoice' 
  | 'update_invoice' 
  | 'delete_invoice'
  | 'approve_expense' 
  | 'reject_expense' 
  | 'create_payment' 
  | 'update_payment'
  | 'create_user' 
  | 'update_user' 
  | 'delete_user'
  | 'create_organization' 
  | 'update_organization' 
  | 'delete_organization'
  | 'create_client' 
  | 'update_client' 
  | 'delete_client';

export type EntityType = 'Invoice' | 'Expense' | 'Payment' | 'User' | 'Organization' | 'Client';

export interface AuditLog {
  _id?: ObjectId;
  userId: ObjectId; // Reference to Users
  organizationId: ObjectId; // Reference to Organizations
  action: AuditAction;
  entityId: ObjectId; // Reference to affected entity (Invoice, Expense, etc.)
  entityType: EntityType;
  details?: Record<string, unknown>; // Flexible field for additional data
  timestamp: Date;
}

export interface CreateAuditLogInput {
  userId: ObjectId;
  organizationId: ObjectId;
  action: AuditAction;
  entityId: ObjectId;
  entityType: EntityType;
  details?: Record<string, unknown>;
  timestamp?: Date;
} 