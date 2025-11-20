import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

/**
 * Grant admin tag to a user
 * Can grant to logged-in user or to caspianodhis@gmail.com
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetEmail = body.email || session.user.email; // Default to logged-in user

    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // Find user by email
    const user = await usersCollection.findOne({ email: targetEmail });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Grant admin tag
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          adminTag: true,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `Admin tag granted to ${targetEmail}`,
      data: {
        email: targetEmail,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Grant admin tag error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to grant admin tag',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

