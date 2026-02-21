import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { BILLING_PLANS } from '@/data/billingPlans';
import { sendPaymentReminderEmail, sendPaymentFailedEmail } from '@/lib/services/emailService';

/**
 * Cron job endpoint for payment reminders
 * Should be called daily (e.g., via Vercel Cron or external scheduler)
 * 
 * Security: Add authorization header check in production
 */
export async function GET(request: NextRequest) {
  // Optional: Add authorization header check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const db = await getDatabase();
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));

    let remindersSent = 0;
    let failedRemindersSent = 0;

    // Find users/organizations with payments due in 3 days (active subscriptions)
    const usersDueSoon = await db.collection('users').find({
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': {
        $gte: now,
        $lte: threeDaysFromNow
      },
      'subscription.planId': { $nin: ['receivables-free', 'trial-premium'] }
    }).toArray();

    console.log(`📧 [PaymentReminders] Found ${usersDueSoon.length} users with payments due soon`);

    for (const user of usersDueSoon) {
      try {
        const subscription = user.subscription;
        if (!subscription?.currentPeriodEnd) continue;

        const plan = BILLING_PLANS.find(p => p.planId === subscription.planId);
        if (!plan) continue;

        // Calculate amount due
        const billingPeriod = subscription.billingPeriod || 'monthly';
        const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
        
        // Check if user has organization
        const hasOrganization = !!user.organizationId;
        
        // Send reminder email
        await sendPaymentReminderEmail(
          user.email,
          user.name || user.email,
          {
            planName: plan.name,
            amount,
            currency: plan.currency || 'USD',
            dueDate: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
            billingPeriod,
            hasOrganization
          }
        );

        remindersSent++;
        console.log(`✅ [PaymentReminders] Reminder sent to ${user.email}`);
      } catch (error) {
        console.error(`❌ [PaymentReminders] Failed to send reminder to ${user.email}:`, error);
      }
    }

    // Find users/organizations with failed payments (past_due status)
    // Send reminders at 1 day and 3 days after failure
    const usersWithFailedPayments = await db.collection('users').find({
      'subscription.status': 'past_due',
      'subscription.paymentFailedAt': { $exists: true },
      'subscription.planId': { $nin: ['receivables-free', 'trial-premium'] },
      $or: [
        // 1 day after failure (within last 2 hours to avoid duplicates)
        {
          'subscription.paymentFailedAt': {
            $gte: new Date(oneDayAgo.getTime() - (2 * 60 * 60 * 1000)),
            $lte: oneDayAgo
          }
        },
        // 3 days after failure (within last 2 hours to avoid duplicates)
        {
          'subscription.paymentFailedAt': {
            $gte: new Date(threeDaysAgo.getTime() - (2 * 60 * 60 * 1000)),
            $lte: threeDaysAgo
          }
        }
      ]
    }).toArray();

    console.log(`📧 [PaymentReminders] Found ${usersWithFailedPayments.length} users with failed payments needing reminders`);

    for (const user of usersWithFailedPayments) {
      try {
        const subscription = user.subscription;
        if (!subscription?.paymentFailedAt) continue;

        const plan = BILLING_PLANS.find(p => p.planId === subscription.planId);
        if (!plan) continue;

        const billingPeriod = subscription.billingPeriod || 'monthly';
        const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
        const daysSinceFailure = Math.floor((now.getTime() - new Date(subscription.paymentFailedAt).getTime()) / (24 * 60 * 60 * 1000));
        
        // Check if user has organization
        const hasOrganization = !!user.organizationId;
        
        await sendPaymentFailedEmail(
          user.email,
          user.name || user.email,
          {
            planName: plan.name,
            amount,
            currency: plan.currency || 'USD',
            daysSinceFailure,
            hasOrganization
          }
        );

        failedRemindersSent++;
        console.log(`✅ [PaymentReminders] Failed payment reminder sent to ${user.email} (${daysSinceFailure} days since failure)`);
      } catch (error) {
        console.error(`❌ [PaymentReminders] Failed to send reminder to ${user.email}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      failedRemindersSent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [PaymentReminders] Error processing reminders:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
