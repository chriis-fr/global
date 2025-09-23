import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SubscriptionService } from '@/lib/services/subscriptionService';
import { ObjectId } from 'mongodb';

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

    await SubscriptionService.subscribeToPlan(
      new ObjectId(session.user.id),
      planId,
      billingPeriod
    );

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to plan'
    });
  } catch (error) {
    console.error('Error subscribing to plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to subscribe to plan' },
      { status: 500 }
    );
  }
}
