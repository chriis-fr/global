import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envInfo = {
      MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
      DB_NAME: process.env.DB_NAME || 'request_finance',
      NODE_ENV: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      isAtlas: process.env.MONGODB_URI?.includes('mongodb+srv://') || false,
      isLocal: process.env.MONGODB_URI?.includes('mongodb://localhost') || false,
    };

    console.log('🔍 [Env Test] Environment variables:', envInfo);

    return NextResponse.json({
      success: true,
      message: 'Environment check completed',
      data: envInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Env Test] Environment check failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Environment check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 