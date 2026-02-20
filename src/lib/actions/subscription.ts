'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { BILLING_PLANS } from '@/data/billingPlans';
import { OrganizationMember } from '@/models/Organization';

export interface SubscriptionData {
  plan: {
    planId: string;
    type: string;
    tier: string;
  } | null;
  status: string;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  /** Next payment due date (for paid plans); show "Pay by X" in UI */
  currentPeriodEnd?: Date | null;
  /** When payment failed; used for past_due and reminders */
  paymentFailedAt?: Date | null;
  usage: {
    invoicesThisMonth: number;
    monthlyVolume: number;
    recentInvoiceCount: number;
  };
  canCreateOrganization: boolean;
  canAccessPayables: boolean;
  canCreateInvoice: boolean;
  canUseAdvancedFeatures: boolean;
  limits: {
    invoicesPerMonth: number;
    monthlyVolume: number;
    cryptoToCryptoFee: number;
  };
}

export async function getCurrentMonthInvoiceCount(userId: string): Promise<number> {
  try {
    const db = await getDatabase();
    const userObjectId = new ObjectId(userId);
    
    // Get user details
    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      return 0;
    }
    
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Build query based on user type - Organization members should see organization's invoices
    const isOrganization = !!user.organizationId;
    const query: Record<string, unknown> = {
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    };
    
    if (isOrganization) {
      // For organization members, count organization's invoices
      query.organizationId = user.organizationId;
    } else {
      // For individual users, count their own invoices
      query.$or = [
        { issuerId: userObjectId },
        { issuerId: userId },
        { userId: user.email },
        { userId: userId }
      ];
    }
    
    // Query invoices directly with date filter for better performance
    const currentMonthInvoices = await db.collection('invoices').find(query).toArray();
    
    return currentMonthInvoices.length;
    
  } catch {
    return 0;
  }
}

// In-memory cache for subscription data (per session)
const subscriptionCache = new Map<string, { data: SubscriptionData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Function to clear cache for a specific user (call this on login/subscription changes)
export async function clearSubscriptionCache(userId?: string): Promise<void> {
  if (userId) {
    subscriptionCache.delete(userId);
  } else {
    subscriptionCache.clear();
  }
}

/**
 * Activate 15-day trial for a user
 * Gives full access for 15 days; after that they move to free plan (5 invoices, low volume).
 */
export async function activate30DayTrial(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();
    const userObjectId = new ObjectId(userId);
    
    // Get current user
    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Check if user already has a pro subscription (don't override)
    if (user.subscription && user.subscription.planId !== 'receivables-free' && user.subscription.status === 'active') {
      return { success: true };
    }
    
    // Check if user has already used their trial
    if (user.subscription?.hasUsedTrial) {
      return { success: false, error: 'Trial already used' };
    }
    
    // 15-day trial from sign up
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)); // 15 days from now
    
    // Update user with trial subscription
    await db.collection('users').updateOne(
      { _id: userObjectId },
      {
        $set: {
          'subscription.planId': 'trial-premium', // Special trial plan ID
          'subscription.status': 'trial',
          'subscription.trialStartDate': now,
          'subscription.trialEndDate': trialEndDate,
          'subscription.hasUsedTrial': true,
          'subscription.trialActivatedAt': now,
          'subscription.billingPeriod': 'monthly',
          'subscription.createdAt': user.subscription?.createdAt || now,
          'subscription.updatedAt': now,
          'usage.invoicesThisMonth': user.usage?.invoicesThisMonth || 0,
          'usage.monthlyVolume': user.usage?.monthlyVolume || 0,
          'usage.lastResetDate': user.usage?.lastResetDate || now
        }
      }
    );
    
    // Clear cache for this user
    clearSubscriptionCache(userId);
    
    return { success: true };
    
  } catch {
    return { success: false, error: 'Failed to activate trial' };
  }
}

