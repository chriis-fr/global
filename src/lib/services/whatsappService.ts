
interface WhatsAppInvoiceData {
  clientName: string;
  senderName: string;
  invoiceNumber: string;
  pdfBuffer: string;
  clientPhone: string;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class WhatsAppService {
  private static readonly META_API_URL = process.env.META_WHATSAPP_API_URL ;
  private static readonly ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;
  private static readonly PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  private static readonly TEMPLATE_NAMESPACE = process.env.META_WHATSAPP_TEMPLATE_NAMESPACE;
  private static readonly TEMPLATE_NAME = process.env.META_WHATSAPP_TEMPLATE_NAME;

  /**
   * Send invoice via WhatsApp using Meta Business API
   */
  static async sendInvoiceWhatsapp(data: WhatsAppInvoiceData): Promise<WhatsAppResponse> {
    const startTime = Date.now();
    const logPrefix = '[WhatsApp Service]';
    
    console.log(`${logPrefix} ========== STARTING WHATSAPP SERVICE ==========`);
    console.log(`${logPrefix} Input data:`, {
      clientName: data.clientName,
      senderName: data.senderName,
      invoiceNumber: data.invoiceNumber,
      phone: data.clientPhone,
      hasPdf: !!data.pdfBuffer,
      pdfBufferSize: data.pdfBuffer?.length || 0
    });

    try {
      // Step 1: Validate credentials
      console.log(`${logPrefix} [Step 1] Validating API credentials...`);
      const hasAccessToken = !!this.ACCESS_TOKEN;
      const hasPhoneNumberId = !!this.PHONE_NUMBER_ID;
      const hasApiUrl = !!this.META_API_URL;
      const hasTemplateName = !!this.TEMPLATE_NAME;
      const hasTemplateNamespace = !!this.TEMPLATE_NAMESPACE;
      
      console.log(`${logPrefix} [Step 1] Credential check:`, {
        hasAccessToken,
        hasPhoneNumberId,
        hasApiUrl,
        hasTemplateName,
        hasTemplateNamespace,
        apiUrl: this.META_API_URL || 'MISSING',
        phoneNumberId: this.PHONE_NUMBER_ID || 'MISSING',
        templateName: this.TEMPLATE_NAME || 'MISSING',
        templateNamespace: this.TEMPLATE_NAMESPACE || 'MISSING',
        accessTokenPreview: this.ACCESS_TOKEN ? `${this.ACCESS_TOKEN.substring(0, 10)}...` : 'MISSING'
      });

      if (!this.ACCESS_TOKEN || !this.PHONE_NUMBER_ID) {
        console.error(`${logPrefix} [Step 1] ❌ Missing credentials`);
        throw new Error('WhatsApp API credentials not configured');
      }
      console.log(`${logPrefix} [Step 1] ✅ Credentials validated`);
      
      // Step 2: Validate input data
      console.log(`${logPrefix} [Step 2] Validating input data...`);
      if (!data.clientPhone) {
        console.error(`${logPrefix} [Step 2] ❌ Missing client phone number`);
        throw new Error('Client phone number is required for WhatsApp sending');
      }
      if (!data.pdfBuffer) {
        console.error(`${logPrefix} [Step 2] ❌ Missing PDF buffer`);
        throw new Error('PDF buffer is required for WhatsApp sending');
      }
      console.log(`${logPrefix} [Step 2] ✅ Input data validated`);

      // Step 3: Format phone number
      console.log(`${logPrefix} [Step 3] Formatting phone number...`);
      const formattedPhone = this.formatPhoneNumber(data.clientPhone);
      console.log(`${logPrefix} [Step 3] ✅ Phone formatted:`, {
        original: data.clientPhone,
        formatted: formattedPhone,
        originalLength: data.clientPhone.length,
        formattedLength: formattedPhone.length
      });
      
      // Step 4: Upload PDF to Meta
      console.log(`${logPrefix} [Step 4] Uploading PDF to Meta...`);
      const uploadStartTime = Date.now();
      let mediaId: string;
      try {
        mediaId = await this.uploadPdfToMeta(data.pdfBuffer);
        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`${logPrefix} [Step 4] ✅ PDF uploaded successfully in ${uploadDuration}ms:`, {
          mediaId,
          pdfSize: data.pdfBuffer.length
        });
      } catch (uploadError) {
        console.error(`${logPrefix} [Step 4] ❌ PDF upload failed:`, {
          error: uploadError instanceof Error ? uploadError.message : String(uploadError),
          stack: uploadError instanceof Error ? uploadError.stack : undefined
        });
        throw uploadError;
      }
      
      // Step 5: Prepare request body
      console.log(`${logPrefix} [Step 5] Preparing API request body...`);
      const requestBody = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: this.TEMPLATE_NAME,
          language: {
            code: 'en',
            policy: 'deterministic'
          },
          components: [
            {
              type: 'header',
              parameters: [
                {
                  type: 'document',
                  document: {
                    id: mediaId,
                    filename: `Invoice_${data.invoiceNumber}.pdf`
                  }
                }
              ]
            },
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  parameter_name: 'client_name',
                  text: data.clientName
                },
                {
                  type: 'text',
                  parameter_name: 'sender_name',
                  text: data.senderName
                },
                {
                  type: 'text',
                  parameter_name: 'inv_number',
                  text: data.invoiceNumber
                }
              ]
            }
          ]
        }
      };
      console.log(`${logPrefix} [Step 5] ✅ Request body prepared:`, {
        to: requestBody.to,
        templateName: requestBody.template.name,
        templateLanguage: requestBody.template.language.code,
        headerComponent: requestBody.template.components[0]?.type,
        bodyComponent: requestBody.template.components[1]?.type,
        bodyParameters: requestBody.template.components[1]?.parameters?.map(p => 
          'parameter_name' in p ? p.parameter_name : p.type
        ),
        fullRequestBody: JSON.stringify(requestBody, null, 2)
      });

      // Step 6: Send message via Meta API
      console.log(`${logPrefix} [Step 6] Sending message to Meta API...`);
      const apiUrl = `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/messages`;
      console.log(`${logPrefix} [Step 6] API endpoint:`, {
        url: apiUrl,
        method: 'POST',
        templateName: this.TEMPLATE_NAME,
        templateNamespace: this.TEMPLATE_NAMESPACE
      });

      const apiStartTime = Date.now();
      let response: Response;
      let result: {
        messages?: Array<{ id: string; message_status: string }>;
        contacts?: Array<{ wa_id?: string; input?: string }>;
        error?: { 
          code: number; 
          message: string; 
          type: string; 
          error_subcode?: number;
          fbtrace_id?: string;
          error_data?: { details?: string; [key: string]: unknown };
        };
      };
      
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
        
        const apiDuration = Date.now() - apiStartTime;
        console.log(`${logPrefix} [Step 6] API request completed in ${apiDuration}ms:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        const responseText = await response.text();
        console.log(`${logPrefix} [Step 6] Raw response text:`, responseText);
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`${logPrefix} [Step 6] ❌ Failed to parse response as JSON:`, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            responseText: responseText.substring(0, 500)
          });
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
        }
        
        console.log(`${logPrefix} [Step 6] Parsed response:`, {
          success: result.messages ? true : false,
          hasMessages: !!result.messages,
          messageCount: result.messages?.length || 0,
          hasContacts: !!result.contacts,
          contactCount: result.contacts?.length || 0,
          contactWaId: result.contacts?.[0]?.wa_id,
          contactInput: result.contacts?.[0]?.input,
          hasError: !!result.error,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
          errorType: result.error?.type,
          errorSubcode: result.error?.error_subcode,
          fullResponse: JSON.stringify(result, null, 2)
        });
      } catch (fetchError) {
        const apiDuration = Date.now() - apiStartTime;
        console.error(`${logPrefix} [Step 6] ❌ Fetch error after ${apiDuration}ms:`, {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          name: fetchError instanceof Error ? fetchError.name : undefined
        });
        throw fetchError;
      }

      // Step 7: Process response
      console.log(`${logPrefix} [Step 7] Processing API response...`);
      if (response.ok && result.messages && result.messages.length > 0) {
        const messageId = result.messages[0].id;
        const messageStatus = result.messages[0].message_status;
        const contactInfo = result.contacts?.[0];
        
        console.log(`${logPrefix} [Step 7] ✅ Message accepted by Meta API!`, {
          messageId,
          status: messageStatus,
          recipient: formattedPhone,
          contactWaId: contactInfo?.wa_id,
          contactInput: contactInfo?.input
        });
        
        // IMPORTANT: "accepted" status means Meta accepted the message, NOT that it was delivered
        if (messageStatus === 'accepted') {
          console.warn(`${logPrefix} [Step 7] ⚠️ WARNING: Message status is "accepted" - this does NOT guarantee delivery!`);
          console.warn(`${logPrefix} [Step 7] ⚠️ Possible reasons message might not be delivered:`, {
            reason1: 'Phone number not registered on WhatsApp',
            reason2: 'Recipient has blocked your WhatsApp Business number',
            reason3: 'Template approval issues',
            reason4: 'Delivery failure after acceptance',
            action: 'Check Meta Business Dashboard for delivery status updates'
          });
          console.warn(`${logPrefix} [Step 7] ⚠️ To track delivery status, set up webhooks or check Meta Dashboard`);
        }
        
        // Check if phone number is registered on WhatsApp
        if (contactInfo?.wa_id) {
          if (contactInfo.wa_id !== contactInfo.input) {
            console.warn(`${logPrefix} [Step 7] ⚠️ Phone number format changed:`, {
              input: contactInfo.input,
              waId: contactInfo.wa_id,
              note: 'Meta may have reformatted the number'
            });
          } else {
            console.log(`${logPrefix} [Step 7] ✅ Phone number recognized by WhatsApp:`, {
              input: contactInfo.input,
              waId: contactInfo.wa_id,
              note: 'Number appears to be registered on WhatsApp'
            });
          }
        } else {
          console.error(`${logPrefix} [Step 7] ❌ CRITICAL: No wa_id in response - phone number may not be registered on WhatsApp!`);
          console.error(`${logPrefix} [Step 7] ❌ This means the recipient does NOT have this phone number on WhatsApp`);
          console.error(`${logPrefix} [Step 7] ❌ Action required: Verify the phone number is registered on WhatsApp before sending`);
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`${logPrefix} ========== WHATSAPP SERVICE SUCCESS ==========`);
        console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
        console.log(`${logPrefix} 📱 MESSAGE ID: ${messageId}`);
        console.log(`${logPrefix} 📱 Full Message ID (for Meta Dashboard): ${messageId}`);
        console.log(`${logPrefix} 📱 Direct Dashboard Link: https://business.facebook.com/wa/manage/message-templates/?message_id=${encodeURIComponent(messageId)}`);
        console.log(`${logPrefix} ⚠️ TROUBLESHOOTING GUIDE:`);
        console.log(`${logPrefix} 1. Check Meta Business Dashboard: https://business.facebook.com/`);
        console.log(`${logPrefix} 2. Navigate to: WhatsApp > Message Templates > View sent messages`);
        console.log(`${logPrefix} 3. Search for Message ID: ${messageId}`);
        console.log(`${logPrefix} 4. If "No message history" appears, possible reasons:`);
        console.log(`${logPrefix}    a) Message was accepted but failed to deliver (check wa_id above)`);
        console.log(`${logPrefix}    b) Phone number not registered on WhatsApp (no wa_id in response)`);
        console.log(`${logPrefix}    c) Message expired (older than 14 days)`);
        console.log(`${logPrefix}    d) Insufficient permissions to view webhook messages`);
        console.log(`${logPrefix} 5. Check delivery status flow: accepted → sent → delivered → read`);
        console.log(`${logPrefix} 6. Verify:`);
        console.log(`${logPrefix}    - Phone number: ${formattedPhone} is registered on WhatsApp`);
        console.log(`${logPrefix}    - Template "${this.TEMPLATE_NAME}" is approved and active`);
        console.log(`${logPrefix}    - Business account has sufficient credits/quota`);
        console.log(`${logPrefix}    - Recipient hasn't blocked your business number`);
        console.log(`${logPrefix} 7. Set up webhooks at: Meta Business Suite > WhatsApp > Configuration > Webhooks`);
        console.log(`${logPrefix}    Subscribe to "messages" webhook to track delivery status in real-time`);
        console.log(`${logPrefix} 8. Check API response details above for wa_id - if missing, number is NOT on WhatsApp`);
        
        // Log troubleshooting info
        const troubleshooting = this.getMessageTroubleshootingInfo(messageId);
        console.log(`${logPrefix} 📋 TROUBLESHOOTING INFO:`, JSON.stringify(troubleshooting, null, 2));
        
        return {
          success: true,
          messageId: messageId
        };
      } else {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          fullResponse: result
        };
        console.error(`${logPrefix} [Step 7] ❌ Failed to send message:`, errorDetails);
        console.error(`${logPrefix} [Step 7] Error details:`, {
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
          errorType: result.error?.type,
          errorSubcode: result.error?.error_subcode,
          errorFbtraceId: result.error?.fbtrace_id,
          errorDetails: result.error?.error_data,
          fullError: JSON.stringify(result.error, null, 2)
        });
        
        const totalDuration = Date.now() - startTime;
        console.log(`${logPrefix} ========== WHATSAPP SERVICE FAILED ==========`);
        console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
        
        throw new Error(result.error?.message || `Failed to send WhatsApp message (Status: ${response.status})`);
      }

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`${logPrefix} ========== WHATSAPP SERVICE EXCEPTION ==========`);
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
   * Upload PDF to Meta to get media_id
   */
  private static async uploadPdfToMeta(pdfBuffer: string): Promise<string> {
    const startTime = Date.now();
    const logPrefix = '[WhatsApp PDF Upload]';
    
    try {
      console.log(`${logPrefix} ========== STARTING PDF UPLOAD ==========`);
      console.log(`${logPrefix} Input:`, {
        pdfBufferLength: pdfBuffer.length,
        pdfBufferPreview: pdfBuffer.substring(0, 50),
        url: `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/media`
      });

      // Step 1: Convert base64 to buffer
      console.log(`${logPrefix} [Step 1] Converting base64 to buffer...`);
      let buffer: Buffer;
      try {
        buffer = Buffer.from(pdfBuffer, 'base64');
        console.log(`${logPrefix} [Step 1] ✅ Buffer created:`, {
          bufferLength: buffer.length,
          bufferSizeKB: Math.round(buffer.length / 1024)
        });
      } catch (convertError) {
        console.error(`${logPrefix} [Step 1] ❌ Buffer conversion failed:`, {
          error: convertError instanceof Error ? convertError.message : String(convertError)
        });
        throw new Error(`Failed to convert PDF buffer: ${convertError instanceof Error ? convertError.message : 'Unknown error'}`);
      }
      
      // Step 2: Prepare form data
      console.log(`${logPrefix} [Step 2] Preparing form data...`);
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', 'document');
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(buffer);
      formData.append('file', new Blob([uint8Array], { type: 'application/pdf' }), 'invoice.pdf');
      console.log(`${logPrefix} [Step 2] ✅ Form data prepared:`, {
        hasMessagingProduct: formData.has('messaging_product'),
        hasType: formData.has('type'),
        hasFile: formData.has('file')
      });

      // Step 3: Upload to Meta
      console.log(`${logPrefix} [Step 3] Uploading to Meta API...`);
      const uploadUrl = `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/media`;
      console.log(`${logPrefix} [Step 3] Upload URL:`, uploadUrl);
      
      const uploadStartTime = Date.now();
      let response: Response;
      let result: {
        id?: string;
        error?: { 
          code: number; 
          message: string; 
          type: string; 
          error_subcode?: number;
          fbtrace_id?: string;
          error_data?: { details?: string; [key: string]: unknown };
        };
      };
      
      try {
        response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
          },
          body: formData
        });
        
        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`${logPrefix} [Step 3] Upload request completed in ${uploadDuration}ms:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        const responseText = await response.text();
        console.log(`${logPrefix} [Step 3] Raw response text:`, responseText);
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`${logPrefix} [Step 3] ❌ Failed to parse response as JSON:`, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            responseText: responseText.substring(0, 500)
          });
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
        }
        
        console.log(`${logPrefix} [Step 3] Parsed response:`, {
          hasId: !!result.id,
          mediaId: result.id,
          hasError: !!result.error,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
          fullResponse: JSON.stringify(result, null, 2)
        });
      } catch (fetchError) {
        const uploadDuration = Date.now() - uploadStartTime;
        console.error(`${logPrefix} [Step 3] ❌ Fetch error after ${uploadDuration}ms:`, {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          name: fetchError instanceof Error ? fetchError.name : undefined
        });
        throw fetchError;
      }
      
      // Step 4: Process response
      console.log(`${logPrefix} [Step 4] Processing upload response...`);
      if (response.ok && result.id) {
        const totalDuration = Date.now() - startTime;
        console.log(`${logPrefix} ========== PDF UPLOAD SUCCESS ==========`);
        console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
        console.log(`${logPrefix} Media ID: ${result.id}`);
        return result.id;
      } else {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          fullResponse: result
        };
        console.error(`${logPrefix} [Step 4] ❌ PDF upload failed:`, errorDetails);
        console.error(`${logPrefix} [Step 4] Error details:`, {
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
          errorType: result.error?.type,
          errorSubcode: result.error?.error_subcode,
          errorFbtraceId: result.error?.fbtrace_id,
          fullError: JSON.stringify(result.error, null, 2)
        });
        
        const totalDuration = Date.now() - startTime;
        console.log(`${logPrefix} ========== PDF UPLOAD FAILED ==========`);
        console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
        
        throw new Error(result.error?.message || `Failed to upload PDF to Meta (Status: ${response.status})`);
      }
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`${logPrefix} ========== PDF UPLOAD EXCEPTION ==========`);
      console.error(`${logPrefix} Total duration before error: ${totalDuration}ms`);
      console.error(`${logPrefix} Error type:`, error instanceof Error ? error.constructor.name : typeof error);
      console.error(`${logPrefix} Error message:`, error instanceof Error ? error.message : String(error));
      console.error(`${logPrefix} Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      console.error(`${logPrefix} Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      throw new Error(`PDF upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format phone number for WhatsApp API
   */
  private static formatPhoneNumber(phone: string): string {
    const logPrefix = '[WhatsApp Phone Format]';
    console.log(`${logPrefix} Formatting phone number:`, {
      original: phone,
      originalLength: phone.length
    });
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    console.log(`${logPrefix} After removing non-digits:`, {
      digits,
      digitsLength: digits.length
    });
    
    let formatted: string;
    
    // If it doesn't start with country code, assume it needs one
    if (digits.length === 10) {
      // Assume US number if 10 digits
      formatted = `1${digits}`;
      console.log(`${logPrefix} Detected 10-digit number, added US country code`);
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // Already has US country code
      formatted = digits;
      console.log(`${logPrefix} Detected 11-digit US number`);
    } else if (digits.length > 11) {
      // Has international code
      formatted = digits;
      console.log(`${logPrefix} Detected international number`);
    } else {
      // Return as is if it looks like it has a country code
      formatted = digits;
      console.log(`${logPrefix} Using digits as-is`);
    }
    
    console.log(`${logPrefix} ✅ Formatted result:`, {
      original: phone,
      formatted,
      originalLength: phone.length,
      formattedLength: formatted.length
    });
    
    return formatted;
  }

  /**
   * Send a simple text message (fallback if template fails)
   */
  static async sendSimpleMessage(phoneNumber: string, message: string): Promise<WhatsAppResponse> {
    const startTime = Date.now();
    const logPrefix = '[WhatsApp Simple Message]';
    
    console.log(`${logPrefix} ========== STARTING SIMPLE MESSAGE ==========`);
    console.log(`${logPrefix} Input:`, {
      phoneNumber,
      messageLength: message.length,
      messagePreview: message.substring(0, 100)
    });
    
    try {
      if (!this.ACCESS_TOKEN || !this.PHONE_NUMBER_ID) {
        console.error(`${logPrefix} ❌ Missing credentials`);
        throw new Error('WhatsApp API credentials not configured');
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log(`${logPrefix} Formatted phone:`, {
        original: phoneNumber,
        formatted: formattedPhone
      });
      
      const requestBody = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      console.log(`${logPrefix} Sending to:`, {
        url: `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      const response = await fetch(`${this.META_API_URL}/${this.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      console.log(`${logPrefix} Response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        result: JSON.stringify(result, null, 2)
      });

      if (response.ok && result.messages && result.messages.length > 0) {
        const totalDuration = Date.now() - startTime;
        console.log(`${logPrefix} ========== SIMPLE MESSAGE SUCCESS ==========`);
        console.log(`${logPrefix} Total duration: ${totalDuration}ms`);
        console.log(`${logPrefix} Message ID: ${result.messages[0].id}`);
        
        return {
          success: true,
          messageId: result.messages[0].id
        };
      } else {
        console.error(`${logPrefix} ❌ Failed to send:`, {
          error: result.error,
          fullResponse: result
        });
        throw new Error(result.error?.message || 'Failed to send WhatsApp message');
      }

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`${logPrefix} ========== SIMPLE MESSAGE EXCEPTION ==========`);
      console.error(`${logPrefix} Total duration: ${totalDuration}ms`);
      console.error(`${logPrefix} Error:`, {
        type: error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get troubleshooting info for a message ID
   * Note: Meta API doesn't provide a direct endpoint to check message status
   * Status updates come through webhooks. This provides guidance instead.
   */
  static getMessageTroubleshootingInfo(messageId: string): {
    messageId: string;
    dashboardUrl: string;
    commonIssues: string[];
    solutions: string[];
  } {
    return {
      messageId,
      dashboardUrl: `https://business.facebook.com/wa/manage/message-templates/?message_id=${encodeURIComponent(messageId)}`,
      commonIssues: [
        'Message shows "accepted" but not in dashboard history',
        'No wa_id in API response (phone number not on WhatsApp)',
        'Message expired (older than 14 days)',
        'Insufficient permissions to view webhook messages',
        'Template not approved or inactive',
        'Recipient blocked your business number',
        'Business account out of credits/quota'
      ],
      solutions: [
        'Check if wa_id was returned in the API response (see logs above)',
        'Verify phone number is registered on WhatsApp before sending',
        'Set up webhooks to track delivery status in real-time',
        'Check Meta Business Dashboard > WhatsApp > Configuration > Webhooks',
        'Subscribe to "messages" webhook topic',
        'Verify template is approved: Meta Dashboard > WhatsApp > Message Templates',
        'Check business account credits: Meta Dashboard > Billing',
        'Ask recipient to unblock your business number if blocked'
      ]
    };
  }
}

export { WhatsAppService, type WhatsAppInvoiceData, type WhatsAppResponse };