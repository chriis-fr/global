import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

/**
 * Confirm payment for an invoice by token.
 * Used by: payment gateway callbacks, "I've paid" flows, or on-chain payment listeners.
 * No auth required; token is the authorization.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, paymentMethod, paymentReference, paidAt } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const accessTokensCollection = db.collection('invoice_access_tokens');
    const invoicesCollection = db.collection('invoices');

    const tokenData = await accessTokensCollection.findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenData) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    const invoiceId = tokenData.invoiceId;
    const invoice = await invoicesCollection.findOne({ _id: invoiceId });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Invoice already marked as paid',
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        status: 'paid'
      });
    }

    const paidDate = paidAt ? new Date(paidAt) : new Date();
    await invoicesCollection.updateOne(
      { _id: invoiceId },
      {
        $set: {
          status: 'paid',
          paidAt: paidDate,
          updatedAt: new Date(),
          ...(paymentMethod && { paymentMethodUsed: paymentMethod }),
          ...(paymentReference && { paymentReference })
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      status: 'paid',
      paidAt: paidDate.toISOString()
    });
  } catch (error) {
    console.error('❌ [Confirm Payment] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}
