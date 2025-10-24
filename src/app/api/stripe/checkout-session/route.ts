import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StripeService } from '@/lib/services/stripeService';
import { BILLING_PLANS } from '@/data/billingPlans';

export async function POST(request: NextRequest) {
  try {
    // Block subscriptions in production environment
    if (process.env.NODE_ENV === 'production') {
      console.log('🚫 [CheckoutSession] Subscriptions disabled in production environment');
      return NextResponse.json(
        { success: false, error: 'Subscriptions are currently disabled. All features are available for free during the trial period.' },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, billingPeriod } = await request.json();

    console.log('🔍 [CheckoutSession] Request received:', { planId, billingPeriod });

    if (!planId || !billingPeriod) {
      return NextResponse.json(
        { success: false, error: 'Plan ID and billing period are required' },
        { status: 400 }
      );
    }

    // Find the plan
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get price ID from the plan
    const priceId = billingPeriod === 'yearly' ? plan.yearlyPriceId : plan.monthlyPriceId;
    
    console.log('🔍 [CheckoutSession] Price selection:', {
      billingPeriod,
      monthlyPriceId: plan.monthlyPriceId,
      yearlyPriceId: plan.yearlyPriceId,
      selectedPriceId: priceId,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice
    });

    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'Price ID not found for this plan' },
        { status: 400 }
      );
    }

    // Create or get Stripe customer
    const customerId = await StripeService.createOrGetCustomer(
      session.user.email,
      session.user.name,
      session.user.id
    );

    // Create checkout session
    const checkoutUrl = await StripeService.createCheckoutSession(
      customerId,
      priceId,
      planId,
      billingPeriod,
      `${process.env.NEXTAUTH_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${process.env.NEXTAUTH_URL}/pricing?cancelled=true`
    );

    return NextResponse.json({
      success: true,
      checkoutUrl
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
