import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { completeInvitationAcceptance } from '@/lib/actions/invitation';

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 [Complete Invitation API] Processing invitation completion request');

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ [Complete Invitation API] No authenticated session');
      return NextResponse.json({ 
        success: false, 
        error: 'User must be authenticated to complete invitation' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { token, userId } = body;

    if (!token || !userId) {
      console.log('❌ [Complete Invitation API] Missing required fields');
      return NextResponse.json({ 
        success: false, 
        error: 'Token and userId are required' 
      }, { status: 400 });
    }

    console.log('📋 [Complete Invitation API] Request data:', {
      token: token.substring(0, 8) + '...',
      userId,
      userEmail: session.user.email
    });

    // Complete the invitation acceptance
    const result = await completeInvitationAcceptance(token);

    if (result.success) {
      console.log('✅ [Complete Invitation API] Invitation completed successfully');
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Invitation accepted successfully'
      });
    } else {
      console.log('❌ [Complete Invitation API] Failed to complete invitation:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [Complete Invitation API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete invitation'
    }, { status: 500 });
  }
}
