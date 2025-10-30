'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WhatsAppService, type WhatsAppInvoiceData } from '@/lib/services/whatsappService';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

interface SendInvoiceWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendInvoiceWhatsApp(
  invoiceId: string,
  clientPhone: string,
  pdfBuffer: string
): Promise<SendInvoiceWhatsAppResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    if (!clientPhone) {
      return {
        success: false,
        error: 'Client phone number is required for WhatsApp sending'
      };
    }

    // Connect to database
    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get the invoice - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { 
          _id: new ObjectId(invoiceId), 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      return {
        success: false,
        error: 'Invoice not found or access denied'
      };
    }

    // Prepare WhatsApp invoice data with only the 3 required variables
    const whatsappData: WhatsAppInvoiceData = {
      clientName: invoice.clientDetails?.name || invoice.clientName || 'Client',
      senderName: invoice.companyDetails?.name || invoice.companyName || 'Your Company',
      invoiceNumber: invoice.invoiceNumber || 'N/A',
      pdfBuffer: pdfBuffer,
      clientPhone: clientPhone
    };

    // Send via WhatsApp
    console.log('🚀 [WhatsApp Action] Starting WhatsApp send...', {
      invoiceId,
      clientName: whatsappData.clientName,
      senderName: whatsappData.senderName,
      invoiceNumber: whatsappData.invoiceNumber,
      phone: whatsappData.clientPhone
    });

    const result = await WhatsAppService.sendInvoiceWhatsapp(whatsappData);

    console.log('📥 [WhatsApp Action] WhatsApp service result:', result);

    if (result.success) {
      // Update invoice status to sent via WhatsApp
      await invoicesCollection.updateOne(
        { _id: new ObjectId(invoiceId) },
        { 
          $set: { 
            status: 'sent',
            sentAt: new Date(),
            sentTo: clientPhone,
            sentVia: 'whatsapp',
            whatsappMessageId: result.messageId
          }
        }
      );

      return {
        success: true,
        messageId: result.messageId
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to send WhatsApp message'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Send a simple WhatsApp message (fallback)
 */
export async function sendSimpleWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<SendInvoiceWhatsAppResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    const result = await WhatsAppService.sendSimpleMessage(phoneNumber, message);

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
