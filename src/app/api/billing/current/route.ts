import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SubscriptionService } from '@/lib/services/subscriptionService';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    console.log('🔄 [BillingCurrent] Starting subscription fetch');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('❌ [BillingCurrent] Unauthorized - no session');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [BillingCurrent] Session found for user:', session.user.email);

    console.log('🔄 [BillingCurrent] Fetching subscription from service...');
    const subscription = await SubscriptionService.getUserSubscription(new ObjectId(session.user.id));
    console.log('✅ [BillingCurrent] Subscription fetched successfully:', {
      planId: subscription.plan?.planId,
      status: subscription.status,
      canCreateInvoice: subscription.canCreateInvoice,
      canAccessPayables: subscription.canAccessPayables
    });

    return NextResponse.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('❌ [BillingCurrent] Error fetching subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

