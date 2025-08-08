import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import {
  Notification,
  NotificationPreferences,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationStats,
  NotificationFilters
} from '@/models/Notification';
import { User } from '@/models/User';
import { sendAppNotification } from './emailService';

export class NotificationService {
  // Create a new notification
  static async createNotification(input: CreateNotificationInput): Promise<Notification | null> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const notification: Notification = {
        userId: input.userId,
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        priority: input.priority || 'medium',
        status: input.status || 'pending',
        actionUrl: input.actionUrl,
        actionText: input.actionText,
        actionData: input.actionData,
        metadata: input.metadata,
        tags: input.tags,
        expiresAt: input.expiresAt,
        relatedInvoiceId: input.relatedInvoiceId,
        relatedPaymentId: input.relatedPaymentId,
        relatedUserId: input.relatedUserId,
        relatedOrganizationId: input.relatedOrganizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await notificationsCollection.insertOne(notification);
      
      if (result.insertedId) {
        notification._id = result.insertedId;
        
        // Send notifications based on user preferences
        await this.sendNotification(notification);
        
        return notification;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  // Get notifications for a user
  static async getNotifications(
    userId: ObjectId,
    filters?: NotificationFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const query: Record<string, unknown> = { userId };

      if (filters) {
        if (filters.type && filters.type.length > 0) {
          query.type = { $in: filters.type };
        }
        if (filters.priority && filters.priority.length > 0) {
          query.priority = { $in: filters.priority };
        }
        if (filters.status && filters.status.length > 0) {
          query.status = { $in: filters.status };
        }
        if (filters.dateFrom || filters.dateTo) {
          const dateQuery: Record<string, unknown> = {};
          if (filters.dateFrom) dateQuery.$gte = filters.dateFrom;
          if (filters.dateTo) dateQuery.$lte = filters.dateTo;
          query.createdAt = dateQuery;
        }
        if (filters.tags && filters.tags.length > 0) {
          query.tags = { $in: filters.tags };
        }
        if (filters.search) {
          query.$or = [
            { title: { $regex: filters.search, $options: 'i' } },
            { message: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }

      const notifications = await notificationsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return notifications as Notification[];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Get notification statistics
  static async getNotificationStats(userId: ObjectId): Promise<NotificationStats> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const pipeline = [
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: {
              $sum: {
                $cond: [{ $eq: ['$status', 'unread'] }, 1, 0]
              }
            },
            read: {
              $sum: {
                $cond: [{ $eq: ['$status', 'read'] }, 1, 0]
              }
            }
          }
        }
      ];

      const stats = await notificationsCollection.aggregate(pipeline).toArray();
      
      if (stats.length === 0) {
        return {
          total: 0,
          unread: 0,
          read: 0,
          byType: {} as Record<NotificationType, number>,
          byPriority: {} as Record<NotificationPriority, number>,
          byStatus: {} as Record<NotificationStatus, number>
        };
      }

      const result = stats[0];
      
      // Get counts by type, priority, and status
      const typeStats = await notificationsCollection.aggregate([
        { $match: { userId } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]).toArray();

      const priorityStats = await notificationsCollection.aggregate([
        { $match: { userId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]).toArray();

      const statusStats = await notificationsCollection.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();

      const byType = (typeStats as Array<{ _id: string; count: number }>).reduce((acc: Record<NotificationType, number>, stat) => {
        acc[stat._id as NotificationType] = stat.count;
        return acc;
      }, {} as Record<NotificationType, number>);

      const byPriority = (priorityStats as Array<{ _id: string; count: number }>).reduce((acc: Record<NotificationPriority, number>, stat) => {
        acc[stat._id as NotificationPriority] = stat.count;
        return acc;
      }, {} as Record<NotificationPriority, number>);

      const byStatus = (statusStats as Array<{ _id: string; count: number }>).reduce((acc: Record<NotificationStatus, number>, stat) => {
        acc[stat._id as NotificationStatus] = stat.count;
        return acc;
      }, {} as Record<NotificationStatus, number>);

      return {
        total: result.total,
        unread: result.unread,
        read: result.read,
        byType,
        byPriority,
        byStatus
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total: 0,
        unread: 0,
        read: 0,
        byType: {} as Record<NotificationType, number>,
        byPriority: {} as Record<NotificationPriority, number>,
        byStatus: {} as Record<NotificationStatus, number>
      };
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: ObjectId, userId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.updateOne(
        { _id: notificationId, userId },
        {
          $set: {
            status: 'read',
            readAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.updateMany(
        { userId, status: { $in: ['unread', 'pending'] } },
        {
          $set: {
            status: 'read',
            readAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId: ObjectId, userId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.deleteOne({
        _id: notificationId,
        userId
      });

      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Get user notification preferences
  static async getNotificationPreferences(userId: ObjectId): Promise<NotificationPreferences | null> {
    try {
      const db = await connectToDatabase();
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ _id: userId });
      
      if (!user) return null;

      return user.settings?.notifications || {
        email: true,
        sms: false,
        push: true,
        inApp: true,
        invoiceCreated: true,
        invoicePaid: true,
        invoiceOverdue: true,
        paymentReceived: true,
        paymentFailed: true,
        systemUpdates: true,
        securityAlerts: true,
        reminders: true,
        approvals: true,
        frequency: 'immediate',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  // Update user notification preferences
  static async updateNotificationPreferences(
    userId: ObjectId,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      const db = await connectToDatabase();
      const usersCollection = db.collection('users');

      const result = await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            'settings.notifications': preferences,
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }

  // Send notification via different channels
  static async sendNotification(notification: Notification): Promise<void> {
    try {
      const db = await connectToDatabase();
      const usersCollection = db.collection('users');

             // Get user and their preferences
       const user = await usersCollection.findOne({ _id: notification.userId }) as User;
       if (!user) {
         console.log('❌ [NotificationService] User not found for notification:', notification.userId);
         return;
       }

       let preferences = user.settings?.notifications;
       if (!preferences) {
         console.log('⚠️ [NotificationService] No notification preferences found for user:', user.email);
         // Use default preferences
         preferences = {
           email: true,
           sms: false,
           push: true,
           inApp: true,
           invoiceCreated: true,
           invoicePaid: true,
           invoiceOverdue: true,
           paymentReceived: true,
           paymentFailed: true,
           systemUpdates: true,
           securityAlerts: true,
           reminders: true,
           approvals: true,
           frequency: 'immediate',
           quietHours: {
             enabled: false,
             start: '22:00',
             end: '08:00',
             timezone: 'UTC'
           }
         };
       }

      // Check if we should send based on notification type
      const shouldSend = this.shouldSendNotification(notification.type, preferences);
      if (!shouldSend) return;

      // Check quiet hours
      if (this.isInQuietHours(preferences.quietHours)) {
        console.log('Notification suppressed due to quiet hours');
        return;
      }

      // Send email notification
      if (preferences.email) {
        await this.sendEmailNotification(notification, user);
      }

      // Update notification status
      await this.updateNotificationStatus(notification._id!, {
        emailSent: preferences.email,
        smsSent: preferences.sms,
        pushSent: preferences.push,
        inAppDelivered: true,
        status: 'sent'
      });

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Check if notification should be sent based on user preferences
  private static shouldSendNotification(type: NotificationType, preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'invoice_created':
        return preferences.invoiceCreated;
      case 'invoice_paid':
        return preferences.invoicePaid;
      case 'invoice_overdue':
        return preferences.invoiceOverdue;
      case 'payment_received':
        return preferences.paymentReceived;
      case 'payment_failed':
        return preferences.paymentFailed;
      case 'system_update':
        return preferences.systemUpdates;
      case 'security_alert':
        return preferences.securityAlerts;
      case 'reminder':
        return preferences.reminders;
      case 'approval_request':
      case 'approval_status':
        return preferences.approvals;
      default:
        return true;
    }
  }

  // Check if current time is in quiet hours
  private static isInQuietHours(quietHours: { enabled: boolean; start: string; end: string; timezone: string }): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Send email notification
  private static async sendEmailNotification(notification: Notification, user: User): Promise<void> {
    try {
      await sendAppNotification(
        user.email,
        user.name,
        notification.title,
        notification.message,
        'general' as const,
        notification.actionUrl,
        user.organizationId ? 'Organization' : 'Personal'
      );

      console.log(`✅ Email notification sent to ${user.email}: ${notification.title}`);
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  // Update notification status
  private static async updateNotificationStatus(
    notificationId: ObjectId,
    update: UpdateNotificationInput
  ): Promise<void> {
    try {
      const db = await connectToDatabase();
      const notificationsCollection = db.collection('notifications');

      await notificationsCollection.updateOne(
        { _id: notificationId },
        {
          $set: {
            ...update,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }
} 