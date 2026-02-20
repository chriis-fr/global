import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SubscriptionServicePaystack } from '@/lib/services/subscriptionServicePaystack';
import { clearSubscriptionCache } from '@/lib/actions/subscription';
import { getDatabase } from '@/lib/database';
import { PaystackService } from '@/lib/services/paystackService';

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || '';

// Paystack webhook IP addresses (whitelist)
// These are the only IPs that Paystack sends webhooks from
const PAYSTACK_WEBHOOK_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220'
];

/**
 * Verify that the request is coming from a Paystack IP address
 */
function verifyPaystackIP(request: NextRequest): boolean {
  // Get the real IP address from various headers (handles proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  // Try to get the actual client IP
  let clientIP: string | null = null;
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    clientIP = forwardedFor.split(',')[0].trim();
  } else if (realIP) {
    clientIP = realIP;
  } else if (cfConnectingIP) {
    clientIP = cfConnectingIP;
  } else {
    // Fallback: try to get from request URL or other sources
    // In Next.js, we might need to check the connection
    console.log('⚠️ [PaystackWebhook] Could not determine client IP from headers');
  }

  if (!clientIP) {
    // In development, allow if IP whitelisting is disabled
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_PAYSTACK_IP_CHECK === 'true') {
      console.log('⚠️ [PaystackWebhook] IP check disabled in development');
      return true;
    }
    console.log('❌ [PaystackWebhook] Could not verify IP address');
    return false;
  }

  const isAllowed = PAYSTACK_WEBHOOK_IPS.includes(clientIP);
  
  if (!isAllowed) {
    console.log('❌ [PaystackWebhook] Request from unauthorized IP:', clientIP);
    console.log('📋 [PaystackWebhook] Allowed IPs:', PAYSTACK_WEBHOOK_IPS.join(', '));
  } else {
    console.log('✅ [PaystackWebhook] Request from authorized Paystack IP:', clientIP);
  }

  return isAllowed;
}

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(body: string, signature: string): boolean {
  if (!PAYSTACK_WEBHOOK_SECRET) {
    console.log('⚠️ [PaystackWebhook] No webhook secret configured, skipping verification');
    console.log('💡 [PaystackWebhook] Set PAYSTACK_WEBHOOK_SECRET in your .env.local file');
    return true; // Allow in development
  }

  console.log('🔐 [PaystackWebhook] Verifying signature:', {
    hasSecret: !!PAYSTACK_WEBHOOK_SECRET,
    secretLength: PAYSTACK_WEBHOOK_SECRET.length,
    signatureLength: signature.length,
    bodyLength: body.length,
    signaturePrefix: signature.substring(0, 10) + '...'
  });

  const hash = crypto
    .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const isValid = hash === signature;
  
  if (!isValid) {
    console.log('❌ [PaystackWebhook] Signature mismatch:', {
      expected: hash.substring(0, 20) + '...',
      received: signature.substring(0, 20) + '...',
      note: 'Make sure PAYSTACK_WEBHOOK_SECRET matches the one in Paystack Dashboard'
    });
  } else {
    console.log('✅ [PaystackWebhook] Signature verified successfully');
  }

  return isValid;
}

