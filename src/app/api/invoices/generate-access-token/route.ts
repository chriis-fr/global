import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    console.log('🔐 [Access Token] Generating secure access token for invoice:', invoiceId);

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const accessTokensCollection = db.collection('invoice_access_tokens');

    // Verify invoice exists and user has access
    const invoice = await invoicesCollection.findOne({
      _id: new ObjectId(invoiceId),
      $or: [
        { issuerId: session.user.id },
        { organizationId: session.user.organizationId }
      ]
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found or access denied' },
        { status: 404 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store token in database
    const tokenData = {
      token,
      invoiceId: new ObjectId(invoiceId),
      recipientEmail: invoice.clientDetails?.email || invoice.clientEmail,
      issuerId: session.user.id,
      organizationId: session.user.organizationId,
      expiresAt,
      createdAt: new Date(),
      used: false,
      usedAt: null,
      usedBy: null
    };

    await accessTokensCollection.insertOne(tokenData);

    // Generate secure access URL
    const accessUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoice-access?token=${token}`;

    console.log('✅ [Access Token] Generated secure access token:', {
      invoiceId,
      recipientEmail: tokenData.recipientEmail,
      expiresAt
    });

    return NextResponse.json({
      success: true,
      data: {
        accessUrl,
        token,
        expiresAt,
        recipientEmail: tokenData.recipientEmail
      }
    });

  } catch (error) {
    console.error('❌ [Access Token] Error generating access token:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to generate access token',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
