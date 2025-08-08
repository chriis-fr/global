import { ObjectId } from 'mongodb';

export interface NotificationPreferences {
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
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  emailTemplate: string;
  smsTemplate: string;
  pushTemplate: string;
  inAppTemplate: string;
  variables: string[]; // e.g., ["userName", "invoiceNumber", "amount"]
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = 
  | 'invoice_created'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_failed'
  | 'system_update'
  | 'security_alert'
  | 'reminder'
  | 'approval_request'
  | 'approval_status'
  | 'user_invited'
  | 'user_joined'
  | 'service_enabled'
  | 'service_disabled'
  | 'maintenance'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read' | 'unread';

export interface Notification {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  
  // Notification content
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  
  // Action data
  actionUrl?: string;
  actionText?: string;
  actionData?: Record<string, unknown>;
  
  // Delivery tracking
  emailSent?: boolean;
  smsSent?: boolean;
  pushSent?: boolean;
  inAppDelivered?: boolean;
  
  // Metadata
  metadata?: Record<string, unknown>;
  tags?: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
  expiresAt?: Date;
  
  // Related entities
  relatedInvoiceId?: ObjectId;
  relatedPaymentId?: ObjectId;
  relatedUserId?: ObjectId;
  relatedOrganizationId?: ObjectId;
}

export interface NotificationDelivery {
  _id?: ObjectId;
  notificationId: ObjectId;
  userId: ObjectId;
  
  // Delivery method
  method: 'email' | 'sms' | 'push' | 'in_app';
  
  // Delivery status
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  
  // Delivery details
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  
  // Recipient info
  recipientEmail?: string;
  recipientPhone?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSchedule {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  
  // Schedule details
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  
  // Timing
  scheduledFor: Date;
  timezone: string;
  
  // Recurrence
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6, Sunday-Saturday
    dayOfMonth?: number;
  };
  
  // Status
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  
  // Action data
  actionUrl?: string;
  actionText?: string;
  actionData?: Record<string, unknown>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  cancelledAt?: Date;
}

export interface CreateNotificationInput {
  userId: ObjectId;
  organizationId?: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  actionUrl?: string;
  actionText?: string;
  actionData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  expiresAt?: Date;
  relatedInvoiceId?: ObjectId;
  relatedPaymentId?: ObjectId;
  relatedUserId?: ObjectId;
  relatedOrganizationId?: ObjectId;
}

export interface UpdateNotificationInput {
  status?: NotificationStatus;
  readAt?: Date;
  emailSent?: boolean;
  smsSent?: boolean;
  pushSent?: boolean;
  inAppDelivered?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationScheduleInput {
  userId: ObjectId;
  organizationId?: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  scheduledFor: Date;
  timezone: string;
  isRecurring?: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  actionUrl?: string;
  actionText?: string;
  actionData?: Record<string, unknown>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
  byStatus: Record<NotificationStatus, number>;
}

export interface NotificationFilters {
  type?: NotificationType[];
  priority?: NotificationPriority[];
  status?: NotificationStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  search?: string;
} 