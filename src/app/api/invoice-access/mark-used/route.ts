import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userId } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token is required' },
        { status: 400 }
      );
    }


    const db = await connectToDatabase();
    const accessTokensCollection = db.collection('invoice_access_tokens');

    // Mark token as used
    const result = await accessTokensCollection.updateOne(
      { token },
      {
        $set: {
          used: true,
          usedAt: new Date(),
          usedBy: userId
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Token not found' },
        { status: 404 }
      );
    }


    return NextResponse.json({
      success: true,
      message: 'Token marked as used'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to mark token as used',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
