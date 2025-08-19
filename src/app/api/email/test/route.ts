import { NextRequest, NextResponse } from 'next/server';
import { testEmailConnection, sendTestEmail } from '@/lib/services/emailService';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [Email Test] Starting email service test...');
    
    // Test SMTP connection
    const connectionTest = await testEmailConnection();
    
    if (!connectionTest) {
      return NextResponse.json(
        { success: false, message: 'SMTP connection failed' },
        { status: 500 }
      );
    }
    
    // Get test email from query params
    const { searchParams } = new URL(request.url);
    const testEmail = searchParams.get('email');
    
    if (!testEmail) {
      return NextResponse.json(
        { success: false, message: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    console.log('🧪 [Email Test] Sending test email to:', testEmail);
    
    // Send test email with timeout
    const emailResult = await Promise.race([
      sendTestEmail(testEmail),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Email test timeout')), 60000) // 1 minute timeout
      )
    ]);
    
    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Email test completed successfully',
        messageId: emailResult.messageId
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to send test email', error: emailResult.error?.message },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ [Email Test] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Email test failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
