import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notificationService';
import { ObjectId } from 'mongodb';

// POST /api/notifications/test - Create a test notification
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user ID from session
    const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/users/profile`);
    if (!userResponse.ok) {
      console.error('❌ [Test Notifications API] Failed to fetch user profile:', userResponse.status, userResponse.statusText);
      return NextResponse.json(
        { success: false, message: 'Failed to get user profile' },
        { status: 500 }
      );
    }
    
    const user = await userResponse.json();
    if (!user.success) {
      console.error('❌ [Test Notifications API] User profile response indicates failure:', user);
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user.data._id);

    // Create a test notification
    const notification = await NotificationService.createNotification({
      userId,
      organizationId: user.data.organizationId ? new ObjectId(user.data.organizationId) : undefined,
      type: 'system_update',
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working properly.',
      priority: 'medium',
      actionUrl: '/dashboard/notifications',
      actionText: 'View Notifications',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      },
      tags: ['test', 'system']
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, message: 'Failed to create test notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Test notification created successfully'
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create test notification' },
      { status: 500 }
    );
  }
} 