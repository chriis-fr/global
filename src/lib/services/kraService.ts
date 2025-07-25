interface KRAVerificationRequest {
  TaxpayerType: string;
  TaxpayerID: string;
}



interface KRAErrorResponse {
  RequestId?: string;
  requestId?: string;
  ErrorCode?: string;
  errorCode?: string;
  ErrorMessage?: string;
  errorMessage?: string;
}

interface KRAVerificationResult {
  success: boolean;
  data?: {
    pin: string;
    name: string;
  };
  error?: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export class KRAService {
  private static readonly BASE_URL = 'https://sbx.kra.go.ke/checker/v1/pin';
  private static readonly TAXPAYER_TYPE = 'KE';

  /**
   * Verify KRA tax ID against the official KRA API
   */
  static async verifyTaxID(taxID: string): Promise<KRAVerificationResult> {
    console.log('🔍 [KRA] Starting tax ID verification for:', taxID);
    
    try {
      // Validate input
      if (!taxID || taxID.trim().length === 0) {
        console.log('❌ [KRA] Invalid tax ID provided');
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Tax ID is required'
          }
        };
      }

      // Clean the tax ID (remove spaces, dashes, etc.)
      const cleanTaxID = taxID.replace(/[\s\-_]/g, '').toUpperCase();
      console.log('🧹 [KRA] Cleaned tax ID:', cleanTaxID);

      // Prepare request
      const requestBody: KRAVerificationRequest = {
        TaxpayerType: this.TAXPAYER_TYPE,
        TaxpayerID: cleanTaxID
      };

      const authToken = Buffer.from(`${process.env.KRA_CLIENT_ID}:${process.env.KRA_CLIENT_SECRET}`).toString('base64');

      console.log('📤 [KRA] Sending verification request:', {
        url: this.BASE_URL,
        taxpayerType: requestBody.TaxpayerType,
        taxpayerID: requestBody.TaxpayerID
      });

      // Make API request
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 [KRA] Received response, status:', response.status);

      const responseData = await response.json();
      console.log('📋 [KRA] Response data:', responseData);

      // Handle success response
      if (response.ok && responseData.TaxpayerPIN && responseData.TaxpayerName) {
        console.log('✅ [KRA] Tax ID verification successful');
        return {
          success: true,
          data: {
            pin: responseData.TaxpayerPIN,
            name: responseData.TaxpayerName
          }
        };
      }

      // Handle error responses
      const errorResponse = responseData as KRAErrorResponse;
      const errorCode = errorResponse.ErrorCode || errorResponse.errorCode || 'UNKNOWN';
      const errorMessage = errorResponse.ErrorMessage || errorResponse.errorMessage || 'Unknown error';
      const requestId = errorResponse.RequestId || errorResponse.requestId;

      console.log('❌ [KRA] Tax ID verification failed:', {
        code: errorCode,
        message: errorMessage,
        requestId
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message: this.getErrorMessage(errorCode, errorMessage),
          requestId
        }
      };

    } catch (error) {
      console.error('❌ [KRA] Error during tax ID verification:', error);
      console.error('🔍 [KRA] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred during verification. Please try again.'
        }
      };
    }
  }

  /**
   * Get user-friendly error messages
   */
  private static getErrorMessage(code: string, originalMessage: string): string {
    switch (code) {
      case '400':
        return 'Tax ID is required. Please provide a valid KRA PIN.';
      case '30002':
        return 'Invalid tax ID. Please check the KRA PIN and try again.';
      case '401':
        return 'Authentication failed. Please contact support.';
      case '403':
        return 'Access denied. Please contact support.';
      case '429':
        return 'Too many requests. Please try again later.';
      case '500':
        return 'KRA service is temporarily unavailable. Please try again later.';
      default:
        return originalMessage || 'Verification failed. Please try again.';
    }
  }

  /**
   * Validate tax ID format (basic validation)
   */
  static validateTaxIDFormat(taxID: string): { isValid: boolean; message: string } {
    if (!taxID || taxID.trim().length === 0) {
      return { isValid: false, message: 'Tax ID is required' };
    }

    const cleanTaxID = taxID.replace(/[\s\-_]/g, '').toUpperCase();
    
    // KRA PIN format: A000000000I (1 letter + 9 digits + 1 letter)
    const kraPinPattern = /^[A-Z]\d{9}[A-Z]$/;
    
    if (!kraPinPattern.test(cleanTaxID)) {
      return { 
        isValid: false, 
        message: 'Invalid KRA PIN format. Expected format: A000000000I' 
      };
    }

    return { isValid: true, message: 'Valid format' };
  }

  /**
   * Format tax ID for display
   */
  static formatTaxID(taxID: string): string {
    if (!taxID) return '';
    
    const cleanTaxID = taxID.replace(/[\s\-_]/g, '').toUpperCase();
    
    // Format as A000000000I
    if (cleanTaxID.length === 11) {
      return `${cleanTaxID.slice(0, 1)}${cleanTaxID.slice(1, 10)}${cleanTaxID.slice(10)}`;
    }
    
    return cleanTaxID;
  }
} 