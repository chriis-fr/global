import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendInvoiceNotification } from '@/lib/services/emailService';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

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
    const { invoiceId, recipientEmail, pdfBuffer, attachedFiles } = body;

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
      ? { _id: new ObjectId(invoiceId), organizationId: session.user.organizationId }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

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

    // Convert attached files to buffers
    const additionalAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const file of attachedFiles) {
        if (file.filename && file.content && file.contentType) {
          additionalAttachments.push({
            filename: file.filename,
            content: Buffer.from(file.content, 'base64'),
            contentType: file.contentType
          });
        }
      }
    }

    // Determine the greeting name - always use the client name
    const fullName = [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ');
    
    console.log('🔍 [Send Invoice] Client details:', {
      companyName: invoice.clientDetails?.companyName,
      firstName: invoice.clientDetails?.firstName,
      lastName: invoice.clientDetails?.lastName,
      fullName: fullName,
      hasCompany: !!invoice.clientDetails?.companyName
    });
    
    const greetingName = invoice.clientDetails?.companyName 
      ? (fullName || invoice.clientDetails?.companyName) // If company exists, use individual name or company name
      : (fullName || 'Client'); // If no company, use individual name or 'Client'
    
    console.log('🔍 [Send Invoice] Greeting name determined:', greetingName);

    // Send invoice email
    const result = await sendInvoiceNotification(
      recipientEmail,
      greetingName, // Proper greeting name
      invoice.invoiceNumber,
      invoice.totalAmount,
      invoice.currency,
      invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
      invoice.companyDetails?.name || (isOrganization ? 'Your Company' : ''), // Company name (empty for individuals)
      invoice.clientDetails?.companyName || fullName || 'Client', // Recipient name/company
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoice/${invoice.invoiceNumber}`,
      paymentMethods,
      pdfAttachment,
      additionalAttachments
    );

    if (result.success) {
      // Update invoice status to sent
      await invoicesCollection.updateOne(
        { _id: new ObjectId(invoiceId) },
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