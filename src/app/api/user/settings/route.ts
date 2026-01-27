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
          email: organization.billingEmail, // Use billingEmail as email
          phone: organization.phone || '',
          industry: organization.industry || '',
          address: organization.address,
          billingEmail: organization.billingEmail,
          taxId: organization.taxId || '', // CRITICAL: Include taxId
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
          phone: '',
          currencyPreference: user.preferences?.currency || 'USD',
          profilePhoto: user.avatar || '',
          isGoogleUser: false, // Default to false since googleId is not in User interface
        },
        organization: organizationData || {
          industry: '',
          address: null,
        },
        settings: user.preferences,
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
        preferences: {
          ...user.preferences,
          currency: data.currencyPreference || 'USD',
        },
      };
    } else if (type === 'organization') {
      updateData = {
        industry: data.industry,
        address: data.address,
      };
    } else if (type === 'notifications') {
      updateData = {
        preferences: {
          ...user.preferences,
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