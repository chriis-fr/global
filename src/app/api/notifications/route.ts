import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notificationService';
import { UserService } from '@/lib/services/userService';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Get user from database using session email
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user._id);

    // Build query
    const db = await connectToDatabase();
    const query: Record<string, unknown> = { userId: userId };
    
    if (type) {
      const typeArray = type.split(',');
      query.type = { $in: typeArray };
    }
    if (priority) {
      const priorityArray = priority.split(',');
      query.priority = { $in: priorityArray };
    }
    if (status) {
      const statusArray = status.split(',');
      query.status = { $in: statusArray };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Get notifications with pagination
    const notifications = await db.collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('notifications').countDocuments(query);

    // Get stats
    const stats = {
      total,
      unread: await db.collection('notifications').countDocuments({ ...query, status: { $ne: 'read' } }),
      read: await db.collection('notifications').countDocuments({ ...query, status: 'read' })
    };

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        stats,
        pagination: {
          limit,
          offset,
          total: stats.total
        }
      }
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to get notifications' },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      type,
      title,
      message,
      priority = 'medium',
      actionUrl,
      actionText,
      actionData,
      metadata,
      tags,
      expiresAt,
      relatedInvoiceId,
      relatedPaymentId,
      relatedUserId,
      relatedOrganizationId
    } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, message: 'Type, title, and message are required' },
        { status: 400 }
      );
    }

    // Get user from database using session email
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user._id);

    const notification = await NotificationService.createNotification({
      userId,
      organizationId: user.organizationId ? new ObjectId(user.organizationId) : undefined,
      type,
      title,
      message,
      priority,
      actionUrl,
      actionText,
      actionData,
      metadata,
      tags,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      relatedInvoiceId: relatedInvoiceId ? new ObjectId(relatedInvoiceId) : undefined,
      relatedPaymentId: relatedPaymentId ? new ObjectId(relatedPaymentId) : undefined,
      relatedUserId: relatedUserId ? new ObjectId(relatedUserId) : undefined,
      relatedOrganizationId: relatedOrganizationId ? new ObjectId(relatedOrganizationId) : undefined
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, message: 'Failed to create notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to create notification' },
      { status: 500 }
    );
  }
} 