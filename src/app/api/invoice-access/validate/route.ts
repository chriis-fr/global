import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token is required' },
        { status: 400 }
      );
    }


    const db = await connectToDatabase();
    const accessTokensCollection = db.collection('invoice_access_tokens');
    const invoicesCollection = db.collection('invoices');

    // Find and validate token
    const tokenData = await accessTokensCollection.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenData) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Get invoice details
    const invoice = await invoicesCollection.findOne({
      _id: tokenData.invoiceId
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if recipient email is registered
    let isRegistered = false;
    let user = null;

    try {
      user = await UserService.getUserByEmail(tokenData.recipientEmail);
      isRegistered = !!user;
    } catch (error) {
    }

      invoiceId: invoice._id,
      recipientEmail: tokenData.recipientEmail,
      isRegistered
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceName: invoice.invoiceName,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          companyDetails: {
            name: invoice.companyDetails?.name || invoice.companyName,
            email: invoice.companyDetails?.email || invoice.companyEmail,
            phone: invoice.companyDetails?.phone || invoice.companyPhone,
            address: invoice.companyDetails?.address || invoice.companyAddress
          },
          clientDetails: {
            name: invoice.clientDetails?.name || invoice.clientName,
            email: invoice.clientDetails?.email || invoice.clientEmail,
            phone: invoice.clientDetails?.phone || invoice.clientPhone,
            companyName: invoice.clientDetails?.companyName || invoice.clientCompany,
            address: invoice.clientDetails?.address || invoice.clientAddress
          },
          currency: invoice.currency,
          paymentMethod: invoice.paymentMethod,
          paymentNetwork: invoice.paymentNetwork,
          paymentAddress: invoice.paymentAddress,
          items: invoice.items || [],
          subtotal: invoice.subtotal || 0,
          totalTax: invoice.totalTax || 0,
          totalAmount: invoice.totalAmount || 0,
          memo: invoice.memo,
          status: invoice.status,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt
        },
        recipientEmail: tokenData.recipientEmail,
        isRegistered,
        requiresSignup: !isRegistered
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to validate token',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
