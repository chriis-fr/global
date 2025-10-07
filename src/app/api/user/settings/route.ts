import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { UpdateUserInput } from '@/models';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET /api/user/settings - Get current user settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization data if user belongs to one
    let organizationData = null;
    if (user.organizationId) {
      const db = await getDatabase();
      const organization = await db.collection('organizations').findOne({ 
        _id: new ObjectId(user.organizationId.toString()) 
      });
      if (organization) {
        organizationData = {
          _id: organization._id?.toString(),
          name: organization.name,
          industry: organization.industry || '',
          address: organization.address,
          billingEmail: organization.billingEmail,
          services: organization.services || [],
          onboarding: organization.onboarding || {},
          subscription: organization.subscription
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          name: user.name, // User's full name
          email: user.email,
          phone: user.phone || '',
          currencyPreference: user.settings?.currencyPreference || 'USD',
          profilePhoto: user.profilePicture || user.avatar || '',
          isGoogleUser: user.profilePicture ? true : false, // If user has profilePicture, they're likely a Google user
        },
        organization: organizationData || {
          industry: user.industry || '',
          address: user.address,
        },
        settings: user.settings,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch user settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/user/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { success: false, message: 'Type and data are required' },
        { status: 400 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    let updateData: Partial<UpdateUserInput> = {};

    if (type === 'profile') {
      updateData = {
        name: data.name,
        phone: data.phone,
        settings: {
          ...user.settings,
          currencyPreference: data.currencyPreference || 'USD',
        },
      };
    } else if (type === 'organization') {
      updateData = {
        industry: data.industry,
        address: data.address,
      };
    } else if (type === 'notifications') {
      updateData = {
        settings: {
          ...user.settings,
          notifications: data.notifications,
        },
      };
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid settings type' },
        { status: 400 }
      );
    }

    const updatedUser = await UserService.updateUser(user._id!.toString(), updateData);
    
    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'Failed to update user settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update user settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 