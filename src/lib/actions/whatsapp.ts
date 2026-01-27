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
  const startTime = Date.now();
  const logPrefix = '[WhatsApp Action]';
  
  try {
    console.log(`${logPrefix} ========== STARTING WHATSAPP SEND ==========`);
    console.log(`${logPrefix} Input parameters:`, {
      invoiceId,
      clientPhone: clientPhone ? `${clientPhone.substring(0, 4)}****` : 'MISSING',
      pdfBufferLength: pdfBuffer?.length || 0,
      pdfBufferPreview: pdfBuffer?.substring(0, 50) || 'EMPTY'
    });

    // Step 1: Check authentication
    console.log(`${logPrefix} [Step 1] Checking authentication...`);
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.error(`${logPrefix} [Step 1] ❌ Authentication failed - No session or user`);
      return {
        success: false,
        error: 'Unauthorized'
      };
    }
    console.log(`${logPrefix} [Step 1] ✅ Authenticated:`, {
      userId: session.user.id,
      email: session.user.email,
      organizationId: session.user.organizationId || 'none'
    });

    // Step 2: Validate phone number
    console.log(`${logPrefix} [Step 2] Validating phone number...`);
    if (!clientPhone) {
      console.error(`${logPrefix} [Step 2] ❌ Client phone number is missing`);
      return {
        success: false,
        error: 'Client phone number is required for WhatsApp sending'
      };
    }
    console.log(`${logPrefix} [Step 2] ✅ Phone number provided:`, {
      original: clientPhone,
      length: clientPhone.length
    });

    // Step 3: Connect to database
    console.log(`${logPrefix} [Step 3] Connecting to database...`);
    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    console.log(`${logPrefix} [Step 3] ✅ Database connected`);

    // Step 4: Query invoice
    console.log(`${logPrefix} [Step 4] Querying invoice from database...`);
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

    console.log(`${logPrefix} [Step 4] Query:`, JSON.stringify(query, null, 2));
    const invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      console.error(`${logPrefix} [Step 4] ❌ Invoice not found or access denied`, {
        invoiceId,
        query: JSON.stringify(query)
      });
      return {
        success: false,
        error: 'Invoice not found or access denied'
      };
    }
    console.log(`${logPrefix} [Step 4] ✅ Invoice found:`, {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      clientName: invoice.clientDetails?.name || invoice.clientName,
      companyName: invoice.companyDetails?.name || invoice.companyName
    });

    // Step 5: Prepare WhatsApp data
    console.log(`${logPrefix} [Step 5] Preparing WhatsApp invoice data...`);
    const whatsappData: WhatsAppInvoiceData = {
      clientName: invoice.clientDetails?.name || invoice.clientName || 'Client',
      senderName: invoice.companyDetails?.name || invoice.companyName || 'Your Company',
      invoiceNumber: invoice.invoiceNumber || 'N/A',
      pdfBuffer: pdfBuffer,
      clientPhone: clientPhone
    };
    console.log(`${logPrefix} [Step 5] ✅ WhatsApp data prepared:`, {
      clientName: whatsappData.clientName,
      senderName: whatsappData.senderName,
      invoiceNumber: whatsappData.invoiceNumber,
      phone: whatsappData.clientPhone,
      pdfBufferSize: whatsappData.pdfBuffer?.length || 0
    });

    // Step 6: Send via WhatsApp service
    console.log(`${logPrefix} [Step 6] Calling WhatsApp service...`);
    const serviceStartTime = Date.now();
    const result = await WhatsAppService.sendInvoiceWhatsapp(whatsappData);
    const serviceEndTime = Date.now();
    const serviceDuration = serviceEndTime - serviceStartTime;

    console.log(`${logPrefix} [Step 6] WhatsApp service completed in ${serviceDuration}ms`);
    console.log(`${logPrefix} [Step 6] Service result:`, {
      success: result.success,
      messageId: result.messageId,
      error: result.error
    });

    if (result.success) {
      // Step 7: Update invoice status
      console.log(`${logPrefix} [Step 7] Updating invoice status in database...`);
      const updateData = { 
        status: 'sent',
        sentAt: new Date(),
        sentTo: clientPhone,
        sentVia: 'whatsapp',
        whatsappMessageId: result.messageId
      };
      console.log(`${logPrefix} [Step 7] Update data:`, updateData);
      
      const updateResult = await invoicesCollection.updateOne(
        { _id: new ObjectId(invoiceId) },
        { $set: updateData }
      );
      
      console.log(`${logPrefix} [Step 7] ✅ Invoice updated:`, {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged
      });

      const totalDuration = Date.now() - startTime;
      console.log(`${logPrefix} ========== WHATSAPP SEND SUCCESS ==========`);
      console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
      console.log(`${logPrefix} Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId
      };
    } else {
      console.error(`${logPrefix} [Step 6] ❌ WhatsApp service returned failure:`, {
        error: result.error,
        fullResult: result
      });
      const totalDuration = Date.now() - startTime;
      console.log(`${logPrefix} ========== WHATSAPP SEND FAILED ==========`);
      console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
      console.log(`${logPrefix} Error: ${result.error || 'Unknown error'}`);

      return {
        success: false,
        error: result.error || 'Failed to send WhatsApp message'
      };
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`${logPrefix} ========== WHATSAPP SEND EXCEPTION ==========`);
    console.error(`${logPrefix} Total duration before error: ${totalDuration}ms`);
    console.error(`${logPrefix} Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`${logPrefix} Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`${logPrefix} Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    console.error(`${logPrefix} Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
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
