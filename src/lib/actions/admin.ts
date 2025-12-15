'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { BILLING_PLANS } from '@/data/billingPlans';
import { clearSubscriptionCache } from './subscription';
import { createDefaultServices } from '@/lib/services/serviceManager';

export interface AdminUserData {
  _id: string;
  email: string;
  name: string;
  role: string;
  adminTag?: boolean;
  createdAt: Date;
  lastLogin?: Date;
  isEmailVerified: boolean;
  subscription: {
    planId: string;
    status: string;
    billingPeriod: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  };
  services: Record<string, boolean>;
  organizationId?: string;
}

/**
 * Search user by email (admin only)
 */
export async function searchUserByEmail(
  email: string
): Promise<{ success: boolean; data?: AdminUserData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    // Search for user by email
    const user = await db.collection('users').findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    return {
      success: true,
      data: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        adminTag: user.adminTag || false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isEmailVerified: user.isEmailVerified || false,
        subscription: {
          planId: user.subscription?.planId || 'receivables-free',
          status: user.subscription?.status || 'active',
          billingPeriod: user.subscription?.billingPeriod || 'monthly',
          currentPeriodStart: user.subscription?.currentPeriodStart,
          currentPeriodEnd: user.subscription?.currentPeriodEnd
        },
        services: user.services 
          ? { ...createDefaultServices(), ...user.services } 
          : createDefaultServices(),
        organizationId: user.organizationId?.toString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search user'
    };
  }
}

/**
 * Update user's subscription plan (admin only)
 */
export async function updateUserPlanAdmin(
  userEmail: string,
  planId: string,
  billingPeriod: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    // Validate plan exists
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid plan ID'
      };
    }

    // Find target user
    const targetUser = await db.collection('users').findOne({
      email: userEmail.toLowerCase().trim()
    });

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const userObjectId = new ObjectId(targetUser._id.toString());
    const now = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    // Update user's subscription in database
    await db.collection('users').updateOne(
      { _id: userObjectId },
      {
        $set: {
          'subscription.planId': planId,
          'subscription.status': 'active',
          'subscription.currentPeriodStart': now,
          'subscription.currentPeriodEnd': currentPeriodEnd,
          'subscription.billingPeriod': billingPeriod,
          'subscription.updatedAt': now
        }
      }
    );

    // Clear subscription cache for the user
    clearSubscriptionCache(targetUser._id.toString());

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update plan'
    };
  }
}

/**
 * Get count of users with unknown/invalid plans (admin only)
 */
export async function getUnknownPlanUsersCount(): Promise<{ 
  success: boolean; 
  count?: number; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    // Get all valid plan IDs
    const validPlanIds = BILLING_PLANS.map(p => p.planId);

    // Count users with unknown plans
    // Unknown plans are: null subscription, undefined, empty string, or not in validPlanIds
    const count = await db.collection('users').countDocuments({
      $or: [
        { subscription: null },
        { subscription: { $exists: false } },
        { 'subscription.planId': { $exists: false } },
        { 'subscription.planId': null },
        { 'subscription.planId': '' },
        { 'subscription.planId': { $nin: validPlanIds } }
      ]
    });

    return {
      success: true,
      count
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to count unknown plan users'
    };
  }
}

/**
 * Bulk update all users with unknown plans to a selected plan (admin only)
 */
export async function bulkUpdateUnknownPlans(
  planId: string,
  billingPeriod: 'monthly' | 'yearly' = 'monthly'
): Promise<{ 
  success: boolean; 
  updatedCount?: number; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    // Validate plan exists
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid plan ID'
      };
    }

    // Get all valid plan IDs
    const validPlanIds = BILLING_PLANS.map(p => p.planId);

    const now = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    // Prepare subscription object
    const subscriptionUpdate = {
      planId: planId,
      status: 'active' as const,
      currentPeriodStart: now,
      currentPeriodEnd: currentPeriodEnd,
      billingPeriod: billingPeriod,
      createdAt: now,
      updatedAt: now
    };

    // Find all users with unknown plans or null subscription
    const usersWithUnknownPlans = await db.collection('users').find({
      $or: [
        { subscription: null },
        { subscription: { $exists: false } },
        { 'subscription.planId': { $exists: false } },
        { 'subscription.planId': null },
        { 'subscription.planId': '' },
        { 'subscription.planId': { $nin: validPlanIds } }
      ]
    }).toArray();

    if (usersWithUnknownPlans.length === 0) {
      return {
        success: true,
        updatedCount: 0
      };
    }

    // Update users with null subscription separately
    const nullSubscriptionResult = await db.collection('users').updateMany(
      {
        $or: [
          { subscription: null },
          { subscription: { $exists: false } }
        ]
      },
      {
        $set: {
          subscription: subscriptionUpdate
        }
      }
    );

    // Update users with subscription object but unknown planId
    const unknownPlanResult = await db.collection('users').updateMany(
      {
        subscription: { $ne: null, $exists: true },
        $or: [
          { 'subscription.planId': { $exists: false } },
          { 'subscription.planId': null },
          { 'subscription.planId': '' },
          { 'subscription.planId': { $nin: validPlanIds } }
        ]
      },
      {
        $set: {
          'subscription.planId': planId,
          'subscription.status': 'active',
          'subscription.currentPeriodStart': now,
          'subscription.currentPeriodEnd': currentPeriodEnd,
          'subscription.billingPeriod': billingPeriod,
          'subscription.updatedAt': now
        }
      }
    );

    const totalUpdated = (nullSubscriptionResult.modifiedCount || 0) + (unknownPlanResult.modifiedCount || 0);

    // Clear subscription cache for all updated users
    usersWithUnknownPlans.forEach(user => {
      if (user._id) {
        clearSubscriptionCache(user._id.toString());
      }
    });

    return {
      success: true,
      updatedCount: totalUpdated
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk update plans'
    };
  }
}

