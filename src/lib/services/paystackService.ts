import { BILLING_PLANS } from '@/data/billingPlans';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/** Paystack currency – depends on your account (e.g. KES, NGN, GHS). Check Paystack Dashboard. */
const PAYSTACK_CURRENCY = (process.env.PAYSTACK_CURRENCY || 'KES').toUpperCase();
/** Convert USD to local: amount_local = amountUsd * this rate (e.g. 130 for KES) */
const PAYSTACK_USD_TO_LOCAL_RATE = Number(process.env.PAYSTACK_USD_TO_LOCAL_RATE || '132') || 132;

// Paystack Plan Codes mapping (for paid plans only - free plan has null)
// These will be populated from billingPlans.ts or set directly here after creating plans in Paystack
export const PAYSTACK_PLAN_CODES = {
  'receivables-pro': {
    monthly: null as string | null, // Will be set after creating plans in Paystack
    yearly: null as string | null,
  },
  'payables-basic': {
    monthly: null as string | null,
    yearly: null as string | null,
  },
  'payables-pro': {
    monthly: null as string | null,
    yearly: null as string | null,
  },
  'combined-basic': {
    monthly: null as string | null,
    yearly: null as string | null,
  },
  'combined-pro': {
    monthly: null as string | null,
    yearly: null as string | null,
  },
} as const;

export class PaystackService {
  // Get plan code for a plan and billing period
  static getPlanCode(planId: string, billingPeriod: 'monthly' | 'yearly'): string | null {
    console.log('🔍 [PaystackService] Getting plan code:', { planId, billingPeriod });
    
    // Free plan has no Paystack plan code
    if (planId === 'receivables-free' || planId === 'trial-premium') {
      console.log('ℹ️ [PaystackService] Free/Trial plan - no Paystack plan code needed');
      return null;
    }
    
    // Try to get from billing plans first
    const plan = BILLING_PLANS.find((p) => p.planId === planId);
    
    if (plan) {
      const planCode = billingPeriod === 'yearly' 
        ? plan.yearlyPaystackPlanCode 
        : plan.monthlyPaystackPlanCode;
      
      if (planCode) {
        console.log('✅ [PaystackService] Plan code found from billing plans:', planCode);
        return planCode;
      }
    }
    
    // Fallback to static mapping
    const planCodes = PAYSTACK_PLAN_CODES[planId as keyof typeof PAYSTACK_PLAN_CODES];
    if (!planCodes) {
      console.log('❌ [PaystackService] No plan codes found for plan:', planId);
      return null;
    }
    
    const planCode = billingPeriod === 'yearly' ? planCodes.yearly : planCodes.monthly;
    console.log('✅ [PaystackService] Plan code found from fallback:', planCode);
    
    return planCode;
  }

  // Create or get Paystack customer
  static async createOrGetCustomer(email: string, name: string, userId: string): Promise<string | null> {
    console.log('👤 [PaystackService] Creating/getting customer:', { email, name, userId });
    
    // Validate API key
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.trim() === '') {
      console.error('❌ [PaystackService] PAYSTACK_SECRET_KEY is missing or empty');
      throw new Error('Paystack API key is not configured. Please set PAYSTACK_SECRET_KEY environment variable.');
    }
    
