import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initializePaystackSubscription } from '@/lib/actions/paystack';

/**
 * Billing subscribe endpoint - now uses Paystack instead of Stripe
 * This endpoint is kept for backward compatibility but redirects to Paystack
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [BillingSubscribe] Starting subscription process (Paystack)');
    
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

    // Use Paystack subscription initialization
    console.log('🔄 [BillingSubscribe] Using Paystack for subscription...');
    const result = await initializePaystackSubscription(planId, billingPeriod);

    if (!result.success) {
      console.log('❌ [BillingSubscribe] Paystack subscription failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to initialize subscription' },
        { status: 500 }
      );
    }

    // For free plans, no redirect needed
    if (planId === 'receivables-free') {
      return NextResponse.json({
        success: true,
        message: 'Free plan activated'
      });
    }

    // For paid plans, return authorization URL
    return NextResponse.json({
      success: true,
      checkoutUrl: result.authorizationUrl
    });
  } catch (error) {
    console.error('❌ [BillingSubscribe] Error in subscription process:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
