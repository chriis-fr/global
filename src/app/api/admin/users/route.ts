import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

/**
 * Get all users for admin dashboard
 * Only accessible to users with adminTag
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !session.user.adminTag) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // Get total count
    const total = await usersCollection.countDocuments();
    
    // Get users with pagination
    const users = await usersCollection.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Format users (exclude sensitive data)
    const formattedUsers = users.map(user => ({
      id: user._id?.toString(),
      email: user.email,
      name: user.name,
      adminTag: user.adminTag || false,
      role: user.role,
      userType: user.userType,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isEmailVerified: user.isEmailVerified,
      planId: user.subscription?.planId || 'unknown',
      subscriptionStatus: user.subscription?.status || 'unknown',
      onboardingCompleted: user.onboarding?.isCompleted || user.onboarding?.currentStep === 4,
      onboardingStep: user.onboarding?.currentStep || 0,
      organizationId: user.organizationId?.toString(),
      services: {
        smartInvoicing: user.services?.smartInvoicing || false,
        accountsReceivable: user.services?.accountsReceivable || false,
        accountsPayable: user.services?.accountsPayable || false
      }
    }));

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

