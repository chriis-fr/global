'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PaystackService } from '@/lib/services/paystackService';
import { BILLING_PLANS } from '@/data/billingPlans';
import { getDatabase } from '@/lib/database';
// Note: SubscriptionService is no longer used for new subscriptions
// Keeping import commented for reference, but all new subscriptions use SubscriptionServicePaystack
// import { SubscriptionService } from '@/lib/services/subscriptionService';
import { ObjectId } from 'mongodb';
import { SubscriptionServicePaystack } from '@/lib/services/subscriptionServicePaystack';
import { clearSubscriptionCache } from './subscription';

/**
 * Initialize Paystack subscription (for paid plans only)
 * Free plans are handled directly in the database
 */
export async function initializePaystackSubscription(
  planId: string,
  billingPeriod: 'monthly' | 'yearly'
): Promise<{ success: boolean; authorizationUrl?: string; error?: string }> {
  try {
    console.log('🚀 [PaystackAction] Starting subscription initialization:', {
      planId,
      billingPeriod
    });

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.user?.email) {
      console.log('❌ [PaystackAction] Unauthorized - no session');
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      console.log('❌ [PaystackAction] Invalid plan ID:', planId);
      return {
        success: false,
        error: 'Invalid plan ID'
      };
    }

    // Handle free plan - update database directly, no Paystack needed
    if (planId === 'receivables-free') {
      console.log('✅ [PaystackAction] Free plan selected, updating database directly');
      
      const db = await getDatabase();
      const userObjectId = new ObjectId(session.user.id);
      
      // Check if user has existing Stripe subscription - preserve it
      const existingUser = await db.collection('users').findOne({ _id: userObjectId });
      const hasStripeSubscription = existingUser?.subscription?.stripeSubscriptionId;
      
      const now = new Date();
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

      const updateData: any = {
        'subscription.planId': planId,
        'subscription.status': 'active',
        'subscription.currentPeriodStart': now,
        'subscription.currentPeriodEnd': currentPeriodEnd,
        'subscription.billingPeriod': billingPeriod,
        'subscription.updatedAt': now,
        // Free plan has no Paystack IDs
        'subscription.paystackSubscriptionCode': null,
        'subscription.paystackPlanCode': null,
      };

      // Preserve existing Stripe subscription data if it exists
      if (hasStripeSubscription) {
        console.log('ℹ️ [PaystackAction] Preserving existing Stripe subscription data');
        // Don't overwrite Stripe fields - they remain intact
      }

      await db.collection('users').updateOne(
        { _id: userObjectId },
        { $set: updateData }
      );

      // Enable services for free plan (receivables services only)
      await SubscriptionServicePaystack.enableServicesForPlan(userObjectId, planId);

      // Clear subscription cache
      await clearSubscriptionCache(session.user.id);

      console.log('✅ [PaystackAction] Free plan activated successfully');
      return {
        success: true
      };
    }

    // Get Paystack plan code for paid plans
    const planCode = PaystackService.getPlanCode(planId, billingPeriod);
    if (!planCode) {
      console.log('❌ [PaystackAction] Paystack plan code not found for plan:', { planId, billingPeriod });
      return {
        success: false,
        error: 'Paystack plan code not configured for this plan'
      };
    }

    console.log('✅ [PaystackAction] Plan code found:', planCode);

    // Create or get Paystack customer
    console.log('🔄 [PaystackAction] Creating/getting Paystack customer...');
    const customerCode = await PaystackService.createOrGetCustomer(
      session.user.email,
      session.user.name || '',
      session.user.id
    );

    if (!customerCode) {
      console.log('❌ [PaystackAction] Failed to create/get customer');
      return {
        success: false,
        error: 'Failed to create or get customer'
      };
    }

    console.log('✅ [PaystackAction] Customer code:', customerCode);

    // Save customer code to user record
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          paystackCustomerCode: customerCode,
          updatedAt: new Date()
        }
      }
    );

    // Initialize subscription
    console.log('🔄 [PaystackAction] Initializing Paystack subscription...');
      const authorizationUrl = await PaystackService.initializeSubscription(
        customerCode,
        planCode,
        planId,
        billingPeriod,
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/subscription/success?reference={REFERENCE}`,
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/pricing?cancelled=true`
      );

    console.log('✅ [PaystackAction] Subscription initialized successfully');
    return {
      success: true,
      authorizationUrl
    };
  } catch (error) {
    console.error('❌ [PaystackAction] Error initializing subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize subscription'
    };
  }
}

