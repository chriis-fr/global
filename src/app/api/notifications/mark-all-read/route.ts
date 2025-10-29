import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notificationService';
import { ObjectId } from 'mongodb';

// PUT /api/notifications/mark-all-read - Mark all notifications as read
export async function PUT() {
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
      return NextResponse.json(
        { success: false, message: 'Failed to get user profile' },
        { status: 500 }
      );
    }
    
    const user = await userResponse.json();
    if (!user.success) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user.data._id);

    const success = await NotificationService.markAllAsRead(userId);

    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Failed to mark all notifications as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
} 