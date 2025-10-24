import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params;
    
    if (!invoiceNumber) {
      return NextResponse.json(
        { success: false, message: 'Invoice number is required' },
        { status: 400 }
      );
    }


    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Find invoice by invoice number
    const invoice = await invoicesCollection.findOne({
      invoiceNumber: invoiceNumber
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get recipient email from invoice
    const recipientEmail = invoice.clientDetails?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, message: 'Invalid invoice - no recipient email' },
        { status: 400 }
      );
    }


    // Check if recipient email is registered
    let isRegistered = false;
    let requiresAccountCreation = false;

    try {
      const existingUser = await UserService.getUserByEmail(recipientEmail);
      isRegistered = !!existingUser;
      requiresAccountCreation = !existingUser;
    } catch (error) {
      // If there's an error checking, assume user needs to be created
      requiresAccountCreation = true;
    }

    // Return invoice data with registration status
    const responseData = {
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
      recipientEmail,
      isRegistered,
      requiresAccountCreation
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process invoice link',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
