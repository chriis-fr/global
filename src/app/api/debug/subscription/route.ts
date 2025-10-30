import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    console.log('🔍 [DebugAPI] Fetching debug subscription data');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('❌ [DebugAPI] Unauthorized - no session');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [DebugAPI] Session found for user:', session.user.email);

    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });

    if (!user) {
      console.log('❌ [DebugAPI] User not found in database');
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log('✅ [DebugAPI] User found in database:', user.email);

    // Return raw subscription data for debugging
    const debugData = {
      userId: user._id,
      email: user.email,
      subscription: user.subscription,
      usage: user.usage,
      services: user.services,
      // Calculate trial status
      trialStatus: {
        isTrialActive: user.subscription?.status === 'trial' && 
                      user.subscription?.trialEndDate && 
                      new Date() < new Date(user.subscription.trialEndDate),
        trialDaysRemaining: user.subscription?.trialEndDate ? 
          Math.max(0, Math.ceil((new Date(user.subscription.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0
      }
    };

    console.log('✅ [DebugAPI] Debug data prepared:', {
      userId: debugData.userId,
      email: debugData.email,
      hasSubscription: !!debugData.subscription,
      hasUsage: !!debugData.usage,
      hasServices: !!debugData.services
    });

    return NextResponse.json({
      success: true,
      data: debugData
    });
  } catch (error) {
    console.error('❌ [DebugAPI] Error fetching debug subscription data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription data' },
      { status: 500 }
    );
  }
}
