import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

// Stripe Product IDs mapping
export const STRIPE_PRODUCTS = {
  'receivables-free': 'prod_T6r1yjcct00js4',
  'receivables-pro': 'prod_T6iXtK73PnT58u',
  'payables-basic': 'prod_T6iaIHuMlk0ucf',
  'payables-pro': 'prod_T6ickesVybl87k',
  'combined-basic': 'prod_T6inEYX6geavuU',
  'combined-pro': 'prod_T6ip1LdL76B6Id',
} as const;

// Stripe Price IDs mapping
export const STRIPE_PRICE_IDS = {
  'receivables-free': {
    monthly: 'price_1SAdJ5AGa3OwCLpllBuA0tiF',
    yearly: 'price_1SAdJ5AGa3OwCLpllBuA0tiF',
  },
  'receivables-pro': {
    monthly: 'price_1SAV6sAGa3OwCLplFnkyUqrm',
    yearly: 'price_1SAV6rAGa3OwCLplontxFK5u',
  },
  'payables-basic': {
    monthly: 'price_1SAV9MAGa3OwCLplIUXMfXdp',
    yearly: 'price_1SAV9LAGa3OwCLplsqx52qBE',
  },
  'payables-pro': {
    monthly: 'price_1SAVArAGa3OwCLplL6B9kssy',
    yearly: 'price_1SAVAqAGa3OwCLplNJMxJyJp',
  },
  'combined-basic': {
    monthly: 'price_1SAVMIAGa3OwCLplHGrhqv40',
    yearly: 'price_1SAVMIAGa3OwCLplJQvi7jk1',
  },
  'combined-pro': {
    monthly: 'price_1SAVOJAGa3OwCLplq1QNRWcX',
    yearly: 'price_1SAVOJAGa3OwCLpltlUKBtbk',
  },
} as const;

export class StripeService {
  // Get price ID for a plan and billing period
  static getPriceId(planId: string, billingPeriod: 'monthly' | 'yearly'): string | null {
    console.log('🔍 [StripeService] Getting price ID:', { planId, billingPeriod })
    
    const planPrices = STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS];
    if (!planPrices) {
      console.log('❌ [StripeService] No price IDs found for plan:', planId)
      return null;
    }
    
    const priceId = billingPeriod === 'yearly' ? planPrices.yearly : planPrices.monthly;
    console.log('✅ [StripeService] Price ID found:', priceId)
    
    return priceId;
  }

  // Create or get Stripe customer
  static async createOrGetCustomer(email: string, name: string, userId: string): Promise<string> {
    console.log('👤 [StripeService] Creating/getting customer:', { email, name, userId })
    
    try {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      console.log('🔍 [StripeService] Existing customers found:', existingCustomers.data.length)

      if (existingCustomers.data.length > 0) {
        const customerId = existingCustomers.data[0].id;
        console.log('✅ [StripeService] Using existing customer:', customerId)
        return customerId;
      }

      // Create new customer
      console.log('🆕 [StripeService] Creating new customer...')
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      console.log('✅ [StripeService] New customer created:', customer.id)
      return customer.id;
    } catch (error) {
      console.error('❌ [StripeService] Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create checkout session
  static async createCheckoutSession(
    customerId: string,
    priceId: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    console.log('💳 [StripeService] Creating checkout session:', {
      customerId,
      priceId,
      planId,
      billingPeriod,
      successUrl,
      cancelUrl
    })
    
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          planId,
          billingPeriod,
        },
        subscription_data: {
          metadata: {
            planId,
            billingPeriod,
          },
        },
      });

      console.log('✅ [StripeService] Checkout session created:', session.id)
      console.log('🔗 [StripeService] Checkout URL:', session.url)
      
      return session.url || '';
    } catch (error) {
      console.error('❌ [StripeService] Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Get subscription details
  static async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    console.log('📋 [StripeService] Getting subscription:', subscriptionId)
    
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log('✅ [StripeService] Subscription retrieved:', subscription.id)
      return subscription;
    } catch (error) {
      console.error('❌ [StripeService] Error fetching subscription:', error);
      return null;
    }
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId: string): Promise<boolean> {
    console.log('🚫 [StripeService] Cancelling subscription:', subscriptionId)
    
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      console.log('✅ [StripeService] Subscription cancelled successfully')
      return true;
    } catch (error) {
      console.error('❌ [StripeService] Error canceling subscription:', error);
      return false;
    }
  }
}
