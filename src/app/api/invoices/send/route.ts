import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendInvoiceNotification } from '@/lib/services/emailService';
import { connectToDatabase } from '@/lib/database';

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
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query = isOrganization 
      ? { _id: invoiceId, organizationId: session.user.organizationId }
      : { _id: invoiceId, userId: session.user.email };

    const invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      console.log('❌ [Send Invoice] Invoice not found:', {
        invoiceId,
        ownerType: isOrganization ? 'organization' : 'individual',
        ownerId: isOrganization ? session.user.organizationId : session.user.email,
        userEmail: session.user.email
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('✅ [Send Invoice] Invoice found for sending:', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      recipientEmail,
      total: invoice.totalAmount,
      ownerType: isOrganization ? 'organization' : 'individual',
      ownerId: isOrganization ? session.user.organizationId : session.user.email
    });

    // Prepare payment methods for display
    const paymentMethods: string[] = [];
    if (invoice.paymentSettings?.method === 'fiat') {
      paymentMethods.push('Bank Transfer');
    }
    if (invoice.paymentSettings?.method === 'crypto') {
      paymentMethods.push('Cryptocurrency');
    }

    // Convert PDF buffer if provided
    let pdfAttachment: Buffer | undefined;
    if (pdfBuffer) {
      pdfAttachment = Buffer.from(pdfBuffer, 'base64');
    }

    // Send invoice email
    const result = await sendInvoiceNotification(
      recipientEmail,
      invoice.clientDetails?.companyName || 'Valued Customer',
      invoice.invoiceNumber,
      invoice.totalAmount,
      invoice.currency,
      invoice.dueDate?.toLocaleDateString() || 'N/A',
      invoice.companyDetails?.name || 'Your Company',
      session.user.name || 'Invoice Sender',
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
      { success: false, message: 'Failed to send invoice' },
      { status: 500 }
    );
  }
} 