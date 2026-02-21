import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/database';
import { BILLING_PLANS } from '@/data/billingPlans';
import { BillingPlan } from '@/models/Billing';

// Define proper types for user data
interface UserData {
  _id: ObjectId;
  email: string;
  subscription?: {
    planId?: string;
    status?: string;
    trialStartDate?: Date;
    trialEndDate?: Date;
    billingPeriod?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
  usage?: {
    invoicesThisMonth?: number;
    monthlyVolume?: number;
    lastResetDate?: Date;
  };
  services?: {
    smartInvoicing?: boolean;
  };
}

export class SubscriptionService {
  // Initialize 15-day trial for new users (full access)
  static async initializeTrial(userId: ObjectId): Promise<void> {
    console.log('🔄 [SubscriptionService] Initializing 15-day trial for user:', userId);
    const db = await getDatabase();
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)); // 15 days from now

    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.planId': 'trial-premium', // Full access trial plan
          'subscription.status': 'trial',
          'subscription.trialStartDate': now,
          'subscription.trialEndDate': trialEndDate,
          'subscription.hasUsedTrial': true,
          'subscription.trialActivatedAt': now,
          'subscription.billingPeriod': 'monthly',
          'subscription.createdAt': now,
          'subscription.updatedAt': new Date(),
          'usage.invoicesThisMonth': 0,
          'usage.monthlyVolume': 0,
          'usage.lastResetDate': new Date()
        }
      }
    );
    console.log('✅ [SubscriptionService] Trial initialized successfully');
  }

  // Initialize free plan for existing users without subscription data
  static async initializeFreePlan(userId: ObjectId): Promise<void> {
    console.log('🔄 [SubscriptionService] Initializing free plan for user:', userId);
    const db = await getDatabase();
    
    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.planId': 'receivables-free',
          'subscription.status': 'active', // Free plan is always active
          'subscription.billingPeriod': 'monthly',
          'subscription.createdAt': new Date(),
          'subscription.updatedAt': new Date(),
          'usage.invoicesThisMonth': 0,
          'usage.monthlyVolume': 0,
          'usage.lastResetDate': new Date()
        }
      }
    );
    console.log('✅ [SubscriptionService] Free plan initialized successfully');
  }

  // Check if user can create invoice with detailed response
  // CRITICAL: Trial users ALWAYS allowed - no limits
  static async canCreateInvoice(userId: ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    requiresUpgrade?: boolean;
  }> {
    console.log('🔍 [SubscriptionService] Checking invoice creation permission for user:', userId);
    const subscription = await this.getUserSubscription(userId);
    
    // TRIAL USERS: Always allowed - unlimited access
    if (subscription.plan?.planId === 'trial-premium' && subscription.isTrialActive) {
      console.log('✅ [SubscriptionService] Trial user - unlimited invoice creation allowed');
      return { allowed: true };
    }
    
    if (!subscription.canCreateInvoice) {
      if (subscription.status === 'trial' && subscription.trialDaysRemaining <= 0) {
        console.log('❌ [SubscriptionService] Trial expired for user:', userId);
        return {
          allowed: false,
          reason: 'Your trial has expired. Please upgrade to continue creating invoices.',
          requiresUpgrade: true
        };
      }
      
      if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        console.log('❌ [SubscriptionService] Subscription cancelled/expired for user:', userId);
        return {
          allowed: false,
          reason: 'Your subscription has been cancelled or expired. Please reactivate your subscription.',
          requiresUpgrade: true
        };
      }
      
      console.log('❌ [SubscriptionService] No permission to create invoices for user:', userId);
      return {
        allowed: false,
        reason: 'You do not have permission to create invoices with your current plan.',
        requiresUpgrade: true
      };
    }

    // Check usage limits - skip for trial users (already handled above) and unlimited plans
    if (subscription.limits.invoicesPerMonth > 0 && 
        subscription.usage.invoicesThisMonth >= subscription.limits.invoicesPerMonth) {
      console.log('❌ [SubscriptionService] Monthly limit reached for user:', userId);
      return {
        allowed: false,
        reason: `You have reached your monthly limit of ${subscription.limits.invoicesPerMonth} invoices. Upgrade to create more invoices.`,
        requiresUpgrade: true
      };
    }

    console.log('✅ [SubscriptionService] Invoice creation allowed for user:', userId);
    return { allowed: true };
  }

  // Get count of invoices for current month
  static async getCurrentMonthInvoiceCount(userId: ObjectId): Promise<number> {
    console.log('🔍 [SubscriptionService] Getting current month invoice count for user:', userId);
    const db = await getDatabase();
    
    // Get user details
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      console.log('❌ [SubscriptionService] User not found for invoice count');
      return 0;
    }
    
    console.log('✅ [SubscriptionService] User details:', {
      userId: userId.toString(),
      userEmail: user.email,
      userObjectId: user._id.toString(),
      organizationId: user.organizationId
    });
    
    // Get start and end of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    console.log('📅 [SubscriptionService] Date range for current month:', {
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString(),
      currentMonth: now.getMonth() + 1,
      currentYear: now.getFullYear(),
      currentDate: now.toISOString()
    });
    
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
      console.log('🏢 [SubscriptionService] Counting organization invoices for organizationId:', user.organizationId);
    } else {
      // For individual users, count their own invoices
      query.issuerId = userId;
      console.log('👤 [SubscriptionService] Counting individual invoices for userId:', userId.toString());
    }
    
    // Try multiple query approaches to find invoices
    console.log('🔍 [SubscriptionService] Attempting to find invoices with query:', query);
    
    // Query 1: Try with the built query
    const query1 = await db.collection('invoices').find(query).toArray();
    
    console.log('📋 [SubscriptionService] Query result:', {
      count: query1.length,
      invoices: query1.map(inv => ({
        id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        organizationId: inv.organizationId,
        issuerId: inv.issuerId,
        createdAt: inv.createdAt
      }))
    });
    
    // Return the count from our main query
    const count = query1.length;
    console.log('📊 [SubscriptionService] Final current month invoice count:', count);
    
    return count;
  }

  // Subscribe user to a plan (DEPRECATED: Use SubscriptionServicePaystack.subscribeToPlan instead)
  // Kept for backward compatibility with existing Stripe subscriptions
  // This method is no longer used for new subscriptions - Paystack is used instead
  static async subscribeToPlan(
    userId: ObjectId, 
    planId: string, 
    billingPeriod: 'monthly' | 'yearly',
    stripeSubscriptionId?: string,
    stripePriceId?: string
  ): Promise<void> {
    console.log('⚠️ [SubscriptionService] DEPRECATED: subscribeToPlan called - this is for backward compatibility only');
    console.log('💡 [SubscriptionService] New subscriptions should use SubscriptionServicePaystack.subscribeToPlan');
    console.log('🔄 [SubscriptionService] Subscribing user to plan (legacy Stripe method):', {
      userId: userId.toString(),
      planId,
      billingPeriod,
      stripeSubscriptionId,
      stripePriceId
    });

    const db = await getDatabase();
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    // Only update Stripe fields if provided (for backward compatibility)
    const updateData: Record<string, unknown> = {
      'subscription.planId': planId,
      'subscription.status': 'active',
      'subscription.currentPeriodStart': currentPeriodStart,
      'subscription.currentPeriodEnd': currentPeriodEnd,
      'subscription.billingPeriod': billingPeriod,
      'subscription.updatedAt': new Date()
    };

    // Only set Stripe fields if provided (preserves existing Paystack subscriptions)
    if (stripeSubscriptionId) {
      updateData['subscription.stripeSubscriptionId'] = stripeSubscriptionId;
    }
    if (stripePriceId) {
      updateData['subscription.stripePriceId'] = stripePriceId;
    }

    console.log('💾 [SubscriptionService] Updating database with:', updateData);

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ [SubscriptionService] User subscription updated successfully (legacy):', userId.toString());
    } else {
      console.log('❌ [SubscriptionService] Failed to update user subscription:', userId.toString());
      throw new Error('Failed to update user subscription');
    }
  }

  // Get user subscription details
  static async getUserSubscription(userId: ObjectId): Promise<{
    plan: BillingPlan | null;
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
  }> {
    console.log('🔍 [SubscriptionService] Getting subscription for user:', userId);
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: userId }) as UserData | null;

    if (!user) {
      console.log('❌ [SubscriptionService] User not found:', userId);
      throw new Error('User not found');
    }

    // If user has no subscription data, initialize them with trial-premium (30-day trial)
    if (!user.subscription) {
      console.log('🔄 [SubscriptionService] User has no subscription data, initializing trial-premium for:', user.email);
      await this.initializeTrial(userId);
      
      // Refetch user data after initialization
      const updatedUser = await db.collection('users').findOne({ _id: userId }) as UserData | null;
      if (!updatedUser) {
        console.log('❌ [SubscriptionService] Failed to initialize user subscription');
        throw new Error('Failed to initialize user subscription');
      }
      console.log('✅ [SubscriptionService] Trial-premium initialized, processing subscription data');
      return this.processSubscriptionData(updatedUser);
    }

    console.log('✅ [SubscriptionService] Processing existing subscription data for user:', user.email);
    return this.processSubscriptionData(user);
  }

  // Process subscription data (extracted for reusability)
  private static async processSubscriptionData(user: UserData): Promise<{
    plan: BillingPlan | null;
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
  }> {
    const subscription = user.subscription || {};
    const usage = user.usage || {};
    const planId = subscription.planId || 'receivables-free';
    
    console.log('🔄 [SubscriptionService] Processing subscription data:', {
      userId: user._id.toString(),
      email: user.email,
      planId,
      status: subscription.status,
      trialEndDate: subscription.trialEndDate
    });
    
    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId) || null;

    // Check trial status
    const now = new Date();
    const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
    const isTrialActive = Boolean(subscription.status === 'trial' && trialEndDate && now < trialEndDate);
    const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Feature access based on plan and status
    // Trial users get full access to all features
    const canCreateOrganization = Boolean(
      (planId !== 'receivables-free' && subscription.status === 'active') || 
      (planId === 'trial-premium' && isTrialActive)
    );
    const canAccessPayables = Boolean(
      ((planId.includes('payables') || planId.includes('combined')) && subscription.status === 'active') ||
      (planId === 'trial-premium' && isTrialActive)
    );
    
    // CRITICAL: Trial users ALWAYS get unlimited invoices - no limits
    // Free plan users can create invoices up to their limit
    const canCreateInvoice = Boolean(
      // Trial is active (trial users get unlimited access - PRIORITY)
      (planId === 'trial-premium' && isTrialActive) ||
      // Active subscription
      (subscription.status === 'active' && planId !== 'trial-premium') ||
      // Free plan (even if trial expired, they can still use free features)
      planId === 'receivables-free'
    );
    
    const canUseAdvancedFeatures = Boolean(
      (planId.includes('pro') && subscription.status === 'active') ||
      (planId === 'trial-premium' && isTrialActive)
    );

    // Usage limits - trial users get unlimited access
    const limits = {
      invoicesPerMonth: planId === 'trial-premium' && isTrialActive ? -1 : (plan?.limits?.invoicesPerMonth || 5),
      monthlyVolume: planId === 'trial-premium' && isTrialActive ? -1 : (plan?.limits?.monthlyVolume || 0),
      cryptoToCryptoFee: plan?.limits?.cryptoToCryptoFee || 0.9,
    };

    // Get current month invoice count for all users (to show accurate count)
    const currentMonthInvoiceCount = await this.getCurrentMonthInvoiceCount(user._id);

    const result = {
      plan,
      status: subscription.status || 'active', // Default to active for free plan
      isTrialActive,
      trialDaysRemaining,
      usage: {
        invoicesThisMonth: currentMonthInvoiceCount, // Use actual count from database
        monthlyVolume: usage.monthlyVolume || 0,
        recentInvoiceCount: currentMonthInvoiceCount, // For free users, this is the same as monthly
      },
      canCreateOrganization,
      canAccessPayables,
      canCreateInvoice,
      canUseAdvancedFeatures,
      limits,
    };

    console.log('✅ [SubscriptionService] Subscription data processed:', {
      userId: user._id.toString(),
      planId,
      status: result.status,
      canCreateInvoice: result.canCreateInvoice,
      canAccessPayables: result.canAccessPayables,
      isTrialActive: result.isTrialActive,
      trialDaysRemaining: result.trialDaysRemaining,
      currentMonthInvoiceCount: result.usage.invoicesThisMonth
    });

    return result;
  }

  // Check if user can perform specific action
  static async canUserPerformAction(
    userId: ObjectId, 
    action: 'createInvoice' | 'createOrganization' | 'accessPayables' | 'useAdvancedFeatures'
  ): Promise<boolean> {
    console.log(' [SubscriptionService] Checking action permission:', { userId: userId.toString(), action });
    const subscription = await this.getUserSubscription(userId);
    
    let result = false;
    switch (action) {
      case 'createInvoice':
        result = subscription.canCreateInvoice;
        break;
      case 'createOrganization':
        result = subscription.canCreateOrganization;
        break;
      case 'accessPayables':
        result = subscription.canAccessPayables;
        break;
      case 'useAdvancedFeatures':
        result = subscription.canUseAdvancedFeatures;
        break;
      default:
        result = false;
    }

    console.log('✅ [SubscriptionService] Action permission result:', { userId: userId.toString(), action, result });
    return result;
  }

  // Update usage tracking
  static async updateUsage(userId: ObjectId, type: 'invoice' | 'volume', amount: number = 1): Promise<void> {
    console.log('🔄 [SubscriptionService] Updating usage:', { userId: userId.toString(), type, amount });
    const db = await getDatabase();
    
    // First, ensure the usage object exists
    await db.collection('users').updateOne(
      { _id: userId, usage: null },
      { $set: { usage: { invoicesThisMonth: 0, monthlyVolume: 0 } } }
    );
    
    // Also ensure usage object exists for users who don't have it at all
    await db.collection('users').updateOne(
      { _id: userId, usage: { $exists: false } },
      { $set: { usage: { invoicesThisMonth: 0, monthlyVolume: 0 } } }
    );
    
    const updateField = type === 'invoice' ? 'usage.invoicesThisMonth' : 'usage.monthlyVolume';
    
    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $inc: { [updateField]: amount } }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ [SubscriptionService] Usage updated successfully:', { userId: userId.toString(), type, amount });
    } else {
      console.log('❌ [SubscriptionService] Failed to update usage:', { userId: userId.toString(), type, amount });
    }
  }

  // Reset monthly usage (should be called monthly)
  static async resetMonthlyUsage(userId: ObjectId): Promise<void> {
    console.log('🔄 [SubscriptionService] Resetting monthly usage for user:', userId);
    const db = await getDatabase();
    
    const result = await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'usage.invoicesThisMonth': 0,
          'usage.monthlyVolume': 0,
          'usage.lastResetDate': new Date()
        }
      }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ [SubscriptionService] Monthly usage reset successfully for user:', userId);
    } else {
      console.log('❌ [SubscriptionService] Failed to reset monthly usage for user:', userId);
    }
  }

  // Cancel subscription
  static async cancelSubscription(userId: ObjectId): Promise<void> {
    console.log('🔄 [SubscriptionService] Cancelling subscription for user:', userId);
    const db = await getDatabase();
    
    const result = await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.status': 'cancelled',
          'subscription.updatedAt': new Date()
        }
      }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ [SubscriptionService] Subscription cancelled successfully for user:', userId);
    } else {
      console.log('❌ [SubscriptionService] Failed to cancel subscription for user:', userId);
    }
  }

  // Increment invoice usage
  static async incrementInvoiceUsage(userId: ObjectId): Promise<void> {
    console.log(' [SubscriptionService] Incrementing invoice usage for user:', userId);
    await this.updateUsage(userId, 'invoice', 1);
  }
}