export async function POST(request: NextRequest) {
  console.log('🔔 [PaystackWebhook] Webhook received');
  
  // Block webhook processing in production if needed (remove this if you want webhooks in production)
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_PAYSTACK_WEBHOOK === 'true') {
    console.log('🚫 [PaystackWebhook] Webhook processing disabled in production environment');
    return NextResponse.json({ received: true, message: 'Webhook processing disabled' });
  }
  
  // Verify IP address (first line of defense)
  if (!verifyPaystackIP(request)) {
    console.log('❌ [PaystackWebhook] Request from unauthorized IP address');
    return NextResponse.json({ error: 'Unauthorized IP address' }, { status: 403 });
  }
  
  const body = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';

  console.log('📋 [PaystackWebhook] Webhook headers:', {
    hasSignature: !!signature,
    signatureHeader: signature ? signature.substring(0, 20) + '...' : 'missing',
    contentType: request.headers.get('content-type'),
    allHeaders: Object.fromEntries(request.headers.entries())
  });

  // Verify webhook signature (second line of defense)
  if (!verifyPaystackSignature(body, signature)) {
    console.log('❌ [PaystackWebhook] Invalid webhook signature - webhook will be rejected');
    console.log('💡 [PaystackWebhook] Check that PAYSTACK_WEBHOOK_SECRET in .env.local matches Paystack Dashboard');
    // In development, allow webhook to proceed if secret is not set (for testing)
    if (!PAYSTACK_WEBHOOK_SECRET) {
      console.log('⚠️ [PaystackWebhook] Proceeding without signature verification (development mode)');
    } else {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  interface PaystackWebhookEvent {
    event: string;
    data?: {
      reference?: string;
      subscription?: {
        subscription_code?: string;
        plan?: {
          plan_code?: string;
          name?: string;
        };
        customer?: {
          customer_code?: string;
        };
        metadata?: {
          planId?: string;
          billingPeriod?: string;
          seats?: number;
        };
      };
      customer?: {
        customer_code?: string;
      };
      metadata?: {
        planId?: string;
        billingPeriod?: string;
        seats?: number;
      };
      plan?: {
        plan_code?: string;
        name?: string;
      };
      subscription_code?: string;
      authorization?: {
        metadata?: {
          seats?: number;
        };
      };
      [key: string]: unknown;
    };
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(body) as PaystackWebhookEvent;
  } catch (error) {
    console.log('❌ [PaystackWebhook] Failed to parse webhook body:', error);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('🎯 [PaystackWebhook] Processing event:', event.event, event.data?.reference || event.data?.subscription?.subscription_code);

  switch (event.event) {
    case 'subscription.create':
      console.log('🆕 [PaystackWebhook] Processing subscription.create event');
      const newSubscription = event.data;
      
      if (newSubscription?.subscription_code && newSubscription?.customer?.customer_code) {
        try {
          // Get customer to find user
          const db = await getDatabase();
          const user = await db.collection('users').findOne({
            paystackCustomerCode: newSubscription.customer.customer_code
          });

          if (user && user._id && newSubscription.plan?.plan_code) {
            // CRITICAL: Use metadata.planId first (most reliable) - this is what we sent during initialization
            const planId = newSubscription.metadata?.planId;
            const billingPeriod = newSubscription.metadata?.billingPeriod as 'monthly' | 'yearly' | undefined;

            console.log('📋 [PaystackWebhook] Subscription metadata:', {
              planId: newSubscription.metadata?.planId,
              billingPeriod: newSubscription.metadata?.billingPeriod,
              seats: newSubscription.metadata?.seats,
              allMetadata: newSubscription.metadata
            });

            // Also check transaction metadata if subscription metadata doesn't have seats
            // Paystack sometimes doesn't copy transaction metadata to subscription metadata
            let seats = newSubscription.metadata?.seats;
            if (!seats && event.data?.authorization?.metadata?.seats) {
              seats = event.data.authorization.metadata.seats;
              console.log('📋 [PaystackWebhook] Found seats in transaction metadata:', seats);
            }
            
            // Fallback: Try to extract seats from plan name/description if metadata is missing
            if (!seats && newSubscription.plan?.name) {
              const planName = newSubscription.plan.name;
              const seatsMatch = planName.match(/(\d+)\s*seat/i);
              if (seatsMatch) {
                seats = parseInt(seatsMatch[1], 10);
                console.log('📋 [PaystackWebhook] Extracted seats from plan name:', seats);
              }
            }

            if (planId && billingPeriod && newSubscription.subscription_code && newSubscription.plan?.plan_code) {
              const subscriptionCode = String(newSubscription.subscription_code);
              const planCode = String(newSubscription.plan.plan_code);
              
              console.log('💾 [PaystackWebhook] Activating subscription for user:', {
                email: user.email,
                userId: user._id.toString(),
                planId,
                billingPeriod,
                subscriptionCode,
                seats: seats || 'not found'
              });
              
              await SubscriptionServicePaystack.subscribeToPlan(
                user._id,
                planId,
                billingPeriod,
                subscriptionCode,
                planCode,
                seats ? { seats: typeof seats === 'number' ? seats : parseInt(String(seats), 10) } : undefined
              );

              // Clear subscription cache
              await clearSubscriptionCache(user._id.toString());

              console.log(`✅ [PaystackWebhook] User ${user._id} successfully subscribed to ${planId} (${billingPeriod})`);
            } else {
              console.error('❌ [PaystackWebhook] Missing planId or billingPeriod in metadata:', {
                planId,
                billingPeriod,
                metadata: newSubscription.metadata
              });
            }
          } else {
            console.log('❌ [PaystackWebhook] User not found for customer:', newSubscription.customer.customer_code);
          }
        } catch (error) {
          console.error('❌ [PaystackWebhook] Error processing subscription.create:', error);
        }
      }
      break;

    case 'subscription.update':
      console.log('🔄 [PaystackWebhook] Processing subscription.update event');
      const updatedSubscription = event.data;
      
      if (updatedSubscription?.subscription_code && updatedSubscription?.customer?.customer_code) {
        try {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({
            paystackCustomerCode: updatedSubscription.customer.customer_code
          });

          if (user && user._id && updatedSubscription.plan?.plan_code) {
            // CRITICAL: Use metadata.planId first (most reliable)
            const planId = updatedSubscription.metadata?.planId;
            const billingPeriod = updatedSubscription.metadata?.billingPeriod as 'monthly' | 'yearly' | undefined;

            console.log('📋 [PaystackWebhook] Updated subscription metadata:', {
              planId,
              billingPeriod,
              allMetadata: updatedSubscription.metadata
            });

            if (planId && billingPeriod && updatedSubscription.subscription_code && updatedSubscription.plan?.plan_code) {
              const subscriptionCode = String(updatedSubscription.subscription_code);
              const planCode = String(updatedSubscription.plan.plan_code);
              const seats = updatedSubscription.metadata?.seats;
              
              console.log('💾 [PaystackWebhook] Updating subscription for user:', user.email);
              
              await SubscriptionServicePaystack.subscribeToPlan(
                user._id,
                planId,
                billingPeriod,
                subscriptionCode,
                planCode,
                seats ? { seats } : undefined
              );

              // Update organization subscription if user is an organization owner
              const organizations = await db.collection('organizations').find({
                'members.userId': user._id,
                'members.role': 'owner'
              }).toArray();

              if (organizations.length > 0) {
                const updatedUser = await db.collection('users').findOne({ _id: user._id });
                if (updatedUser && updatedUser.subscription) {
                  for (const org of organizations) {
                    await db.collection('organizations').updateOne(
                      { _id: org._id },
                      { 
                        $set: { 
                          subscription: updatedUser.subscription,
                          updatedAt: new Date()
                        }
                      }
                    );
                  }
                }
              }

              await clearSubscriptionCache(user._id.toString());
              console.log(`✅ [PaystackWebhook] User ${user._id} subscription updated to ${planId}`);
            }
          }
        } catch (error) {
          console.error('❌ [PaystackWebhook] Error processing subscription.update:', error);
        }
      }
      break;

    case 'subscription.disable':
      console.log('🗑️ [PaystackWebhook] Processing subscription.disable event');
      const disabledSubscription = event.data;
      
      if (disabledSubscription?.subscription_code && disabledSubscription?.customer?.customer_code) {
        try {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({
            paystackCustomerCode: disabledSubscription.customer.customer_code
          });

          if (user && user._id) {
            console.log('💾 [PaystackWebhook] Cancelling subscription for user:', user.email);
            
            await db.collection('users').updateOne(
              { _id: user._id },
              {
                $set: {
                  'subscription.status': 'cancelled',
                  'subscription.updatedAt': new Date()
                }
              }
            );

            // Update organization subscription if user is an organization owner
            const organizations = await db.collection('organizations').find({
              'members.userId': user._id,
              'members.role': 'owner'
            }).toArray();

            if (organizations.length > 0) {
              const updatedUser = await db.collection('users').findOne({ _id: user._id });
              if (updatedUser && updatedUser.subscription) {
                for (const org of organizations) {
                  await db.collection('organizations').updateOne(
                    { _id: org._id },
                    { 
                      $set: { 
                        subscription: updatedUser.subscription,
                        updatedAt: new Date()
                      }
                    }
                  );
                }
              }
            }

            await clearSubscriptionCache(user._id.toString());
            console.log(`✅ [PaystackWebhook] User ${user._id} subscription cancelled`);
          }
        } catch (error) {
          console.error('❌ [PaystackWebhook] Error processing subscription.disable:', error);
        }
      }
      break;

    case 'charge.success':
      console.log('💰 [PaystackWebhook] Processing charge.success event');
      const charge = event.data;
      
      if (charge?.reference && charge?.customer?.customer_code) {
        try {
          // Verify transaction
          const transaction = await PaystackService.verifyTransaction(charge.reference);
          
          if (transaction && typeof transaction === 'object' && 'status' in transaction && transaction.status === 'success' && 'subscription_code' in transaction && transaction.subscription_code) {
            const db = await getDatabase();
            const user = await db.collection('users').findOne({
              paystackCustomerCode: charge.customer.customer_code
            });

            if (user && user._id) {
              // Get subscription details
              const subscriptionCode = String(transaction.subscription_code);
              const subscription = await PaystackService.getSubscription(subscriptionCode);
              
              if (subscription && typeof subscription === 'object' && 'plan' in subscription && subscription.plan && typeof subscription.plan === 'object' && 'plan_code' in subscription.plan && subscription.plan.plan_code) {
                // CRITICAL: Use metadata.planId first (most reliable)
                const planId = subscription.metadata && typeof subscription.metadata === 'object' && 'planId' in subscription.metadata ? String(subscription.metadata.planId) : undefined;
                const billingPeriod = subscription.metadata && typeof subscription.metadata === 'object' && 'billingPeriod' in subscription.metadata ? String(subscription.metadata.billingPeriod) as 'monthly' | 'yearly' : undefined;

                console.log('📋 [PaystackWebhook] Charge success subscription metadata:', {
                  planId,
                  billingPeriod,
                  allMetadata: subscription.metadata
                });

                if (planId && billingPeriod) {
                  const planCode = String(subscription.plan.plan_code);
                  const meta = subscription.metadata as { planId?: string; billingPeriod?: string; seats?: number } | undefined;
                  const seats = meta?.seats;
                  console.log('💾 [PaystackWebhook] Activating subscription after successful charge:', user.email);
                  
                  await SubscriptionServicePaystack.subscribeToPlan(
                    user._id,
                    planId,
                    billingPeriod,
                    subscriptionCode,
                    planCode,
                    seats ? { seats } : undefined
                  );

                  await clearSubscriptionCache(user._id.toString());
                  console.log(`✅ [PaystackWebhook] Subscription activated for user ${user._id}`);
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ [PaystackWebhook] Error processing charge.success:', error);
        }
      }
      break;

    case 'charge.failed':
      console.log('⚠️ [PaystackWebhook] Processing charge.failed event');
      const failedCharge = event.data as { customer?: { customer_code?: string }; reference?: string } | undefined;
      if (failedCharge?.customer?.customer_code) {
        try {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({
            paystackCustomerCode: failedCharge.customer.customer_code
          });
          if (user && user._id && user.subscription?.planId && user.subscription.planId !== 'receivables-free') {
            const now = new Date();
            const updatePayload = {
              'subscription.status': 'past_due',
              'subscription.paymentFailedAt': now,
              'subscription.updatedAt': now
            };
            await db.collection('users').updateOne(
              { _id: user._id },
              { $set: updatePayload }
            );
            const updatedUser = await db.collection('users').findOne({ _id: user._id });
            if (updatedUser?.subscription) {
              const orgs = await db.collection('organizations').find({
                'members.userId': user._id,
                'members.role': 'owner'
              }).toArray();
              for (const org of orgs) {
                await db.collection('organizations').updateOne(
                  { _id: org._id },
                  { $set: { subscription: updatedUser.subscription, updatedAt: now } }
                );
              }
            }
            await clearSubscriptionCache(user._id.toString());
            console.log(`✅ [PaystackWebhook] User ${user._id} set to past_due after payment failure`);

            // Send immediate payment failed notification email
            try {
              const { sendPaymentFailedEmail } = await import('@/lib/services/emailService');
              const { BILLING_PLANS } = await import('@/data/billingPlans');
              const plan = BILLING_PLANS.find(p => p.planId === updatedUser?.subscription?.planId);
              
              if (plan && updatedUser) {
                const billingPeriod = updatedUser.subscription.billingPeriod || 'monthly';
                const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                const hasOrganization = !!updatedUser.organizationId;
                
                await sendPaymentFailedEmail(
                  updatedUser.email,
                  updatedUser.name || updatedUser.email,
                  {
                    planName: plan.name,
                    amount,
                    currency: plan.currency || 'USD',
                    daysSinceFailure: 0,
                    hasOrganization
                  }
                );
                console.log(`✅ [PaystackWebhook] Payment failed email sent to ${updatedUser.email}`);
              }
            } catch (emailError) {
              console.error('❌ [PaystackWebhook] Failed to send payment failed email:', emailError);
              // Don't fail the webhook if email fails
            }
          }
        } catch (error) {
          console.error('❌ [PaystackWebhook] Error processing charge.failed:', error);
        }
      }
      break;

    default:
      console.log(`❓ [PaystackWebhook] Unhandled event type: ${event.event}`);
      break;
  }

  console.log('✅ [PaystackWebhook] Event processed successfully');
  return NextResponse.json({ received: true });
}
