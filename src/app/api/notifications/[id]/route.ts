import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// PUT /api/notifications/[id] - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notificationId = new ObjectId(id);

    // Get user ID from session
    const user = await fetch(`${process.env.NEXTAUTH_URL}/api/users/profile`).then(res => res.json());
    if (!user.success) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user.data._id);

    // Update notification directly in database
    const db = await connectToDatabase();
    const result = await db.collection('notifications').updateOne(
      { _id: notificationId, userId: userId },
      { 
        $set: { 
          status: 'read',
          readAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notificationId = new ObjectId(id);

    // Get user ID from session
    const user = await fetch(`${process.env.NEXTAUTH_URL}/api/users/profile`).then(res => res.json());
    if (!user.success) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const userId = new ObjectId(user.data._id);

    // Delete notification directly from database
    const db = await connectToDatabase();
    const result = await db.collection('notifications').deleteOne(
      { _id: notificationId, userId: userId }
    );

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to delete notification' },
      { status: 500 }
    );
  }
} 