import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase } from '@/lib/database';

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
const WHATSAPP_WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || '';

/**
 * WhatsApp Webhook Endpoint
 * 
 * This endpoint receives webhooks from Meta's WhatsApp Business API
 * to track message status updates (sent, delivered, read, failed, etc.)
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Add environment variables to .env.local:
 *    WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token_here
 *    WHATSAPP_WEBHOOK_SECRET=your_webhook_secret_here
 * 
 * 2. Configure webhook in Meta Business Dashboard:
 *    - Go to: Meta Business Suite > WhatsApp > Configuration > Webhooks
 *    - Click "Edit" on your webhook subscription
 *    - Set Callback URL: https://yourdomain.com/api/webhooks/whatsapp
 *    - Set Verify Token: (same as WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 *    - Subscribe to "messages" field
 *    - Click "Verify and Save"
 * 
 * 3. Meta will send a GET request to verify the webhook:
 *    GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=TOKEN
 *    - We verify the token matches WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *    - We return the challenge to complete verification
 * 
 * 4. Once verified, Meta will send POST requests with status updates:
 *    POST /api/webhooks/whatsapp
 *    - Headers: X-Hub-Signature-256 (SHA256 HMAC signature)
 *    - Body: JSON payload with message status updates
 *    - We verify signature using WHATSAPP_WEBHOOK_SECRET
 *    - We update invoice status in database based on message status
 * 
 * WEBHOOK PAYLOAD STRUCTURE:
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "id": "WABA_ID",
 *     "changes": [{
 *       "value": {
 *         "messaging_product": "whatsapp",
 *         "metadata": { ... },
 *         "statuses": [{
 *           "id": "wamid.XXX",
 *           "status": "sent|delivered|read|failed",
 *           "timestamp": "1234567890",
 *           "recipient_id": "1234567890"
 *         }]
 *       },
 *       "field": "messages"
 *     }]
 *   }]
 * }
 * 
 * STATUS FLOW:
 * - accepted → sent → delivered → read
 * - If failed, status will be "failed" with error details
 * 
 * DATABASE UPDATES:
 * - Updates invoice.whatsappStatus with current status
 * - Updates invoice.status based on message status
 * - Sets timestamps: deliveredAt, readAt, failedAt
 * - Stores failure reason if message failed
 */

/**
 * Verify webhook signature from Meta
 * Meta uses X-Hub-Signature-256 header with SHA256 HMAC
 */
function verifyWhatsAppSignature(body: string, signature: string): boolean {
  if (!WHATSAPP_WEBHOOK_SECRET) {
    console.log('⚠️ [WhatsAppWebhook] No webhook secret configured, skipping verification');
    console.log('💡 [WhatsAppWebhook] Set WHATSAPP_WEBHOOK_SECRET in your .env.local file');
    // In development, allow if secret is not set
    return process.env.NODE_ENV === 'development';
  }

  // Remove 'sha256=' prefix if present
  const signatureHash = signature.replace('sha256=', '');
  
  // Calculate expected signature
  const expectedHash = crypto
    .createHmac('sha256', WHATSAPP_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signatureHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );

  if (!isValid) {
    console.log('❌ [WhatsAppWebhook] Signature mismatch:', {
      expectedPrefix: expectedHash.substring(0, 20) + '...',
      receivedPrefix: signatureHash.substring(0, 20) + '...',
      note: 'Make sure WHATSAPP_WEBHOOK_SECRET matches the one in Meta Dashboard'
    });
  } else {
    console.log('✅ [WhatsAppWebhook] Signature verified successfully');
  }

  return isValid;
}

/**
 * Handle GET request for webhook verification
 * Meta sends: ?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=TOKEN
 */
export async function GET(request: NextRequest) {
  const logPrefix = '[WhatsAppWebhook]';
  console.log(`${logPrefix} ========== WEBHOOK VERIFICATION REQUEST ==========`);

  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  console.log(`${logPrefix} Verification parameters:`, {
    mode,
    hasChallenge: !!challenge,
    challengeLength: challenge?.length || 0,
    hasVerifyToken: !!verifyToken,
    expectedToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN ? '***' : 'NOT SET'
  });

  // Verify the mode and token
  if (mode === 'subscribe' && verifyToken === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log(`${logPrefix} ✅ Webhook verified successfully!`);
    console.log(`${logPrefix} Returning challenge: ${challenge}`);
    
    // Return the challenge to complete verification
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } else {
    console.error(`${logPrefix} ❌ Webhook verification failed:`, {
      modeMatch: mode === 'subscribe',
      tokenMatch: verifyToken === WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      hasExpectedToken: !!WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      note: 'Make sure WHATSAPP_WEBHOOK_VERIFY_TOKEN matches the one in Meta Dashboard'
    });
    
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 }
    );
  }
}

