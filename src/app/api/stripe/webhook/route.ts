import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { SubscriptionService } from '@/lib/services/subscriptionService';
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
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(" [Webhook] Checkout session completed:", {
        sessionId: session.id,
        mode: session.mode,
        customerId: session.customer,
        subscriptionId: session.subscription
      });
      
      if (session.mode === 'subscription' && session.subscription) {
        console.log('🔄 [Webhook] Processing subscription checkout...')
        
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const customerId = session.customer as string;
        
        console.log(' [Webhook] Subscription details:', {
          subscriptionId: subscription.id,
          status: subscription.status,
          planId: subscription.metadata?.planId,
          billingPeriod: subscription.metadata?.billingPeriod
        });
        
        // Get user by customer ID
        const customer = await stripe.customers.retrieve(customerId);
        
        // Check if customer is not deleted and has metadata
        if (!customer.deleted && customer.metadata?.userId) {
          const userId = customer.metadata.userId;
          console.log('👤 [Webhook] Customer found:', { customerId, userId });
          
          if (subscription.metadata?.planId && subscription.metadata?.billingPeriod) {
            console.log('💾 [Webhook] Updating user subscription in database...')
            
            await SubscriptionService.subscribeToPlan(
              new ObjectId(userId),
              subscription.metadata.planId,
              subscription.metadata.billingPeriod as 'monthly' | 'yearly',
              subscription.id,
              subscription.items.data[0]?.price.id
            );
            
            console.log(`✅ [Webhook] User ${userId} subscribed to ${subscription.metadata.planId}`);
          } else {
            console.log('❌ [Webhook] Missing subscription metadata:', subscription.metadata);
          }
        } else {
          console.log('❌ [Webhook] Customer not found or deleted:', customerId);
        }
      }
      break;

    case 'customer.subscription.updated':
      const updatedSubscription = event.data.object as Stripe.Subscription;
      console.log("🔄 [Webhook] Subscription updated:", {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.metadata?.planId
      });
      // Handle subscription updates (plan changes, etc.)
      break;

    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      console.log(" [Webhook] Subscription cancelled:", {
        subscriptionId: deletedSubscription.id,
        customerId: deletedSubscription.customer
      });
      
      // Get customer and user ID
      const customerForDeletion = await stripe.customers.retrieve(deletedSubscription.customer as string);
      
      // Check if customer is not deleted and has metadata
      if (!customerForDeletion.deleted && customerForDeletion.metadata?.userId) {
        const userId = customerForDeletion.metadata.userId;
        console.log('💾 [Webhook] Cancelling user subscription in database...')
        
        await SubscriptionService.cancelSubscription(new ObjectId(userId));
        console.log(`✅ [Webhook] User ${userId} subscription cancelled`);
      } else {
        console.log('❌ [Webhook] Customer not found or deleted for subscription cancellation:', deletedSubscription.customer);
      }
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      console.log(" [Webhook] Payment succeeded for invoice:", {
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency
      });
      // Handle successful payments
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log(" [Webhook] Payment failed for invoice:", {
        invoiceId: failedInvoice.id,
        amount: failedInvoice.amount_due,
        currency: failedInvoice.currency
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