export async function getUserSubscription(): Promise<SubscriptionData | null> {
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return null;
    }

    // Check cache first (but always refresh for new users to ensure trial is recognized)
    const cacheKey = session.user.id;
    const cached = subscriptionCache.get(cacheKey);
    const currentTime = Date.now();
    
    // Only use cache if it's recent AND the cached data shows trial-premium with canCreateInvoice=true
    // This ensures we don't serve stale data that shows limits for trial users
    if (cached && (currentTime - cached.timestamp) < CACHE_DURATION) {
      // If cached data is for trial-premium but shows canCreateInvoice=false, refresh
      if (cached.data.plan?.planId === 'trial-premium' && !cached.data.canCreateInvoice) {
        console.log('🔄 [getUserSubscription] Cached trial data shows limits - refreshing');
        subscriptionCache.delete(cacheKey);
      } else {
      return cached.data;
      }
    }
    
    const db = await getDatabase();
    const userObjectId = new ObjectId(session.user.id);
    
    // Get user data
    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      return null;
    }
    
    
    // Check if user is a member of an organization
    if (user.organizationId) {
      
      // Get organization details
      const organization = await db.collection('organizations').findOne({ _id: user.organizationId });
      if (organization) {
        
        // Find the owner by matching billing email or by role
        let owner = organization.members.find((member: OrganizationMember) => member.role === 'owner');
        
        if (owner) {
        }
        
        // If no owner role found, find by billing email match
        if (!owner) {
          owner = organization.members.find((member: OrganizationMember) => 
            member.email === organization.billingEmail
          );
          if (owner) {
          }
        }
        
        if (!owner) {
          return null;
        }
        
        // Get the owner's user record to access their subscription
        const ownerUser = await db.collection('users').findOne({ _id: new ObjectId(owner.userId) });
        if (!ownerUser) {
          return null;
        }
        
        
        if (!ownerUser.subscription) {
          return null;
        }

        
        
        // Check if organization has cached subscription and if it's up to date
        let orgSubscription = organization.subscription;
        let needsUpdate = false;
        
        if (!orgSubscription) {
          orgSubscription = ownerUser.subscription;
          needsUpdate = true;
        } else {
          // Check if owner's subscription is newer than cached subscription
          const ownerUpdatedAt = new Date(ownerUser.subscription.updatedAt || ownerUser.subscription.createdAt);
          const orgUpdatedAt = new Date(orgSubscription.updatedAt || orgSubscription.createdAt);
          
          if (ownerUpdatedAt > orgUpdatedAt) {
            orgSubscription = ownerUser.subscription;
            needsUpdate = true;
          } else {
          }
        }
        
        // Update organization subscription cache if needed
        if (needsUpdate) {
          try {
            await db.collection('organizations').updateOne(
              { _id: user.organizationId },
              { 
                $set: { 
                  subscription: orgSubscription,
                  updatedAt: new Date()
                }
              }
            );
          } catch {
            // Continue with owner's subscription even if cache update fails
          }
        }
        const planId = orgSubscription.planId || 'receivables-free';
        const plan = BILLING_PLANS.find(p => p.planId === planId) || null;
        
        // Check trial status for organization
        const currentDate = new Date();
        const trialEndDate = orgSubscription.trialEndDate ? new Date(orgSubscription.trialEndDate) : null;
        const isTrialPremiumPlan = planId === 'trial-premium';
        const isTrialActive = !!(isTrialPremiumPlan && trialEndDate && currentDate < trialEndDate);
        const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        
        // Feature access based on organization subscription
        const isPastDue = orgSubscription.status === 'past_due';
        const isPaidPlan = planId !== 'receivables-free' && planId !== 'trial-premium';
        const isActiveOrCombined = !isPastDue && (orgSubscription.status === 'active' || (isPaidPlan && planId.includes('combined')));
        
        const canCreateOrganization = false; // Members can't create organizations
        const canAccessPayables = Boolean(
          isTrialPremiumPlan || 
          ((planId.includes('payables') || planId.includes('combined')) && isActiveOrCombined)
        );
        
        const currentMonthInvoiceCount = orgSubscription.usage?.invoicesThisMonth || 0;
        
        let canCreateInvoice = false;
        if (isPastDue) {
          canCreateInvoice = false;
        } else if (isTrialPremiumPlan) {
          canCreateInvoice = true;
          console.log('✅ [getUserSubscription] Organization on trial-premium - unlimited invoice creation allowed');
        } else if (planId === 'receivables-free') {
          canCreateInvoice = currentMonthInvoiceCount < 5;
        } else {
          canCreateInvoice = orgSubscription.status === 'active';
        }
        
        const canUseAdvancedFeatures = Boolean(isTrialPremiumPlan || (planId !== 'receivables-free' && orgSubscription.status === 'active' && !isPastDue));
        
        const subscriptionData = {
          plan: plan ? {
            planId: plan.planId,
            type: plan.type,
            tier: plan.tier
          } : null,
          status: orgSubscription.status || 'inactive',
          isTrialActive,
          trialDaysRemaining,
          currentPeriodEnd: orgSubscription.currentPeriodEnd ? new Date(orgSubscription.currentPeriodEnd) : null,
          paymentFailedAt: orgSubscription.paymentFailedAt ? new Date(orgSubscription.paymentFailedAt) : null,
          usage: {
            invoicesThisMonth: currentMonthInvoiceCount,
            monthlyVolume: orgSubscription.usage?.monthlyVolume || 0,
            recentInvoiceCount: currentMonthInvoiceCount
          },
          canCreateOrganization,
          canAccessPayables,
          canCreateInvoice,
          canUseAdvancedFeatures,
          limits: {
            invoicesPerMonth: isTrialPremiumPlan ? -1 : (plan?.limits?.invoicesPerMonth || 5),
            monthlyVolume: isTrialPremiumPlan ? -1 : (plan?.limits?.monthlyVolume || 0),
            cryptoToCryptoFee: plan?.limits?.cryptoToCryptoFee || 0
          }
        };


        // Cache the result for organization members too
        subscriptionCache.set(cacheKey, { data: subscriptionData, timestamp: currentTime });

        return subscriptionData;
      } else {
        return null;
      }
    }
    
    // Check if user has a pending invitation before initializing subscription
    if (!user.subscription) {
      
      // Check if user has a pending invitation
      const pendingInvitation = await db.collection('invitation_tokens').findOne({
        email: user.email,
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() }
      });
      
      if (pendingInvitation) {
        return null; // Return null to indicate no subscription yet (will be set after invitation completion)
      }
      
      // Activate 15-day trial for new users
      const trialResult = await activate30DayTrial(session.user.id);
      if (!trialResult.success) {
        await db.collection('users').updateOne(
          { _id: userObjectId },
          {
            $set: {
              'subscription.planId': 'receivables-free',
              'subscription.status': 'active',
              'subscription.billingPeriod': 'monthly',
              'subscription.createdAt': new Date(),
              'subscription.updatedAt': new Date(),
              'usage.invoicesThisMonth': 0,
              'usage.monthlyVolume': 0,
              'usage.lastResetDate': new Date()
            }
          }
        );
      }
    } else {
      // Check if existing user should get trial (if they haven't used it and don't have pro subscription)
      const hasProSubscription = user.subscription.planId !== 'receivables-free' && user.subscription.status === 'active';
      const hasUsedTrial = user.subscription.hasUsedTrial;
      
      if (!hasProSubscription && !hasUsedTrial) {
        await activate30DayTrial(session.user.id);
      }
    }
    
    const subscription = user.subscription || {};
    const planId = subscription.planId || 'receivables-free';
    
    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId) || null;
    
    // Check trial status
    const currentDate = new Date();
    const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
    // CRITICAL: If planId is trial-premium, user is on trial regardless of status field
    // BUT: If user has paid (status is 'active' and planId is NOT trial-premium), they are NOT on trial
    const isTrialPremiumPlan = planId === 'trial-premium';
    const isPaidPlan = planId !== 'receivables-free' && planId !== 'trial-premium';
    // User is only on trial if they have trial-premium plan AND trial hasn't expired AND they haven't paid
    const isTrialActive = !!(isTrialPremiumPlan && trialEndDate && currentDate < trialEndDate && !isPaidPlan);
    const trialDaysRemaining = isTrialActive && trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    
    // If trial has expired, downgrade to free plan (only if it's actually expired)
    if (isTrialPremiumPlan && trialEndDate && currentDate >= trialEndDate) {
      await db.collection('users').updateOne(
        { _id: userObjectId },
        {
          $set: {
            'subscription.planId': 'receivables-free',
            'subscription.status': 'active',
            'subscription.updatedAt': new Date()
          }
        }
      );
      // Update local subscription object
      subscription.planId = 'receivables-free';
      subscription.status = 'active';
    }
    
    // Feature access (trial users get full access)
    // past_due = payment failed; block access until they pay (data is kept)
    const isPastDue = subscription.status === 'past_due';
    // isPaidPlan already declared above (line 399)
    const isActiveOrCombined = !isPastDue && (subscription.status === 'active' || (isPaidPlan && planId.includes('combined')));
    const isTrialOrPro = isTrialPremiumPlan || (isPaidPlan && isActiveOrCombined);
    const canCreateOrganization = Boolean(isTrialOrPro);
    const canAccessPayables = Boolean(
      isTrialPremiumPlan || 
      ((planId.includes('payables') || planId.includes('combined')) && isActiveOrCombined)
    );
    
    // Get current month invoice count
    const currentMonthInvoiceCount = await getCurrentMonthInvoiceCount(session.user.id);
    
    // CRITICAL: Check if user can create invoice based on plan and usage limits
    // past_due: no access until they pay
    let canCreateInvoice = false;
    
    if (isPastDue) {
      canCreateInvoice = false;
    } else if (isTrialPremiumPlan) {
      canCreateInvoice = true;
      console.log('✅ [getUserSubscription] Trial-premium user - unlimited invoice creation allowed');
    } else if (planId === 'receivables-free') {
      const volumeLimit = plan?.limits?.monthlyVolume ?? 2000;
      const currentVolume = user.usage?.monthlyVolume ?? 0;
      canCreateInvoice = currentMonthInvoiceCount < 5 && (volumeLimit <= 0 || currentVolume < volumeLimit);
    } else {
      const planLimit = plan?.limits?.invoicesPerMonth || -1;
      canCreateInvoice = planLimit === -1 || currentMonthInvoiceCount < planLimit;
    }
    
    const canUseAdvancedFeatures = Boolean(isTrialOrPro);
    
    // Usage limits - trial users get unlimited
    const limits = {
      invoicesPerMonth: isTrialPremiumPlan ? -1 : (plan?.limits?.invoicesPerMonth || 5),
      monthlyVolume: isTrialPremiumPlan ? -1 : (plan?.limits?.monthlyVolume || 0),
      cryptoToCryptoFee: plan?.limits?.cryptoToCryptoFee || 0.9,
    };
    
    const result: SubscriptionData = {
      plan: plan ? {
        planId: plan.planId,
        type: plan.type,
        tier: plan.tier
      } : null,
      status: subscription.status || 'active',
      isTrialActive,
      trialDaysRemaining,
      currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
      paymentFailedAt: subscription.paymentFailedAt ? new Date(subscription.paymentFailedAt) : null,
      usage: {
        invoicesThisMonth: currentMonthInvoiceCount,
        monthlyVolume: user.usage?.monthlyVolume || 0,
        recentInvoiceCount: currentMonthInvoiceCount,
      },
      canCreateOrganization,
      canAccessPayables,
      canCreateInvoice,
      canUseAdvancedFeatures,
      limits,
    };
    
    // Debug logging for trial users
    if (isTrialPremiumPlan) {
      console.log('✅ [getUserSubscription] Trial-premium user subscription result:', {
        planId: result.plan?.planId,
        canCreateInvoice: result.canCreateInvoice,
        limits: result.limits,
        isTrialActive: result.isTrialActive
      });
    }
    
    // Cache the result
    subscriptionCache.set(cacheKey, { data: result, timestamp: currentTime });
    
    return result;
    
  } catch {
    return null;
  }
}

