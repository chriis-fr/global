import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { connectToDatabase } from '@/lib/database';
import { Invoice } from '@/models';

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
    const { invoiceId, recipientEmail, pdfBuffer } = body;

    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID and recipient email are required' },
        { status: 400 }
      );
    }

    // Connect to database
    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get the invoice
    const invoice = await invoicesCollection.findOne({
      _id: invoiceId,
      organizationId: session.user.organizationId || session.user.id
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Prepare payment methods for display
    const paymentMethods: string[] = [];
    if (invoice.paymentSettings?.fiat?.enabled) {
      paymentMethods.push('Bank Transfer');
    }
    if (invoice.paymentSettings?.crypto?.enabled) {
      paymentMethods.push('Cryptocurrency');
    }

    // Convert PDF buffer if provided
    let pdfAttachment: Buffer | undefined;
    if (pdfBuffer) {
      pdfAttachment = Buffer.from(pdfBuffer, 'base64');
    }

    // Send invoice email
    const result = await sendInvoiceEmail(
      recipientEmail,
      invoice.clientDetails?.contactName || 'Valued Customer',
      invoice.invoiceNumber,
      invoice.totalAmount,
      invoice.currency,
      invoice.dueDate?.toLocaleDateString() || 'N/A',
      invoice.companyDetails?.companyName || 'Your Company',
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoice/${invoice.invoiceNumber}`,
      paymentMethods,
      pdfAttachment
    );

    if (result.success) {
      // Update invoice status to sent
      await invoicesCollection.updateOne(
        { _id: invoiceId },
        { 
          $set: { 
            status: 'sent',
            sentAt: new Date(),
            sentTo: recipientEmail
          }
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Invoice sent successfully',
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send invoice email',
          error: result.error?.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Send Invoice] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to send invoice',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 