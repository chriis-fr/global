"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * Get user settings - Ultra fast server action
 * Replaces slow API route - no compilation delay
 */
export async function getUserSettings() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
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

    return {
      success: true,
      data: {
        profile: {
          name: user.name || '',
          email: user.email,
          phone: '',
          currencyPreference: user.preferences?.currency || 'USD',
          profilePhoto: user.avatar || '',
          isGoogleUser: false,
        },
        organization: organizationData || {
          industry: '',
          address: null,
        },
        settings: user.preferences,
      }
    };
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch user settings'
    };
  }
}