/**
 * Handle POST request for webhook payloads
 */
export async function POST(request: NextRequest) {
  const logPrefix = '[WhatsAppWebhook]';
  const startTime = Date.now();
  
  console.log(`${logPrefix} ========== WEBHOOK PAYLOAD RECEIVED ==========`);
  console.log(`${logPrefix} Timestamp: ${new Date().toISOString()}`);

  try {
    // Get request body as text (for signature verification)
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';

    console.log(`${logPrefix} Request details:`, {
      hasSignature: !!signature,
      signatureHeader: signature ? signature.substring(0, 30) + '...' : 'missing',
      bodyLength: body.length,
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent'),
      allHeaders: Object.fromEntries(request.headers.entries())
    });

    // Verify webhook signature
    if (signature && !verifyWhatsAppSignature(body, signature)) {
      console.error(`${logPrefix} ❌ Invalid webhook signature - rejecting request`);
      // In development, allow if secret is not set
      if (!WHATSAPP_WEBHOOK_SECRET && process.env.NODE_ENV === 'development') {
        console.warn(`${logPrefix} ⚠️ Proceeding without signature verification (development mode)`);
      } else {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse webhook payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
      console.log(`${logPrefix} ✅ Payload parsed successfully`);
    } catch (parseError) {
      console.error(`${logPrefix} ❌ Failed to parse payload as JSON:`, {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        bodyPreview: body.substring(0, 500)
      });
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Log full payload structure
    console.log(`${logPrefix} 📋 Payload structure:`, {
      object: payload.object,
      entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0,
      fullPayload: JSON.stringify(payload, null, 2)
    });

    // Process webhook entries
    if (!payload.object || payload.object !== 'whatsapp_business_account') {
      console.warn(`${logPrefix} ⚠️ Unexpected webhook object: ${payload.object}`);
      return NextResponse.json({ received: true, message: 'Not a WhatsApp Business Account webhook' });
    }

    if (!payload.entry || !Array.isArray(payload.entry)) {
      console.warn(`${logPrefix} ⚠️ No entries in webhook payload`);
      return NextResponse.json({ received: true, message: 'No entries in webhook' });
    }

    // Process each entry
    const processedEntries = [];
    for (const entry of payload.entry) {
      console.log(`${logPrefix} Processing entry:`, {
        entryId: entry.id,
        changesCount: entry.changes?.length || 0
      });

      // Process each change in the entry
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const field = change.field;
          const value = change.value;

          console.log(`${logPrefix} Processing change:`, {
            field,
            hasValue: !!value,
            valueType: typeof value
          });

          // Handle messages webhook (status updates)
          if (field === 'messages') {
            const processed = await processMessageStatusUpdate(value, logPrefix);
            processedEntries.push(processed);
          } else {
            console.log(`${logPrefix} ⚠️ Unhandled webhook field: ${field}`);
            console.log(`${logPrefix} Change value:`, JSON.stringify(value, null, 2));
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`${logPrefix} ========== WEBHOOK PROCESSING COMPLETE ==========`);
    console.log(`${logPrefix} Duration: ${duration}ms`);
    console.log(`${logPrefix} Processed entries: ${processedEntries.length}`);

    // Always return 200 to acknowledge receipt
    return NextResponse.json({
      received: true,
      processed: processedEntries.length,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`${logPrefix} ========== WEBHOOK PROCESSING ERROR ==========`);
    console.error(`${logPrefix} Duration before error: ${duration}ms`);
    console.error(`${logPrefix} Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`${logPrefix} Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`${logPrefix} Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    // Still return 200 to prevent Meta from retrying
    // (unless it's a critical error we want to retry)
    return NextResponse.json({
      received: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    });
  }
}

/**
 * Process message status update webhook
 * Handles statuses: sent, delivered, read, failed
 */
async function processMessageStatusUpdate(
  value: Record<string, unknown>,
  logPrefix: string
): Promise<{ messageId: string; status: string; updated: boolean }> {
  console.log(`${logPrefix} [MessageStatus] ========== PROCESSING MESSAGE STATUS ==========`);

  // Extract status information
  const statuses = (value.statuses as Array<Record<string, unknown>>) || [];
  const messages = (value.messages as Array<Record<string, unknown>>) || [];

  console.log(`${logPrefix} [MessageStatus] Status updates:`, {
    statusCount: statuses.length,
    messageCount: messages.length
  });

  const results: Array<{ messageId: string; status: string; updated: boolean; recipientId?: unknown; timestamp?: unknown; error?: { code: unknown; message: unknown; details: unknown } | null }> = [];

  // Process each status update
  for (const status of statuses) {
    const messageId = status.id as string | undefined;
    const statusType = status.status as string; // sent, delivered, read, failed
    const recipientId = status.recipient_id;
    const timestamp = status.timestamp;
    const errorsArr = status.errors as unknown[] | undefined;
    const error = errorsArr?.[0] as Record<string, unknown> | undefined;

    console.log(`${logPrefix} [MessageStatus] Status update:`, {
      messageId,
      status: statusType,
      recipientId,
      timestamp,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorTitle: (error?.error_data as Record<string, unknown>)?.details,
      fullStatus: JSON.stringify(status, null, 2)
    });

    // Update invoice in database if we have the message ID
    let updated = false;
    if (messageId) {
      try {
        const db = await getDatabase();
        const invoicesCollection = db.collection('invoices');

        // Find invoice by WhatsApp message ID
        const invoice = await invoicesCollection.findOne({
          whatsappMessageId: messageId
        });

        if (invoice) {
          console.log(`${logPrefix} [MessageStatus] ✅ Found invoice for message ID:`, {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            currentStatus: invoice.status,
            newStatus: statusType
          });

          // Update invoice status based on message status
          const updateData: Record<string, unknown> = {
            whatsappStatus: statusType,
            whatsappStatusUpdatedAt: new Date()
          };

          // Map WhatsApp status to invoice status
          // Note: "sent" status means message was sent but not yet delivered
          // We track it but don't change invoice status from "sent" to "sent"
          if (statusType === 'delivered') {
            updateData.status = 'delivered';
            updateData.deliveredAt = new Date();
          } else if (statusType === 'read') {
            updateData.status = 'read';
            updateData.readAt = new Date();
          } else if (statusType === 'failed') {
            updateData.status = 'failed';
            updateData.failedAt = new Date();
            updateData.failureReason = (error?.message as string) || ((error?.error_data as Record<string, unknown>)?.details as string) || 'Unknown error';
          }
          // For "sent" status, we just update whatsappStatus but keep invoice status as "sent"

          const updateResult = await invoicesCollection.updateOne(
            { _id: invoice._id },
            { $set: updateData }
          );

          updated = updateResult.modifiedCount > 0;

          console.log(`${logPrefix} [MessageStatus] ${updated ? '✅' : '⚠️'} Invoice update:`, {
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount,
            acknowledged: updateResult.acknowledged
          });
        } else {
          console.log(`${logPrefix} [MessageStatus] ⚠️ No invoice found for message ID: ${messageId}`);
          console.log(`${logPrefix} [MessageStatus] This message may not be from our system or message ID was not saved`);
        }
      } catch (dbError) {
        console.error(`${logPrefix} [MessageStatus] ❌ Database error:`, {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined
        });
      }
    }

    results.push({
      messageId: messageId || 'unknown',
      status: statusType,
      updated,
      recipientId,
      timestamp,
      error: error ? {
        code: error.code,
        message: error.message,
        details: (error.error_data as Record<string, unknown>)?.details
      } : null
    });
  }

  // Process incoming messages (if any)
  if (messages && messages.length > 0) {
    console.log(`${logPrefix} [MessageStatus] 📨 Incoming messages detected:`, {
      count: messages.length
    });

    for (const message of messages) {
      console.log(`${logPrefix} [MessageStatus] Incoming message:`, {
        messageId: message.id,
        from: message.from,
        type: message.type,
        timestamp: message.timestamp,
        fullMessage: JSON.stringify(message, null, 2)
      });
    }
  }

  console.log(`${logPrefix} [MessageStatus] ========== STATUS PROCESSING COMPLETE ==========`);
  console.log(`${logPrefix} [MessageStatus] Results:`, JSON.stringify(results, null, 2));

  return {
    messageId: results[0]?.messageId || 'unknown',
    status: results[0]?.status || 'unknown',
    updated: results.some(r => r.updated)
  };
}
