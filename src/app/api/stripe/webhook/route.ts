import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { SubscriptionService } from '@/lib/services/subscriptionService';
import { clearSubscriptionCache } from '@/lib/actions/subscription';
import { ObjectId } from 'mongodb';

const endpointWebhookSecret = process.env.SIGN_SECRET_STRIPE_LOCAL;
const secret = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(secret || '', {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  console.log('🔔 [Webhook] Stripe webhook received')
  
  const body = await request.text();
  let event: Stripe.Event;

  if (endpointWebhookSecret) {
    console.log(" [Webhook] Verifying webhook signature");
        const signature = request.headers.get('stripe-signature');
    console.log("📝 [Webhook] Signature:", signature);
    
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature!,
        endpointWebhookSecret
      );
      console.log("✅ [Webhook] Event verified:", event.type, event.id);
    } catch (error: unknown) {
      console.log(`❌ [Webhook] Signature verification failed:`, error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  } else {
    console.log("⚠️ [Webhook] No webhook secret configured, parsing without verification");
    event = JSON.parse(body) as Stripe.Event;
  }

  console.log('🎯 [Webhook] Processing event:', event.type, event.id);

  switch (event.type) {
    case 'checkout.session.completed':
      console.log('🛒 [Webhook] Processing checkout.session.completed event');
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('📋 [Webhook] Checkout session details:', {
        sessionId: session.id,
        mode: session.mode,
        customerId: session.customer,
        subscriptionId: session.subscription,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email
      });
      
      if (session.mode === 'subscription' && session.subscription) {
        console.log('🔄 [Webhook] Processing subscription checkout...');
        
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          
          console.log(' [Webhook] Subscription details:', {
            subscriptionId: subscription.id,
            status: subscription.status,
            planId: subscription.metadata?.planId,
            billingPeriod: subscription.metadata?.billingPeriod,
            customerId: customerId,
            priceId: subscription.items.data[0]?.price.id,
            quantity: subscription.items.data[0]?.quantity
          });
          
          // Get user by customer ID
          console.log('🔍 [Webhook] Retrieving Stripe customer...');
          const customer = await stripe.customers.retrieve(customerId);
          
          // Check if customer is not deleted and has metadata
          if (!customer.deleted && 'metadata' in customer && customer.metadata?.userId) {
            const userId = customer.metadata.userId;
            console.log('👤 [Webhook] Customer found:', { 
              customerId, 
              userId, 
              customerEmail: customer.email,
              customerName: customer.name
            });
            
            if (subscription.metadata?.planId && subscription.metadata?.billingPeriod) {
              console.log('💾 [Webhook] Updating user subscription in database...');
              
              await SubscriptionService.subscribeToPlan(
                new ObjectId(userId),
                subscription.metadata.planId,
                subscription.metadata.billingPeriod as 'monthly' | 'yearly',
                subscription.id,
                subscription.items.data[0]?.price.id || ''
              );
              
              console.log(`✅ [Webhook] User ${userId} successfully subscribed to ${subscription.metadata.planId}`);
            } else {
              console.log('❌ [Webhook] Missing subscription metadata:', {
                planId: subscription.metadata?.planId,
                billingPeriod: subscription.metadata?.billingPeriod,
                allMetadata: subscription.metadata
              });
            }
          } else {
            console.log('❌ [Webhook] Customer not found or deleted:', {
              customerId,
              deleted: customer.deleted,
              hasUserId: !customer.deleted && 'metadata' in customer ? !!customer.metadata?.userId : false
            });
          }
        } catch (error) {
          console.error('❌ [Webhook] Error processing subscription checkout:', error);
        }
      } else {
        console.log('ℹ️ [Webhook] Checkout session is not a subscription:', {
          mode: session.mode,
          hasSubscription: !!session.subscription
        });
      }
      break;

    case 'customer.subscription.updated':
      console.log('🔄 [Webhook] Processing customer.subscription.updated event');
      const updatedSubscription = event.data.object as Stripe.Subscription;
      console.log('📊 [Webhook] Subscription updated details:', {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.metadata?.planId,
        customerId: updatedSubscription.customer,
        priceId: updatedSubscription.items.data[0]?.price.id,
        quantity: updatedSubscription.items.data[0]?.quantity
      });
      
      // Handle subscription updates (plan changes, etc.)
      if (updatedSubscription.metadata?.planId && updatedSubscription.metadata?.billingPeriod) {
        try {
          const customer = await stripe.customers.retrieve(updatedSubscription.customer as string);
          if (!customer.deleted && 'metadata' in customer && customer.metadata?.userId) {
            const userId = customer.metadata.userId;
            console.log('💾 [Webhook] Updating subscription in database...');
            
            await SubscriptionService.subscribeToPlan(
              new ObjectId(userId),
              updatedSubscription.metadata.planId,
              updatedSubscription.metadata.billingPeriod as 'monthly' | 'yearly',
              updatedSubscription.id,
              updatedSubscription.items.data[0]?.price.id || ''
            );
            
            console.log(`✅ [Webhook] User ${userId} subscription updated to ${updatedSubscription.metadata.planId}`);
            
            // Update organization subscription if user is an organization owner
            try {
              const { getDatabase } = await import('@/lib/database');
              const db = await getDatabase();
              
              // Find organizations where this user is the owner
              const organizations = await db.collection('organizations').find({
                'members.userId': new ObjectId(userId),
                'members.role': 'owner'
              }).toArray();
              
              if (organizations.length > 0) {
                console.log(`🔄 [Webhook] Updating subscription for ${organizations.length} organization(s) where user is owner`);
                
                // Get the updated user subscription
                const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
                if (user && user.subscription) {
                  // Update all organizations where this user is the owner
                  for (const org of organizations) {
                    await db.collection('organizations').updateOne(
                      { _id: org._id },
                      { 
                        $set: { 
                          subscription: user.subscription,
                          updatedAt: new Date()
                        }
                      }
                    );
                    console.log(`✅ [Webhook] Updated organization ${org.name} subscription to ${user.subscription.planId}`);
                  }
                }
              }
            } catch (orgError) {
              console.error('❌ [Webhook] Error updating organization subscriptions:', orgError);
            }
            
            // Clear subscription cache for the user
            try {
              await clearSubscriptionCache(userId);
              console.log('🗑️ [Webhook] Cleared subscription cache for user:', userId);
            } catch (cacheError) {
              console.error('❌ [Webhook] Error clearing subscription cache:', cacheError);
            }
          }
        } catch (error) {
          console.error('❌ [Webhook] Error updating subscription:', error);
        }
      }
      break;

    case 'customer.subscription.deleted':
      console.log('🗑️ [Webhook] Processing customer.subscription.deleted event');
      const deletedSubscription = event.data.object as Stripe.Subscription;
      console.log(' [Webhook] Subscription cancelled:', {
        subscriptionId: deletedSubscription.id,
        customerId: deletedSubscription.customer,
        status: deletedSubscription.status
      });
      
      try {
        // Get customer and user ID
        const customerForDeletion = await stripe.customers.retrieve(deletedSubscription.customer as string);
        
        // Check if customer is not deleted and has metadata
        if (!customerForDeletion.deleted && 'metadata' in customerForDeletion && customerForDeletion.metadata?.userId) {
          const userId = customerForDeletion.metadata.userId;
          console.log('💾 [Webhook] Cancelling user subscription in database...');
          
          await SubscriptionService.cancelSubscription(new ObjectId(userId));
          console.log(`✅ [Webhook] User ${userId} subscription cancelled successfully`);
          
          // Update organization subscription if user is an organization owner
          try {
            const { getDatabase } = await import('@/lib/database');
            const db = await getDatabase();
            
            // Find organizations where this user is the owner
            const organizations = await db.collection('organizations').find({
              'members.userId': new ObjectId(userId),
              'members.role': 'owner'
            }).toArray();
            
            if (organizations.length > 0) {
              console.log(`🔄 [Webhook] Updating subscription for ${organizations.length} organization(s) where user is owner`);
              
              // Get the updated user subscription (should be cancelled)
              const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
              if (user && user.subscription) {
                // Update all organizations where this user is the owner
                for (const org of organizations) {
                  await db.collection('organizations').updateOne(
                    { _id: org._id },
                    { 
                      $set: { 
                        subscription: user.subscription,
                        updatedAt: new Date()
                      }
                    }
                  );
                  console.log(`✅ [Webhook] Updated organization ${org.name} subscription to cancelled status`);
                }
              }
            }
          } catch (orgError) {
            console.error('❌ [Webhook] Error updating organization subscriptions:', orgError);
          }
          
          // Clear subscription cache for the user
          try {
            await clearSubscriptionCache(userId);
            console.log('🗑️ [Webhook] Cleared subscription cache for user:', userId);
          } catch (cacheError) {
            console.error('❌ [Webhook] Error clearing subscription cache:', cacheError);
          }
        } else {
          console.log('❌ [Webhook] Customer not found or deleted for subscription cancellation:', {
            customerId: deletedSubscription.customer,
            deleted: customerForDeletion.deleted,
            hasUserId: !customerForDeletion.deleted && 'metadata' in customerForDeletion ? !!customerForDeletion.metadata?.userId : false
          });
        }
      } catch (error) {
        console.error('❌ [Webhook] Error cancelling subscription:', error);
      }
      break;

    case 'invoice.payment_succeeded':
      console.log('💰 [Webhook] Processing invoice.payment_succeeded event');
      const invoice = event.data.object as Stripe.Invoice;
      console.log(' [Webhook] Payment succeeded for invoice:', {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        customerId: invoice.customer
      });
      // Handle successful payments
      break;

    case 'invoice.payment_failed':
      console.log('💸 [Webhook] Processing invoice.payment_failed event');
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log(' [Webhook] Payment failed for invoice:', {
        invoiceId: failedInvoice.id,
        amount: failedInvoice.amount_due,
        currency: failedInvoice.currency,
        customerId: failedInvoice.customer
      });
      // Handle failed payments
      break;

    default:
      console.log(`❓ [Webhook] Unhandled event type: ${event.type}`);
      break;
  }

  console.log('✅ [Webhook] Event processed successfully')
  return NextResponse.json({ received: true });
}
