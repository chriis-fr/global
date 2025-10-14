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
    
  } catch (error) {
    console.error('❌ [ServerAction] Error getting invoice count:', error);
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
    console.log('🗑️ [ServerAction] Cleared subscription cache for user:', userId);
  } else {
    subscriptionCache.clear();
    console.log('🗑️ [ServerAction] Cleared all subscription cache');
  }
}

/**
 * Activate 30-day trial for a user
 * This gives them access to all features for 30 days
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
      console.log('✅ [Trial] User already has pro subscription, skipping trial activation');
      return { success: true };
    }
    
    // Check if user has already used their trial
    if (user.subscription?.hasUsedTrial) {
      console.log('⚠️ [Trial] User has already used their 30-day trial');
      return { success: false, error: 'Trial already used' };
    }
    
    // Calculate trial dates
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
    
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
    
    console.log('✅ [Trial] 30-day trial activated for user:', userId);
    return { success: true };
    
  } catch (error) {
    console.error('❌ [Trial] Failed to activate 30-day trial:', error);
    return { success: false, error: 'Failed to activate trial' };
  }
}

export async function getUserSubscription(): Promise<SubscriptionData | null> {
  console.log('🔍 [ServerAction] Getting user subscription');
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('❌ [ServerAction] No session found');
      return null;
    }

    // Check cache first
    const cacheKey = session.user.id;
    const cached = subscriptionCache.get(cacheKey);
    const currentTime = Date.now();
    
    if (cached && (currentTime - cached.timestamp) < CACHE_DURATION) {
      console.log('✅ [ServerAction] Using cached subscription data');
      return cached.data;
    }
    
    const db = await getDatabase();
    const userObjectId = new ObjectId(session.user.id);
    
    // Get user data
    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      console.log('❌ [ServerAction] User not found in database');
      return null;
    }
    
    console.log(' [ServerAction] User found:', {
      userId: session.user.id,
      email: user.email,
      hasSubscription: !!user.subscription,
      organizationId: user.organizationId
    });
    
    // Check if user is a member of an organization
    if (user.organizationId) {
      console.log('🏢 [ServerAction] User is organization member, using organization subscription');
      
      // Get organization details
      const organization = await db.collection('organizations').findOne({ _id: user.organizationId });
      if (organization) {
        console.log('🏢 [ServerAction] User is organization member, getting subscription from owner');
        
        // Find the owner by matching billing email or by role
        let owner = organization.members.find((member: OrganizationMember) => member.role === 'owner');
        
        if (owner) {
          console.log('✅ [ServerAction] Found owner by role:', { 
            userId: owner.userId, 
            email: owner.email, 
            role: owner.role 
          });
        }
        
        // If no owner role found, find by billing email match
        if (!owner) {
          owner = organization.members.find((member: OrganizationMember) => 
            member.email === organization.billingEmail
          );
          if (owner) {
            console.log('🔍 [ServerAction] Found owner by billing email match:', { 
              userId: owner.userId, 
              email: owner.email, 
              role: owner.role 
            });
          }
        }
        
        if (!owner) {
          console.log('❌ [ServerAction] No owner found in organization');
          console.log('🔍 [ServerAction] Available members:', organization.members.map((m: OrganizationMember) => ({ role: m.role, email: m.email, userId: m.userId })));
          console.log('🔍 [ServerAction] Billing email:', organization.billingEmail);
          return null;
        }
        
        // Get the owner's user record to access their subscription
        console.log('🔍 [ServerAction] Looking for owner user with ID:', owner.userId);
        const ownerUser = await db.collection('users').findOne({ _id: new ObjectId(owner.userId) });
        if (!ownerUser) {
          console.log('❌ [ServerAction] Owner user not found for ID:', owner.userId);
          console.log('🔍 [ServerAction] Owner data:', { 
            userId: owner.userId, 
            email: owner.email, 
            role: owner.role 
          });
          return null;
        }
        
        console.log('✅ [ServerAction] Found owner user:', { 
          _id: ownerUser._id, 
          email: ownerUser.email, 
          hasSubscription: !!ownerUser.subscription 
        });
        
        if (!ownerUser.subscription) {
          console.log('❌ [ServerAction] Owner has no subscription');
          return null;
        }

        console.log('🔍 [ServerAction] Owner subscription details:', {
          planId: ownerUser.subscription.planId,
          status: ownerUser.subscription.status,
          updatedAt: ownerUser.subscription.updatedAt,
          createdAt: ownerUser.subscription.createdAt
        });
        
        console.log('✅ [ServerAction] Using owner\'s subscription for organization member:', ownerUser.subscription.planId);
        
        // Check if organization has cached subscription and if it's up to date
        let orgSubscription = organization.subscription;
        let needsUpdate = false;
        
        if (!orgSubscription) {
          console.log('🔄 [ServerAction] No cached subscription, using owner\'s subscription');
          orgSubscription = ownerUser.subscription;
          needsUpdate = true;
        } else {
          // Check if owner's subscription is newer than cached subscription
          const ownerUpdatedAt = new Date(ownerUser.subscription.updatedAt || ownerUser.subscription.createdAt);
          const orgUpdatedAt = new Date(orgSubscription.updatedAt || orgSubscription.createdAt);
          
          if (ownerUpdatedAt > orgUpdatedAt) {
            console.log('🔄 [ServerAction] Owner\'s subscription is newer, updating organization cache');
            orgSubscription = ownerUser.subscription;
            needsUpdate = true;
          } else {
            console.log('✅ [ServerAction] Using cached organization subscription');
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
            console.log('✅ [ServerAction] Organization subscription cache updated');
          } catch (error) {
            console.error('❌ [ServerAction] Failed to update organization subscription cache:', error);
            // Continue with owner's subscription even if cache update fails
          }
        }
        const planId = orgSubscription.planId || 'receivables-free';
        const plan = BILLING_PLANS.find(p => p.planId === planId) || null;
        
        // Check trial status for organization
        const currentDate = new Date();
        const trialEndDate = orgSubscription.trialEndDate ? new Date(orgSubscription.trialEndDate) : null;
        const isTrialActive = Boolean(orgSubscription.status === 'trial' && trialEndDate && currentDate < trialEndDate);
        const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        
        // Feature access based on organization subscription
        const canCreateOrganization = false; // Members can't create organizations
        const canAccessPayables = Boolean((planId.includes('payables') || planId.includes('combined')) && orgSubscription.status === 'active');
        
        // Get organization's current month invoice count (use organization's usage, not individual)
        const currentMonthInvoiceCount = orgSubscription.usage?.invoicesThisMonth || 0;
        
        // Check if organization can create invoice
        let canCreateInvoice = false;
        if (planId === 'receivables-free') {
          canCreateInvoice = currentMonthInvoiceCount < 5;
        } else {
          canCreateInvoice = orgSubscription.status === 'active';
        }
        
        const canUseAdvancedFeatures = Boolean(planId !== 'receivables-free' && orgSubscription.status === 'active');
        
        const subscriptionData = {
          plan: plan ? {
            planId: plan.planId,
            type: plan.type,
            tier: plan.tier
          } : null,
          status: orgSubscription.status || 'inactive',
          isTrialActive,
          trialDaysRemaining,
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
            invoicesPerMonth: plan?.limits?.invoicesPerMonth || 5,
            monthlyVolume: plan?.limits?.monthlyVolume || 0,
            cryptoToCryptoFee: plan?.limits?.cryptoToCryptoFee || 0
          }
        };

        console.log('✅ [ServerAction] Returning subscription data for organization member:', {
          planId: subscriptionData.plan?.planId,
          status: subscriptionData.status,
          canCreateInvoice: subscriptionData.canCreateInvoice,
          canAccessPayables: subscriptionData.canAccessPayables,
          canUseAdvancedFeatures: subscriptionData.canUseAdvancedFeatures
        });

        // Cache the result for organization members too
        subscriptionCache.set(cacheKey, { data: subscriptionData, timestamp: currentTime });
        console.log('💾 [ServerAction] Cached organization subscription data for user:', session.user.id);

        return subscriptionData;
      } else {
        console.log('❌ [ServerAction] Organization not found for member');
        return null;
      }
    }
    
    // Check if user has a pending invitation before initializing subscription
    if (!user.subscription) {
      console.log('🔍 [ServerAction] No subscription found, checking for pending invitations...');
      
      // Check if user has a pending invitation
      const pendingInvitation = await db.collection('invitation_tokens').findOne({
        email: user.email,
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() }
      });
      
      if (pendingInvitation) {
        console.log('⏳ [ServerAction] User has pending invitation, skipping subscription initialization');
        console.log('📋 [ServerAction] Pending invitation details:', {
          organizationId: pendingInvitation.organizationId,
          role: pendingInvitation.role,
          expiresAt: pendingInvitation.expiresAt
        });
        return null; // Return null to indicate no subscription yet (will be set after invitation completion)
      }
      
      // Activate 30-day trial for new users
      console.log('🎉 [ServerAction] No pending invitation found, activating 30-day trial for user');
      const trialResult = await activate30DayTrial(session.user.id);
      if (!trialResult.success) {
        console.log('⚠️ [ServerAction] Failed to activate trial, falling back to free plan');
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
        console.log('🎉 [ServerAction] Existing user eligible for 30-day trial, activating...');
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
    const isTrialActive = Boolean(subscription.status === 'trial' && trialEndDate && currentDate < trialEndDate);
    const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    
    // If trial has expired, downgrade to free plan
    if (subscription.status === 'trial' && trialEndDate && currentDate >= trialEndDate) {
      console.log('⏰ [ServerAction] Trial expired, downgrading to free plan');
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
    const isTrialOrPro = planId === 'trial-premium' || (planId !== 'receivables-free' && subscription.status === 'active');
    const canCreateOrganization = Boolean(isTrialOrPro);
    const canAccessPayables = Boolean(planId === 'trial-premium' || (planId.includes('payables') || planId.includes('combined')) && subscription.status === 'active');
    
    // Get current month invoice count
    const currentMonthInvoiceCount = await getCurrentMonthInvoiceCount(session.user.id);
    
    // CRITICAL: Check if user can create invoice based on plan and usage limits
    let canCreateInvoice = false;
    
    if (planId === 'trial-premium') {
      // Trial users get unlimited invoices
      canCreateInvoice = true;
      console.log('🎉 [ServerAction] Trial user - unlimited invoices');
    } else if (planId === 'receivables-free') {
      // Free plan users can create invoices only if they haven't reached the monthly limit
      canCreateInvoice = currentMonthInvoiceCount < 5;
      console.log('🔍 [ServerAction] Free plan invoice check:', {
        currentCount: currentMonthInvoiceCount,
        limit: 5,
        canCreate: canCreateInvoice
      });
    } else {
      // Paid plan users can create invoices based on their plan limits
      const planLimit = plan?.limits?.invoicesPerMonth || -1;
      canCreateInvoice = planLimit === -1 || currentMonthInvoiceCount < planLimit;
      console.log('�� [ServerAction] Paid plan invoice check:', {
        planId,
        currentCount: currentMonthInvoiceCount,
        planLimit,
        canCreate: canCreateInvoice
      });
    }
    
    const canUseAdvancedFeatures = Boolean(isTrialOrPro);
    
    // Usage limits
    const limits = {
      invoicesPerMonth: plan?.limits?.invoicesPerMonth || 5,
      monthlyVolume: plan?.limits?.monthlyVolume || 0,
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
    
    console.log('✅ [ServerAction] Subscription data processed:', {
      planId: result.plan?.planId,
      status: result.status,
      invoicesThisMonth: result.usage.invoicesThisMonth,
      canCreateInvoice: result.canCreateInvoice,
      limitReached: !result.canCreateInvoice
    });
    
    // Cache the result
    subscriptionCache.set(cacheKey, { data: result, timestamp: currentTime });
    console.log('💾 [ServerAction] Cached subscription data for user:', session.user.id);
    
    return result;
    
  } catch (error) {
    console.error('❌ [ServerAction] Error getting subscription:', error);
    return null;
  }
}

export async function canCreateInvoice(): Promise<{
  allowed: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
}> {
  console.log('🔍 [ServerAction] Checking if user can create invoice');
  
  try {
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return {
        allowed: false,
        reason: 'Unable to verify subscription status',
        requiresUpgrade: true
      };
    }
    
    // Check if user has reached their monthly limit
    if (!subscription.canCreateInvoice) {
      if (subscription.plan?.planId === 'receivables-free') {
        return {
          allowed: false,
          reason: `You have reached your monthly limit of 5 invoices. Upgrade to create more invoices.`,
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
    
    console.log('✅ [ServerAction] Invoice creation allowed');
    return { allowed: true };
    
  } catch (error) {
    console.error('❌ [ServerAction] Error checking invoice creation:', error);
    return {
      allowed: false,
      reason: 'Unable to verify permissions',
      requiresUpgrade: true
    };
  }
}
