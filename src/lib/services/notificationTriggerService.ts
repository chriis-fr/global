import { NotificationService } from './notificationService';
import { ObjectId } from 'mongodb';
import { NotificationPriority } from '@/models/Notification';

export class NotificationTriggerService {
  // Trigger notification when invoice is created
  static async triggerInvoiceCreated(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    invoiceData: {
      _id: ObjectId;
      invoiceNumber: string;
      totalAmount: number;
      currency: string;
      clientName: string;
      dueDate: Date;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'invoice_created',
      title: 'New Invoice Created',
      message: `Invoice ${invoiceData.invoiceNumber} has been created for ${invoiceData.clientName} with amount ${invoiceData.currency} ${invoiceData.totalAmount.toFixed(2)}`,
      priority: 'medium',
      actionUrl: `/dashboard/services/smart-invoicing/invoices/${invoiceData._id}`,
      actionText: 'View Invoice',
      relatedInvoiceId: invoiceData._id,
      metadata: {
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        clientName: invoiceData.clientName,
        dueDate: invoiceData.dueDate.toISOString()
      }
    });
  }

  // Trigger notification when invoice is paid
  static async triggerInvoicePaid(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    invoiceData: {
      _id: ObjectId;
      invoiceNumber: string;
      totalAmount: number;
      currency: string;
      paymentMethod: string;
      paidDate: Date;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'invoice_paid',
      title: 'Invoice Paid',
      message: `Invoice ${invoiceData.invoiceNumber} has been paid via ${invoiceData.paymentMethod} for ${invoiceData.currency} ${invoiceData.totalAmount.toFixed(2)}`,
      priority: 'high',
      actionUrl: `/dashboard/services/smart-invoicing/invoices/${invoiceData._id}`,
      actionText: 'View Details',
      relatedInvoiceId: invoiceData._id,
      metadata: {
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        paymentMethod: invoiceData.paymentMethod,
        paidDate: invoiceData.paidDate.toISOString()
      }
    });
  }

  // Trigger notification when invoice is overdue
  static async triggerInvoiceOverdue(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    invoiceData: {
      _id: ObjectId;
      invoiceNumber: string;
      totalAmount: number;
      currency: string;
      dueDate: Date;
      daysOverdue: number;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'invoice_overdue',
      title: 'Invoice Overdue',
      message: `Invoice ${invoiceData.invoiceNumber} is overdue by ${invoiceData.daysOverdue} days. Amount due: ${invoiceData.currency} ${invoiceData.totalAmount.toFixed(2)}`,
      priority: 'urgent',
      actionUrl: `/dashboard/services/smart-invoicing/invoices/${invoiceData._id}`,
      actionText: 'View Invoice',
      relatedInvoiceId: invoiceData._id,
      metadata: {
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        dueDate: invoiceData.dueDate.toISOString(),
        daysOverdue: invoiceData.daysOverdue
      }
    });
  }

  // Trigger notification when payment is received
  static async triggerPaymentReceived(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    paymentData: {
      _id: ObjectId;
      amount: number;
      currency: string;
      paymentMethod: string;
      receivedDate: Date;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `Payment of ${paymentData.currency} ${paymentData.amount.toFixed(2)} received via ${paymentData.paymentMethod}`,
      priority: 'high',
      actionUrl: `/dashboard/services/smart-invoicing/invoices`,
      actionText: 'View Payments',
      relatedPaymentId: paymentData._id,
      metadata: {
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        receivedDate: paymentData.receivedDate.toISOString()
      }
    });
  }

  // Trigger notification when payment fails
  static async triggerPaymentFailed(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    paymentData: {
      _id: ObjectId;
      amount: number;
      currency: string;
      paymentMethod: string;
      errorMessage: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Payment of ${paymentData.currency} ${paymentData.amount.toFixed(2)} via ${paymentData.paymentMethod} failed: ${paymentData.errorMessage}`,
      priority: 'high',
      actionUrl: `/dashboard/services/smart-invoicing/invoices`,
      actionText: 'Review Payment',
      relatedPaymentId: paymentData._id,
      metadata: {
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        errorMessage: paymentData.errorMessage
      }
    });
  }

  // Trigger system update notification
  static async triggerSystemUpdate(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    updateData: {
      title: string;
      message: string;
      actionUrl?: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'system_update',
      title: updateData.title,
      message: updateData.message,
      priority: 'medium',
      actionUrl: updateData.actionUrl,
      actionText: updateData.actionUrl ? 'Learn More' : undefined,
      metadata: {
        updateTitle: updateData.title,
        updateMessage: updateData.message
      }
    });
  }

  // Trigger security alert notification
  static async triggerSecurityAlert(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    alertData: {
      title: string;
      message: string;
      actionUrl?: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'security_alert',
      title: alertData.title,
      message: alertData.message,
      priority: 'urgent',
      actionUrl: alertData.actionUrl,
      actionText: alertData.actionUrl ? 'Review Activity' : undefined,
      metadata: {
        alertTitle: alertData.title,
        alertMessage: alertData.message
      }
    });
  }

  // Trigger reminder notification
  static async triggerReminder(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    reminderData: {
      title: string;
      message: string;
      actionUrl?: string;
      dueDate?: Date;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'reminder',
      title: reminderData.title,
      message: reminderData.message,
      priority: 'medium',
      actionUrl: reminderData.actionUrl,
      actionText: reminderData.actionUrl ? 'Take Action' : undefined,
      metadata: {
        reminderTitle: reminderData.title,
        reminderMessage: reminderData.message,
        dueDate: reminderData.dueDate?.toISOString()
      }
    });
  }

  // Trigger approval request notification
  static async triggerApprovalRequest(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    requestData: {
      title: string;
      requesterName: string;
      description: string;
      dueDate: Date;
      actionUrl: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'approval_request',
      title: requestData.title,
      message: `Approval request from ${requestData.requesterName}: ${requestData.description}`,
      priority: 'high',
      actionUrl: requestData.actionUrl,
      actionText: 'Review Request',
      metadata: {
        requestTitle: requestData.title,
        requesterName: requestData.requesterName,
        requestDescription: requestData.description,
        dueDate: requestData.dueDate.toISOString()
      }
    });
  }

  // Trigger approval status update notification
  static async triggerApprovalStatusUpdate(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    statusData: {
      title: string;
      status: 'approved' | 'rejected';
      approverName: string;
      comments?: string;
      actionUrl: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'approval_status',
      title: `Approval ${statusData.status}: ${statusData.title}`,
      message: `Your request "${statusData.title}" has been ${statusData.status} by ${statusData.approverName}${statusData.comments ? `: ${statusData.comments}` : ''}`,
      priority: 'medium',
      actionUrl: statusData.actionUrl,
      actionText: 'View Details',
      metadata: {
        requestTitle: statusData.title,
        status: statusData.status,
        approverName: statusData.approverName,
        comments: statusData.comments
      }
    });
  }

  // Trigger service enabled notification
  static async triggerServiceEnabled(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    serviceData: {
      serviceName: string;
      actionUrl: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'service_enabled',
      title: `Service Enabled: ${serviceData.serviceName}`,
      message: `The ${serviceData.serviceName} service has been enabled for your account.`,
      priority: 'medium',
      actionUrl: serviceData.actionUrl,
      actionText: 'Get Started',
      metadata: {
        serviceName: serviceData.serviceName
      }
    });
  }

  // Trigger general notification
  static async triggerGeneralNotification(
    userId: ObjectId,
    organizationId: ObjectId | undefined,
    notificationData: {
      title: string;
      message: string;
      priority?: NotificationPriority;
      actionUrl?: string;
      actionText?: string;
    }
  ) {
    await NotificationService.createNotification({
      userId,
      organizationId,
      type: 'general',
      title: notificationData.title,
      message: notificationData.message,
      priority: notificationData.priority || 'medium',
      actionUrl: notificationData.actionUrl,
      actionText: notificationData.actionText,
      metadata: {
        notificationTitle: notificationData.title,
        notificationMessage: notificationData.message
      }
    });
  }
} 