
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
    console.log('🚀 [WhatsApp] Starting invoice send process...', {
      clientName: data.clientName,
      senderName: data.senderName,
      invoiceNumber: data.invoiceNumber,
      phone: data.clientPhone,
      hasPdf: !!data.pdfBuffer
    });

    try {
      if (!this.ACCESS_TOKEN || !this.PHONE_NUMBER_ID) {
        console.error('❌ [WhatsApp] Missing credentials:', {
          hasAccessToken: !!this.ACCESS_TOKEN,
          hasPhoneNumberId: !!this.PHONE_NUMBER_ID
        });
        throw new Error('WhatsApp API credentials not configured');
      }
      
      if (!data.clientPhone) {
        console.error('❌ [WhatsApp] Missing client phone number');
        throw new Error('Client phone number is required for WhatsApp sending');
      }

      // Format phone number (remove any non-digit characters and ensure it starts with country code)
      const formattedPhone = this.formatPhoneNumber(data.clientPhone);
      console.log('📱 [WhatsApp] Formatted phone number:', {
        original: data.clientPhone,
        formatted: formattedPhone
      });
      
      // First, upload the PDF to Meta to get media_id
      console.log('📄 [WhatsApp] Uploading PDF to Meta...');
      const mediaId = await this.uploadPdfToMeta(data.pdfBuffer);
      console.log('✅ [WhatsApp] PDF uploaded successfully, media ID:', mediaId);
      
      // Prepare the API request using your approved template
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

      // Send the message via Meta API
      console.log('📤 [WhatsApp] Sending message to Meta API...', {
        url: `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        templateName: this.TEMPLATE_NAME,
        templateNamespace: this.TEMPLATE_NAMESPACE,
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
      
      console.log('📥 [WhatsApp] Meta API Response:', {
        status: response.status,
        statusText: response.statusText,
        response: JSON.stringify(result, null, 2)
      });

      if (response.ok && result.messages && result.messages.length > 0) {
        console.log('✅ [WhatsApp] Message sent successfully!', {
          messageId: result.messages[0].id,
          status: result.messages[0].message_status
        });
        return {
          success: true,
          messageId: result.messages[0].id
        };
      } else {
        console.error('❌ [WhatsApp] Failed to send message:', {
          error: result.error,
          fullResponse: result
        });
        throw new Error(result.error?.message || 'Failed to send WhatsApp message');
      }

    } catch (error) {
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
    try {
      console.log('📤 [WhatsApp] Uploading PDF to Meta...', {
        pdfSize: pdfBuffer.length,
        url: `${this.META_API_URL}/${this.PHONE_NUMBER_ID}/media`
      });

      // Convert base64 to buffer
      const buffer = Buffer.from(pdfBuffer, 'base64');
      
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', 'document');
      formData.append('file', new Blob([buffer], { type: 'application/pdf' }), 'invoice.pdf');

      const response = await fetch(`${this.META_API_URL}/${this.PHONE_NUMBER_ID}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
        },
        body: formData
      });

      const result = await response.json();
      
      console.log('📥 [WhatsApp] PDF Upload Response:', {
        status: response.status,
        statusText: response.statusText,
        response: JSON.stringify(result, null, 2)
      });
      
      if (response.ok && result.id) {
        console.log('✅ [WhatsApp] PDF uploaded successfully, media ID:', result.id);
        return result.id;
      } else {
        console.error('❌ [WhatsApp] PDF upload failed:', result.error);
        throw new Error(result.error?.message || 'Failed to upload PDF to Meta');
      }
    } catch (error) {
      console.error('❌ [WhatsApp] PDF upload error:', error);
      throw new Error(`PDF upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format phone number for WhatsApp API
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it doesn't start with country code, assume it needs one
    if (digits.length === 10) {
      // Assume US number if 10 digits
      return `1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // Already has US country code
      return digits;
    } else if (digits.length > 11) {
      // Has international code
      return digits;
    } else {
      // Return as is if it looks like it has a country code
      return digits;
    }
  }

  /**
   * Send a simple text message (fallback if template fails)
   */
  static async sendSimpleMessage(phoneNumber: string, message: string): Promise<WhatsAppResponse> {
    try {
      if (!this.ACCESS_TOKEN || !this.PHONE_NUMBER_ID) {
        throw new Error('WhatsApp API credentials not configured');
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const requestBody = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await fetch(`${this.META_API_URL}/${this.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (response.ok && result.messages && result.messages.length > 0) {
        return {
          success: true,
          messageId: result.messages[0].id
        };
      } else {
        throw new Error(result.error?.message || 'Failed to send WhatsApp message');
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export { WhatsAppService, type WhatsAppInvoiceData, type WhatsAppResponse };