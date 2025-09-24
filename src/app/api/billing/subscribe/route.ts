import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StripeService } from '@/lib/services/stripeService';
import { BILLING_PLANS } from '@/data/billingPlans';

export async function POST(request: NextRequest) {
  try {
    console.log(' [BillingSubscribe] Starting subscription process');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('❌ [BillingSubscribe] Unauthorized - no session');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, billingPeriod } = await request.json();
    console.log('📋 [BillingSubscribe] Request data:', { 
      userId: session.user.id, 
      email: session.user.email,
      planId, 
      billingPeriod 
    });

    if (!planId || !billingPeriod) {
      console.log('❌ [BillingSubscribe] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Plan ID and billing period are required' },
        { status: 400 }
      );
    }

    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      console.log('❌ [BillingSubscribe] Invalid plan ID:', planId);
      return NextResponse.json(
        { success: false, error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    console.log('✅ [BillingSubscribe] Plan found:', { planId, planName: plan.name });

    // Get price ID from the plan
    const priceId = billingPeriod === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;
    if (!priceId) {
      console.log('❌ [BillingSubscribe] Price ID not found for plan:', { planId, billingPeriod });
      return NextResponse.json(
        { success: false, error: 'Price ID not found for this plan' },
        { status: 400 }
      );
    }

    console.log('✅ [BillingSubscribe] Price ID found:', priceId);

    // Create or get Stripe customer
    console.log('🔄 [BillingSubscribe] Creating/getting Stripe customer...');
    const customerId = await StripeService.createOrGetCustomer(
      session.user.email,
      session.user.name,
      session.user.id
    );
    console.log('✅ [BillingSubscribe] Stripe customer ID:', customerId);

    // Create checkout session
    console.log('🔄 [BillingSubscribe] Creating Stripe checkout session...');
    const checkoutUrl = await StripeService.createCheckoutSession(
      customerId,
      priceId,
      planId,
      billingPeriod,
      `${process.env.NEXTAUTH_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${process.env.NEXTAUTH_URL}/pricing?cancelled=true`
    );
    console.log('✅ [BillingSubscribe] Checkout session created:', checkoutUrl);

    console.log('✅ [BillingSubscribe] Subscription process completed successfully');
    return NextResponse.json({
      success: true,
      checkoutUrl
    });
  } catch (error) {
    console.error('❌ [BillingSubscribe] Error in subscription process:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