/**
 * Verify and activate subscription after payment
 * Called from webhook or success page
 */
export async function verifyAndActivateSubscription(
  reference: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔍 [PaystackAction] Verifying subscription with reference:', reference);

    // Verify transaction with Paystack
    const transaction = await PaystackService.verifyTransaction(reference);
    if (!transaction) {
      console.log('❌ [PaystackAction] Transaction verification failed');
      return {
        success: false,
        error: 'Transaction verification failed'
      };
    }

    console.log('✅ [PaystackAction] Transaction verified:', {
      reference: transaction.reference,
      status: transaction.status,
      customer: transaction.customer,
      subscription_code: transaction.subscription_code,
      metadata: transaction.metadata
    });

    // Check transaction metadata first (most reliable)
    const transactionPlanId = transaction.metadata?.planId;
    const transactionBillingPeriod = transaction.metadata?.billingPeriod;
    
    console.log('📋 [PaystackAction] Transaction metadata:', {
      planId: transactionPlanId,
      billingPeriod: transactionBillingPeriod,
      customerCode: transaction.metadata?.customerCode,
      fullMetadata: JSON.stringify(transaction.metadata, null, 2)
    });
    
    // CRITICAL: If transaction status is not 'success', don't proceed
    if (transaction.status !== 'success') {
      console.error('❌ [PaystackAction] Transaction status is not success:', transaction.status);
      return {
        success: false,
        error: `Transaction status is ${transaction.status}, not success`
      };
    }

    // Get subscription details if available
    if (transaction.subscription_code) {
      const subscription = await PaystackService.getSubscription(transaction.subscription_code);
      console.log('📋 [PaystackAction] Subscription details:', {
        subscriptionCode: subscription?.subscription_code,
        planCode: subscription?.plan?.plan_code,
        metadata: subscription?.metadata
      });
      
      // Prioritize transaction metadata, then subscription metadata
      const planId = transactionPlanId || subscription?.metadata?.planId;
      const billingPeriod = (transactionBillingPeriod || subscription?.metadata?.billingPeriod) as 'monthly' | 'yearly' | undefined;
      
      if (!planId || !billingPeriod) {
        console.error('❌ [PaystackAction] Missing planId or billingPeriod:', { planId, billingPeriod });
        return {
          success: false,
          error: 'Missing plan information in transaction or subscription'
        };
      }

      // Get customer to find user
      const customerCode = transaction.metadata?.customerCode 
        || transaction.customer?.customer_code 
        || subscription?.customer?.customer_code;
      
      if (customerCode) {
        const db = await getDatabase();
        const user = await db.collection('users').findOne({
          paystackCustomerCode: customerCode
        });

        if (user && user._id) {
          console.log('💾 [PaystackAction] Activating subscription for user:', {
            email: user.email,
            userId: user._id.toString(),
            planId,
            billingPeriod,
            subscriptionCode: transaction.subscription_code
          });
          
          await SubscriptionServicePaystack.subscribeToPlan(
            user._id,
            planId,
            billingPeriod,
            transaction.subscription_code,
            subscription?.plan?.plan_code || ''
          );

          // Clear subscription cache
          await clearSubscriptionCache(user._id.toString());

          console.log('✅ [PaystackAction] Subscription activated successfully:', {
            planId,
            billingPeriod,
            userId: user._id.toString()
          });
          return {
            success: true
          };
        } else {
          console.error('❌ [PaystackAction] User not found for customer code:', customerCode);
        }
      } else {
        console.error('❌ [PaystackAction] Customer code not found in transaction or subscription');
      }
    } else {
      // If no subscription_code yet, try to activate from transaction metadata
      // This happens when the subscription hasn't been created yet by Paystack
      if (transactionPlanId && transactionBillingPeriod) {
        const customerCode = transaction.metadata?.customerCode || transaction.customer?.customer_code;
        
        console.log('⚠️ [PaystackAction] No subscription_code in transaction, using metadata fallback:', {
          customerCode,
          planId: transactionPlanId,
          billingPeriod: transactionBillingPeriod,
          note: 'Subscription might be created by webhook later'
        });
        
        if (customerCode) {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({
            paystackCustomerCode: customerCode
          });

          if (user && user._id) {
            console.log('💾 [PaystackAction] Activating subscription from transaction metadata:', {
              email: user.email,
              userId: user._id.toString(),
              planId: transactionPlanId,
              billingPeriod: transactionBillingPeriod,
              currentPlanId: user.subscription?.planId
            });
            
            // IMPORTANT: Update subscription immediately even without subscription_code
            // The webhook will update it with the subscription_code later
            const now = new Date();
            const currentPeriodEnd = new Date();
            currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (transactionBillingPeriod === 'yearly' ? 12 : 1));

            console.log('💾 [PaystackAction] Updating subscription directly from transaction metadata:', {
              userId: user._id.toString(),
              planId: transactionPlanId,
              billingPeriod: transactionBillingPeriod,
              note: 'This is a fallback when subscription_code is not yet available. Webhook will update with subscription_code later.'
            });

            const updateResult = await db.collection('users').updateOne(
              { _id: user._id },
              {
                $set: {
                  'subscription.planId': transactionPlanId,
                  'subscription.status': 'active',
                  'subscription.currentPeriodStart': now,
                  'subscription.currentPeriodEnd': currentPeriodEnd,
                  'subscription.billingPeriod': transactionBillingPeriod,
                  'subscription.updatedAt': now,
                  // Note: paystackSubscriptionCode and paystackPlanCode will be set by webhook
                }
              }
            );

            console.log('📊 [PaystackAction] Database update result:', {
              matchedCount: updateResult.matchedCount,
              modifiedCount: updateResult.modifiedCount,
              acknowledged: updateResult.acknowledged
            });

            // Verify the update worked
            const updatedUser = await db.collection('users').findOne({ _id: user._id });
            console.log('✅ [PaystackAction] Verified subscription update:', {
              userId: user._id.toString(),
              planId: updatedUser?.subscription?.planId,
              status: updatedUser?.subscription?.status,
              billingPeriod: updatedUser?.subscription?.billingPeriod,
              paystackSubscriptionCode: updatedUser?.subscription?.paystackSubscriptionCode
            });

            // Enable services for this plan
            await SubscriptionServicePaystack.enableServicesForPlan(user._id, transactionPlanId);

            await clearSubscriptionCache(user._id.toString());
            
            console.log('✅ [PaystackAction] Subscription activated from transaction metadata (webhook will add subscription_code later)');
            return {
              success: true
            };
          } else {
            console.error('❌ [PaystackAction] User not found for customer code:', customerCode);
          }
        } else {
          console.error('❌ [PaystackAction] Customer code not found in transaction metadata');
        }
      } else {
        console.error('❌ [PaystackAction] Missing planId or billingPeriod in transaction metadata:', {
          transactionPlanId,
          transactionBillingPeriod,
          metadata: transaction.metadata
        });
      }
    }

    return {
      success: false,
      error: 'Could not find subscription details'
    };
  } catch (error) {
    console.error('❌ [PaystackAction] Error verifying subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify subscription'
    };
  }
}

/**
 * Cancel Paystack subscription
 */
export async function cancelPaystackSubscription(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(session.user.id)
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const subscriptionCode = user.subscription?.paystackSubscriptionCode;
    if (!subscriptionCode) {
      return {
        success: false,
        error: 'No active Paystack subscription found'
      };
    }

    // Cancel in Paystack
    const cancelled = await PaystackService.cancelSubscription(subscriptionCode);
    if (!cancelled) {
      return {
        success: false,
        error: 'Failed to cancel subscription in Paystack'
      };
    }

    // Update database (cancel subscription status)
    // Reuse the db variable already declared above
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          'subscription.status': 'cancelled',
          'subscription.updatedAt': new Date()
        }
      }
    );

    // Clear subscription cache
    await clearSubscriptionCache(user._id.toString());

    return {
      success: true
    };
  } catch (error) {
    console.error('❌ [PaystackAction] Error cancelling subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    };
  }
}