    try {
      // Check if customer already exists
      const searchUrl = `${PAYSTACK_BASE_URL}/customer?email=${encodeURIComponent(email)}`;
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      // Check response status and content type
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('❌ [PaystackService] Search customer failed:', {
          status: searchResponse.status,
          statusText: searchResponse.statusText,
          response: errorText.substring(0, 500)
        });
        throw new Error(`Paystack API error: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const contentType = searchResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await searchResponse.text();
        console.error('❌ [PaystackService] Invalid response type:', {
          contentType,
          response: errorText.substring(0, 500)
        });
        throw new Error(`Paystack API returned non-JSON response. Check API key configuration.`);
      }

      const searchData = await searchResponse.json();

      if (searchData.status && searchData.data && searchData.data.length > 0) {
        const customerCode = searchData.data[0].customer_code;
        console.log('✅ [PaystackService] Using existing customer:', customerCode);
        return customerCode;
      }

      // Create new customer
      console.log('🆕 [PaystackService] Creating new customer...');
      const createResponse = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: name.split(' ')[0] || name,
          last_name: name.split(' ').slice(1).join(' ') || '',
          metadata: {
            userId,
          },
        }),
      });

      // Check response status and content type
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('❌ [PaystackService] Create customer failed:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          response: errorText.substring(0, 500)
        });
        throw new Error(`Paystack API error: ${createResponse.status} ${createResponse.statusText}`);
      }

      const contentType2 = createResponse.headers.get('content-type');
      if (!contentType2 || !contentType2.includes('application/json')) {
        const errorText = await createResponse.text();
        console.error('❌ [PaystackService] Invalid response type:', {
          contentType: contentType2,
          response: errorText.substring(0, 500)
        });
        throw new Error(`Paystack API returned non-JSON response. Check API key configuration.`);
      }

      const createData = await createResponse.json();

      if (createData.status && createData.data) {
        const customerCode = createData.data.customer_code;
        console.log('✅ [PaystackService] New customer created:', customerCode);
        return customerCode;
      }

      throw new Error(createData.message || 'Failed to create customer');
    } catch (error) {
      console.error('❌ [PaystackService] Error creating/getting customer:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create or get customer');
    }
  }

  /**
   * Create a one-off subscription plan in Paystack with custom amount (for dynamic pricing).
   * amountUsd: price in USD (from billing plans). Converted to local currency via PAYSTACK_USD_TO_LOCAL_RATE.
   * Currency from PAYSTACK_CURRENCY (e.g. NGN, GHS). Paystack often does not support USD.
   */
  static async createDynamicPlan(
    name: string,
    amountUsd: number,
    interval: 'monthly' | 'yearly',
    metadata?: { planId: string; seats?: number }
  ): Promise<string | null> {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.trim() === '') {
      throw new Error('Paystack API key is not configured.');
    }
    const paystackInterval = interval === 'yearly' ? 'annually' : 'monthly';
    // Amount in smallest unit: NGN = kobo (×100), GHS = pesewas (×100), ZAR = cents (×100)
    const amountInSubunit =
      PAYSTACK_CURRENCY === 'USD'
        ? Math.round(amountUsd * 100)
        : Math.round(amountUsd * PAYSTACK_USD_TO_LOCAL_RATE * 100);
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.substring(0, 255),
          amount: amountInSubunit,
          interval: paystackInterval,
          currency: PAYSTACK_CURRENCY,
          description: metadata ? `Plan: ${metadata.planId}${metadata.seats != null ? `, ${metadata.seats} seats` : ''}` : undefined,
        }),
      });
      const data = await response.json();
      if (!data.status || !data.data?.plan_code) {
        console.error('❌ [PaystackService] Create plan failed:', data);
        throw new Error(data.message || 'Failed to create plan');
      }
      console.log('✅ [PaystackService] Dynamic plan created:', data.data.plan_code, { currency: PAYSTACK_CURRENCY, amountInSubunit });
      return data.data.plan_code;
    } catch (error) {
      console.error('❌ [PaystackService] Error creating dynamic plan:', error);
      throw error;
    }
  }

  // Initialize subscription (returns authorization URL)
  // Uses Transaction Initialize API with plan code - this automatically creates subscription on payment
  static async initializeSubscription(
    customerCode: string,
    planCode: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string,
    options?: { seats?: number }
  ): Promise<string> {
    console.log('💳 [PaystackService] Initializing subscription transaction:', {
      customerCode,
      planCode,
      planId,
      billingPeriod,
      successUrl,
      cancelUrl
    });
    
    try {
      // Get customer email from customer code to use in transaction
      const customerResponse = await fetch(`${PAYSTACK_BASE_URL}/customer/${customerCode}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const customerData = await customerResponse.json();
      const customerEmail = customerData.data?.email;

      if (!customerEmail) {
        throw new Error('Could not retrieve customer email');
      }

      // Verify the plan exists and get its details from Paystack
      const planResponse = await fetch(`${PAYSTACK_BASE_URL}/plan/${planCode}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const planData = await planResponse.json();
      console.log('📋 [PaystackService] Plan details from Paystack:', JSON.stringify(planData, null, 2));

      if (!planData.status || !planData.data) {
        throw new Error(`Plan ${planCode} not found in Paystack`);
      }

      const paystackPlan = planData.data;
      const planAmount = paystackPlan.amount; // Amount is already in kobo/cents from Paystack

      console.log('💰 [PaystackService] Plan amount from Paystack:', {
        planCode,
        planAmount,
        currency: paystackPlan.currency,
        interval: paystackPlan.interval
      });

      // Initialize transaction with plan code - this creates subscription automatically on payment
      // Paystack REQUIRES amount to be sent even when using a plan - it must match the plan amount exactly
      const requestBody: {
        email: string;
        amount: number;
        plan: string;
        callback_url: string;
        metadata: {
          planId: string;
          billingPeriod: string;
          customerCode: string;
          seats?: number;
        };
      } = {
        email: customerEmail,
        amount: planAmount, // Amount in kobo/cents - MUST match plan amount exactly (58000 = 580.00 in currency)
        plan: planCode, // This makes it a subscription transaction
        callback_url: successUrl.replace('{REFERENCE}', ''), // Paystack will append reference
        metadata: {
          planId,
          billingPeriod,
          customerCode,
          ...(options?.seats ? { seats: options.seats } : {})
        },
      };

      console.log('💰 [PaystackService] Transaction request details:', {
        amount: planAmount,
        currency: paystackPlan.currency,
        planCode,
        note: 'Amount must match plan amount exactly (already in kobo/cents)'
      });

      console.log('📤 [PaystackService] Transaction initialize request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      // Log the full response for debugging
      console.log('📥 [PaystackService] Paystack Transaction Initialize response:', JSON.stringify(data, null, 2));

      if (!data.status) {
        // Paystack returned an error
        const errorMessage = data.message || 'Unknown Paystack error';
        console.error('❌ [PaystackService] Paystack API error:', errorMessage);
        throw new Error(`Paystack error: ${errorMessage}`);
      }

      if (data.data && data.data.authorization_url) {
        const authUrl = data.data.authorization_url;
        console.log('✅ [PaystackService] Authorization URL created:', authUrl);
        console.log('📋 [PaystackService] Transaction reference:', data.data.reference);
        return authUrl;
      }

      throw new Error('Paystack returned success but no authorization URL');
    } catch (error) {
      console.error('❌ [PaystackService] Error initializing subscription:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to initialize subscription');
    }
  }

  // Get subscription details
  static async getSubscription(subscriptionCode: string): Promise<Record<string, unknown> | null> {
    console.log('📋 [PaystackService] Getting subscription:', subscriptionCode);
    
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/subscription/${subscriptionCode}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.status && data.data) {
        console.log('✅ [PaystackService] Subscription retrieved:', data.data.subscription_code);
        return data.data;
      }

      return null;
    } catch (error) {
      console.error('❌ [PaystackService] Error fetching subscription:', error);
      return null;
    }
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionCode: string): Promise<boolean> {
    console.log('🚫 [PaystackService] Cancelling subscription:', subscriptionCode);
    
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/subscription/disable`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: subscriptionCode,
          token: subscriptionCode, // Paystack uses token for cancellation
        }),
      });

      const data = await response.json();

      if (data.status) {
        console.log('✅ [PaystackService] Subscription cancelled successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [PaystackService] Error canceling subscription:', error);
      return false;
    }
  }

  // Verify transaction (for webhook verification)
  static async verifyTransaction(reference: string): Promise<Record<string, unknown> | null> {
    console.log('🔍 [PaystackService] Verifying transaction:', reference);
    
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.status && data.data) {
        console.log('✅ [PaystackService] Transaction verified:', data.data.reference);
        return data.data;
      }

      return null;
    } catch (error) {
      console.error('❌ [PaystackService] Error verifying transaction:', error);
      return null;
    }
  }
}
