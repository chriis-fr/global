import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { SubscriptionServicePaystack } from '@/lib/services/subscriptionServicePaystack';
import { clearSubscriptionCache } from '@/lib/actions/subscription';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/database';
import { PaystackService } from '@/lib/services/paystackService';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
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

  let event: any;
  try {
    event = JSON.parse(body);
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
              allMetadata: newSubscription.metadata
            });

            if (planId && billingPeriod) {
              console.log('💾 [PaystackWebhook] Activating subscription for user:', {
                email: user.email,
                userId: user._id.toString(),
                planId,
                billingPeriod,
                subscriptionCode: newSubscription.subscription_code
              });
              
              await SubscriptionServicePaystack.subscribeToPlan(
                user._id,
                planId,
                billingPeriod,
                newSubscription.subscription_code,
                newSubscription.plan.plan_code
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

            if (planId && billingPeriod) {
              console.log('💾 [PaystackWebhook] Updating subscription for user:', user.email);
              
              await SubscriptionServicePaystack.subscribeToPlan(
                user._id,
                planId,
                billingPeriod,
                updatedSubscription.subscription_code,
                updatedSubscription.plan.plan_code
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
          
          if (transaction && transaction.status === 'success' && transaction.subscription_code) {
            const db = await getDatabase();
            const user = await db.collection('users').findOne({
              paystackCustomerCode: charge.customer.customer_code
            });

            if (user && user._id) {
              // Get subscription details
              const subscription = await PaystackService.getSubscription(transaction.subscription_code);
              
              if (subscription && subscription.plan?.plan_code) {
                // CRITICAL: Use metadata.planId first (most reliable)
                const planId = subscription.metadata?.planId;
                const billingPeriod = subscription.metadata?.billingPeriod as 'monthly' | 'yearly' | undefined;

                console.log('📋 [PaystackWebhook] Charge success subscription metadata:', {
                  planId,
                  billingPeriod,
                  allMetadata: subscription.metadata
                });

                if (planId && billingPeriod) {
                  console.log('💾 [PaystackWebhook] Activating subscription after successful charge:', user.email);
                  
                  await SubscriptionServicePaystack.subscribeToPlan(
                    user._id,
                    planId,
                    billingPeriod,
                    transaction.subscription_code,
                    subscription.plan.plan_code
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

    default:
      console.log(`❓ [PaystackWebhook] Unhandled event type: ${event.event}`);
      break;
  }

  console.log('✅ [PaystackWebhook] Event processed successfully');
  return NextResponse.json({ received: true });
}
