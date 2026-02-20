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
import { calculatePlanPrice } from '@/lib/pricingEngine';

/**
 * Initialize Paystack subscription (for paid plans only).
 * Free plans are handled directly in the database.
 * For dynamic-pricing plans, pass seats to compute amount and create a one-off Paystack plan.
 */
export async function initializePaystackSubscription(
  planId: string,
  billingPeriod: 'monthly' | 'yearly',
  options?: { seats?: number }
): Promise<{ success: boolean; authorizationUrl?: string; error?: string }> {
  try {
    console.log('🚀 [PaystackAction] Starting subscription initialization:', {
      planId,
      billingPeriod,
      seats: options?.seats
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

    // Enterprise: no self-serve payment
    if (plan.isEnterprise) {
      return {
        success: false,
        error: 'Please contact sales for Enterprise pricing.'
      };
    }

    // Business/team plans require an organisation (billing is per organisation)
    const planAudience = (plan as { audience?: string }).audience;
    if (planAudience === 'business' && !session.user.organizationId) {
      return {
        success: false,
        error: 'Create an organisation first to purchase team plans. Go to Settings → Organization, then return to Pricing.'
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

      const updateData: Record<string, unknown> = {
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

    // Resolve Paystack plan code: fixed plan or dynamic (create on the fly)
    let planCode: string | null = null;
    const seats = options?.seats ?? (plan.dynamicPricing?.includedSeats ?? 1);

    if (plan.dynamicPricing) {
      const calculated = calculatePlanPrice(plan, billingPeriod, seats);
      const amountUsd = billingPeriod === 'yearly' ? calculated.totalYearly : calculated.totalMonthly;
      if (amountUsd <= 0) {
        return { success: false, error: 'Invalid price calculation.' };
      }
      const planName = `Global-${plan.name}-${seats}seats-${billingPeriod}`;
      planCode = await PaystackService.createDynamicPlan(
        planName,
        amountUsd,
        billingPeriod,
        { planId, seats }
      );
      if (!planCode) {
        return { success: false, error: 'Failed to create payment plan.' };
      }
    } else {
      planCode = PaystackService.getPlanCode(planId, billingPeriod);
    }

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
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/pricing?cancelled=true`,
        { seats }
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

    // Type guard for transaction
    const transactionData = transaction && typeof transaction === 'object' ? transaction : null;
    if (!transactionData) {
      return {
        success: false,
        error: 'Invalid transaction data'
      };
    }

    const transactionReference = 'reference' in transactionData ? String(transactionData.reference) : undefined;
    const transactionStatus = 'status' in transactionData ? String(transactionData.status) : undefined;
    const transactionCustomer = 'customer' in transactionData && transactionData.customer && typeof transactionData.customer === 'object' ? transactionData.customer as { customer_code?: string } : null;
    const transactionSubscriptionCode = 'subscription_code' in transactionData && transactionData.subscription_code ? String(transactionData.subscription_code) : null;
    const transactionMetadata = 'metadata' in transactionData && transactionData.metadata && typeof transactionData.metadata === 'object' ? transactionData.metadata as { planId?: string; billingPeriod?: string; customerCode?: string; seats?: number } : null;

    console.log('✅ [PaystackAction] Transaction verified:', {
      reference: transactionReference,
      status: transactionStatus,
      customer: transactionCustomer,
      subscription_code: transactionSubscriptionCode,
      metadata: transactionMetadata
    });

    // Check transaction metadata first (most reliable)
    const transactionPlanId = transactionMetadata?.planId;
    const transactionBillingPeriod = transactionMetadata?.billingPeriod;
    
    console.log('📋 [PaystackAction] Transaction metadata:', {
      planId: transactionPlanId,
      billingPeriod: transactionBillingPeriod,
      customerCode: transactionMetadata?.customerCode,
      fullMetadata: JSON.stringify(transactionData.metadata, null, 2)
    });
    
    // CRITICAL: If transaction status is not 'success', don't proceed
    if (transactionStatus !== 'success') {
      console.error('❌ [PaystackAction] Transaction status is not success:', transactionStatus);
      return {
        success: false,
        error: `Transaction status is ${transactionStatus}, not success`
      };
    }

    // Get subscription details if available
    const subscriptionCode = transactionSubscriptionCode;
    if (subscriptionCode) {
      const subscription = await PaystackService.getSubscription(subscriptionCode);
      const subscriptionData = subscription && typeof subscription === 'object' ? subscription : null;
      const subscriptionPlan = subscriptionData && 'plan' in subscriptionData && subscriptionData.plan && typeof subscriptionData.plan === 'object' ? subscriptionData.plan as { plan_code?: string } : null;
      const subscriptionMetadata = subscriptionData && 'metadata' in subscriptionData && subscriptionData.metadata && typeof subscriptionData.metadata === 'object' ? subscriptionData.metadata as { planId?: string; billingPeriod?: string; seats?: number } : null;
      const subscriptionCustomer = subscriptionData && 'customer' in subscriptionData && subscriptionData.customer && typeof subscriptionData.customer === 'object' ? subscriptionData.customer as { customer_code?: string } : null;
      
      console.log('📋 [PaystackAction] Subscription details:', {
        subscriptionCode: subscriptionData && 'subscription_code' in subscriptionData ? String(subscriptionData.subscription_code) : undefined,
        planCode: subscriptionPlan?.plan_code,
        metadata: subscriptionMetadata
      });
      
      // Prioritize transaction metadata, then subscription metadata
      const planId = transactionPlanId || subscriptionMetadata?.planId;
      const billingPeriod = (transactionBillingPeriod || subscriptionMetadata?.billingPeriod) as 'monthly' | 'yearly' | undefined;
      
      if (!planId || !billingPeriod) {
        console.error('❌ [PaystackAction] Missing planId or billingPeriod:', { planId, billingPeriod });
        return {
          success: false,
          error: 'Missing plan information in transaction or subscription'
        };
      }

      // Get customer to find user
      const transactionCustomer = transaction.customer && typeof transaction.customer === 'object' ? transaction.customer as { customer_code?: string } : null;
      const customerCode = transactionMetadata?.customerCode 
        || transactionCustomer?.customer_code 
        || subscriptionCustomer?.customer_code;
      
      if (customerCode && typeof customerCode === 'string') {
        const db = await getDatabase();
        const user = await db.collection('users').findOne({
          paystackCustomerCode: customerCode
        });

        if (user && user._id) {
          const planCode = subscriptionPlan?.plan_code || '';
          console.log('💾 [PaystackAction] Activating subscription for user:', {
            email: user.email,
            userId: user._id.toString(),
            planId,
            billingPeriod,
            subscriptionCode
          });
          
          // Extract seats from metadata if available (prioritize transaction metadata, then subscription metadata)
          const seatsFromMetadata = (transactionMetadata as { seats?: number })?.seats || subscriptionMetadata?.seats;
          
          await SubscriptionServicePaystack.subscribeToPlan(
            user._id,
            planId,
            billingPeriod,
            subscriptionCode,
            planCode,
            seatsFromMetadata ? { seats: seatsFromMetadata } : undefined
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
        const customerCode = transactionMetadata?.customerCode || transactionCustomer?.customer_code;
        
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

            // Extract seats from metadata if available
            const seats = (transactionMetadata as { seats?: number })?.seats;
            
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
                  ...(seats ? { 'subscription.seats': seats } : {}),
                  // Note: paystackSubscriptionCode and paystackPlanCode will be set by webhook
                },
                $unset: {
                  'subscription.trialStartDate': '',
                  'subscription.trialEndDate': '',
                  'subscription.trialActivatedAt': '',
                  'subscription.paymentFailedAt': ''
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
