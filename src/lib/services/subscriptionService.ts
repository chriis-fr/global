import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/database';
import { BILLING_PLANS } from '@/data/billingPlans';
import { BillingPlan } from '@/models/Billing';

export class SubscriptionService {
  // Initialize trial for new users (10 days)
  static async initializeTrial(userId: ObjectId): Promise<void> {
    const db = await getDatabase();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 10); // 10-day trial

    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.planId': 'receivables-free',
          'subscription.status': 'trial',
          'subscription.trialStartDate': new Date(),
          'subscription.trialEndDate': trialEndDate,
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

  // Check if user can create invoice with detailed response
  static async canCreateInvoice(userId: ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    requiresUpgrade?: boolean;
  }> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription.canCreateInvoice) {
      if (subscription.status === 'trial' && subscription.trialDaysRemaining <= 0) {
        return {
          allowed: false,
          reason: 'Your trial has expired. Please upgrade to continue creating invoices.',
          requiresUpgrade: true
        };
      }
      
      if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        return {
          allowed: false,
          reason: 'Your subscription has been cancelled or expired. Please reactivate your subscription.',
          requiresUpgrade: true
        };
      }
      
      return {
        allowed: false,
        reason: 'You do not have permission to create invoices with your current plan.',
        requiresUpgrade: true
      };
    }
    
    // Check usage limits
    if (subscription.limits.invoicesPerMonth > 0 && 
        subscription.usage.invoicesThisMonth >= subscription.limits.invoicesPerMonth) {
      return {
        allowed: false,
        reason: `You have reached your monthly limit of ${subscription.limits.invoicesPerMonth} invoices. Please upgrade your plan.`,
        requiresUpgrade: true
      };
    }
    
    return { allowed: true };
  }

  // Increment invoice usage
  static async incrementInvoiceUsage(userId: ObjectId, amount: number = 1): Promise<void> {
    const db = await getDatabase();
    
    await db.collection('users').updateOne(
      { _id: userId },
      {
        $inc: { 
          'usage.invoicesThisMonth': 1,
          'usage.monthlyVolume': amount 
        },
        $set: { 'subscription.updatedAt': new Date() }
      }
    );
  }

  // Get comprehensive user subscription info
  static async getUserSubscription(userId: ObjectId): Promise<{
    plan: BillingPlan | null;
    status: string;
    isTrialActive: boolean;
    trialDaysRemaining: number;
    usage: {
      invoicesThisMonth: number;
      monthlyVolume: number;
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
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: userId });

    if (!user) {
      throw new Error('User not found');
    }

    const subscription = user.subscription || {};
    const usage = user.usage || {};
    const planId = subscription.planId || 'receivables-free';
    
    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId) || null;

    // Check trial status
    const now = new Date();
    const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
    const isTrialActive = Boolean(subscription.status === 'trial' && trialEndDate && now < trialEndDate);
    const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Feature access based on plan and status
    const canCreateOrganization = Boolean(planId !== 'receivables-free' && subscription.status === 'active');
    const canAccessPayables = Boolean((planId.includes('payables') || planId.includes('combined')) && subscription.status === 'active');
    const canCreateInvoice = Boolean(subscription.status === 'active' || isTrialActive);
    const canUseAdvancedFeatures = Boolean(planId.includes('pro') && subscription.status === 'active');

    // Usage limits
    const limits = {
      invoicesPerMonth: plan?.limits?.invoicesPerMonth || 5,
      monthlyVolume: plan?.limits?.monthlyVolume || 0,
      cryptoToCryptoFee: plan?.limits?.cryptoToCryptoFee || 0.9,
    };

    return {
      plan,
      status: subscription.status || 'trial',
      isTrialActive,
      trialDaysRemaining,
      usage: {
        invoicesThisMonth: usage.invoicesThisMonth || 0,
        monthlyVolume: usage.monthlyVolume || 0,
      },
      canCreateOrganization,
      canAccessPayables,
      canCreateInvoice,
      canUseAdvancedFeatures,
      limits,
    };
  }

  // Check if user can perform specific action
  static async canUserPerformAction(
    userId: ObjectId, 
    action: 'createInvoice' | 'createOrganization' | 'accessPayables' | 'useAdvancedFeatures'
  ): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    
    switch (action) {
      case 'createInvoice':
        return subscription.canCreateInvoice;
      case 'createOrganization':
        return subscription.canCreateOrganization;
      case 'accessPayables':
        return subscription.canAccessPayables;
      case 'useAdvancedFeatures':
        return subscription.canUseAdvancedFeatures;
      default:
        return false;
    }
  }

  // Update usage tracking
  static async updateUsage(userId: ObjectId, type: 'invoice' | 'volume', amount: number = 1): Promise<void> {
    const db = await getDatabase();
    
    const updateField = type === 'invoice' ? 'usage.invoicesThisMonth' : 'usage.monthlyVolume';
    
    await db.collection('users').updateOne(
      { _id: userId },
      {
        $inc: { [updateField]: amount },
        $set: { 'subscription.updatedAt': new Date() }
      }
    );
  }

  // Reset monthly usage
  static async resetMonthlyUsage(userId: ObjectId): Promise<void> {
    const db = await getDatabase();
    
    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'usage.invoicesThisMonth': 0,
          'usage.monthlyVolume': 0,
          'usage.lastResetDate': new Date()
        }
      }
    );
  }

  // Subscribe user to a plan
  static async subscribeToPlan(
    userId: ObjectId, 
    planId: string, 
    billingPeriod: 'monthly' | 'yearly',
    stripeSubscriptionId?: string,
    stripePriceId?: string
  ): Promise<void> {
    const db = await getDatabase();
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.planId': planId,
          'subscription.status': 'active',
          'subscription.currentPeriodStart': currentPeriodStart,
          'subscription.currentPeriodEnd': currentPeriodEnd,
          'subscription.billingPeriod': billingPeriod,
          'subscription.stripeSubscriptionId': stripeSubscriptionId,
          'subscription.stripePriceId': stripePriceId,
          'subscription.updatedAt': new Date()
        }
      }
    );
  }

  // Cancel subscription
  static async cancelSubscription(userId: ObjectId): Promise<void> {
    const db = await getDatabase();
    
    await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.status': 'cancelled',
          'subscription.updatedAt': new Date()
        }
      }
    );
  }
}
