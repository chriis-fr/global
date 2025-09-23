import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StripeService } from '@/lib/services/stripeService';
import { BILLING_PLANS } from '@/data/billingPlans';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, billingPeriod } = await request.json();

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
