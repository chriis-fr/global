'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { BILLING_PLANS } from '@/data/billingPlans';
import { clearSubscriptionCache, getUserSubscription, canCreateInvoice } from './subscription';
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
  invoiceCount?: number;
  invoicesThisMonth?: number;
  invoicesRemainingThisMonth?: number | null;
  invoiceLimitPerMonth?: number;
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

export interface AdminUserInvoiceDebug {
  canCreateInvoice: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
  orgReadOnlyDueToTrialEnd?: boolean;
  orgReadOnlyDueToOverdue?: boolean;
  limits?: {
    invoicesPerMonth: number;
    monthlyVolume: number;
  };
  usage?: {
    invoicesThisMonth: number;
    monthlyVolume: number;
  };
  draftsThisMonth?: number;
  totalDrafts?: number;
  planId?: string;
  status?: string;
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

    // Count invoices created by this user (by issuerId or userId/email)
    const invoicesCollection = db.collection('invoices');
    const userIdString = user._id?.toString();
    const baseInvoiceOwnerQuery = {
      $or: [
        ...(userIdString ? [{ issuerId: userIdString }, { issuerId: new ObjectId(userIdString) }] : []),
        { userId: user.email }
      ]
    };

    const invoiceCount = await invoicesCollection.countDocuments(baseInvoiceOwnerQuery);

    // Compute current month usage and remaining quota based on subscription plan
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const invoicesThisMonth = await invoicesCollection.countDocuments({
      ...baseInvoiceOwnerQuery,
      createdAt: { $gte: monthStart, $lt: nextMonthStart }
    });

    const planId = user.subscription?.planId || 'receivables-free';
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    const isTrialPremiumPlan = planId === 'trial-premium';
    const invoiceLimitPerMonth = isTrialPremiumPlan
      ? -1
      : (plan?.limits?.invoicesPerMonth ?? 5);

    const invoicesRemainingThisMonth =
      invoiceLimitPerMonth > 0
        ? Math.max(0, invoiceLimitPerMonth - invoicesThisMonth)
        : null;

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
        invoicesThisMonth,
        invoicesRemainingThisMonth,
        invoiceLimitPerMonth,
        invoiceCount,
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
 * Get detailed invoice creation permissions/limits for a specific user (admin only).
 * This mirrors what the app uses to decide 403s on invoice/draft save.
 */
export async function getUserInvoicePermissionsDebug(
  email: string
): Promise<{ success: boolean; data?: AdminUserInvoiceDebug; error?: string }> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

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

    const targetUser = await db.collection('users').findOne({
      email: email.toLowerCase().trim()
    });

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Use the main subscription helper to get consistent flags/limits/usage
    const subscription = await getUserSubscription();
    const canCreate = await canCreateInvoice();

    // Compute draft counts for this user/org
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const draftQuery: Record<string, unknown> = {
      status: 'draft',
      createdAt: { $gte: startOfMonth }
    };

    if (targetUser.organizationId) {
      draftQuery.organizationId = targetUser.organizationId;
    } else {
      draftQuery.issuerId = targetUser._id;
    }

    const draftsThisMonth = await db.collection('invoices').countDocuments(draftQuery);

    const totalDraftQuery: Record<string, unknown> = { status: 'draft' };
    if (targetUser.organizationId) {
      totalDraftQuery.organizationId = targetUser.organizationId;
    } else {
      totalDraftQuery.issuerId = targetUser._id;
    }
    const totalDrafts = await db.collection('invoices').countDocuments(totalDraftQuery);

    return {
      success: true,
      data: {
        canCreateInvoice: canCreate.allowed,
        reason: canCreate.reason,
        requiresUpgrade: canCreate.requiresUpgrade,
        orgReadOnlyDueToTrialEnd: subscription?.orgReadOnlyDueToTrialEnd,
        orgReadOnlyDueToOverdue: subscription?.orgReadOnlyDueToOverdue,
        limits: subscription?.limits,
        usage: subscription?.usage,
        draftsThisMonth,
        totalDrafts,
        planId: subscription?.plan?.planId,
        status: subscription?.status
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load invoice permissions'
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

