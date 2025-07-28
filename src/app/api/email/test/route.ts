import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTestEmail, testEmailConnection } from '@/lib/services/emailService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email address is required' },
        { status: 400 }
      );
    }

    // Test email connection first
    const connectionTest = await testEmailConnection();
    if (!connectionTest) {
      return NextResponse.json(
        { success: false, message: 'Email service is not configured properly' },
        { status: 500 }
      );
    }

    // Send test email
    const result = await sendTestEmail(email);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send test email',
          error: result.error?.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Email Test] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to test email service',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Test email connection
    const connectionTest = await testEmailConnection();
    
    return NextResponse.json({
      success: true,
      message: connectionTest ? 'Email service is ready' : 'Email service is not configured',
      ready: connectionTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Email Test] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to test email connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 