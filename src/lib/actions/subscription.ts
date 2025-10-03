'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { BILLING_PLANS } from '@/data/billingPlans';

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
    
    // Query invoices directly with date filter for better performance
    const currentMonthInvoices = await db.collection('invoices').find({
      $or: [
        { issuerId: userObjectId },
        { issuerId: userId },
        { userId: user.email },
        { userId: userId }
      ],
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    }).toArray();
    
    return currentMonthInvoices.length;
    
  } catch (error) {
    console.error('❌ [ServerAction] Error getting invoice count:', error);
    return 0;
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
      hasSubscription: !!user.subscription
    });
    
    // Initialize free plan if no subscription data
    if (!user.subscription) {
      console.log('🔄 [ServerAction] Initializing free plan for user');
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
    
    const subscription = user.subscription || {};
    const planId = subscription.planId || 'receivables-free';
    
    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId) || null;
    
    // Check trial status
    const now = new Date();
    const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
    const isTrialActive = Boolean(subscription.status === 'trial' && trialEndDate && now < trialEndDate);
    const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    
    // Feature access
    const canCreateOrganization = Boolean(planId !== 'receivables-free' && subscription.status === 'active');
    const canAccessPayables = Boolean((planId.includes('payables') || planId.includes('combined')) && subscription.status === 'active');
    
    // Get current month invoice count
    const currentMonthInvoiceCount = await getCurrentMonthInvoiceCount(session.user.id);
    
    // CRITICAL: Check if user can create invoice based on plan and usage limits
    let canCreateInvoice = false;
    
    if (planId === 'receivables-free') {
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
    
    const canUseAdvancedFeatures = Boolean(planId.includes('pro') && subscription.status === 'active');
    
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