/**
 * Check if the user can create an invoice. Optionally pass the invoice total to enforce volume limit.
 */
export async function canCreateInvoice(proposedVolumeAmount?: number): Promise<{
  allowed: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
}> {
  
  try {
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return {
        allowed: false,
        reason: 'Unable to verify subscription status',
        requiresUpgrade: true
      };
    }
    
    // Check if user has reached their monthly invoice count limit
    if (!subscription.canCreateInvoice) {
      if (subscription.plan?.planId === 'receivables-free') {
        const volLimit = subscription.limits.monthlyVolume;
        const volUsed = subscription.usage.monthlyVolume ?? 0;
        if (volLimit > 0 && volUsed >= volLimit) {
          return {
            allowed: false,
            reason: `You have reached your monthly volume limit ($${volLimit.toLocaleString()}). Upgrade to issue more.`,
            requiresUpgrade: true
          };
        }
        return {
          allowed: false,
          reason: 'You have reached your monthly limit of 5 invoices. Upgrade to create more invoices.',
          requiresUpgrade: true
        };
      } else {
        return {
          allowed: false,
          reason: `You have reached your monthly limit of ${subscription.limits.invoicesPerMonth} invoices. Upgrade to create more invoices.`,
          requiresUpgrade: true
        };
      }
    }
    
    // Enforce volume limit when creating a new invoice (e.g. free plan $2,000/month)
    const volumeLimit = subscription.limits.monthlyVolume;
    if (volumeLimit > 0 && typeof proposedVolumeAmount === 'number' && proposedVolumeAmount >= 0) {
      const currentVolume = subscription.usage.monthlyVolume ?? 0;
      if (currentVolume + proposedVolumeAmount > volumeLimit) {
        return {
          allowed: false,
          reason: `This invoice would exceed your monthly volume limit ($${volumeLimit.toLocaleString()}). Current: $${currentVolume.toLocaleString()}. Upgrade for higher limits.`,
          requiresUpgrade: true
        };
      }
    }
    
    return { allowed: true };
    
  } catch {
    return {
      allowed: false,
      reason: 'Unable to verify permissions',
      requiresUpgrade: true
    };
  }
}
