import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('🔍 [Test-Session] Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userId: session?.user?.id,
      userName: session?.user?.name,
      userServices: session?.user?.services
    });

    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        message: 'No session or user email found',
        session: session ? 'Session exists but no user email' : 'No session'
      }, { status: 401 });
    }

    // Try to get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    
    console.log('🔍 [Test-Session] Database user:', {
      found: !!user,
      userId: user?._id,
      userEmail: user?.email,
      userName: user?.name,
      userServices: user?.services
    });

    return NextResponse.json({
      success: true,
      session: {
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        userId: session?.user?.id,
        userName: session?.user?.name,
        userServices: session?.user?.services
      },
      database: {
        userFound: !!user,
        userId: user?._id,
        userEmail: user?.email,
        userName: user?.name,
        userServices: user?.services
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Test-Session] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error testing session',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 