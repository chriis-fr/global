import { NextRequest, NextResponse } from 'next/server';
import { KRAService } from '@/lib/services/kraService';

export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json();
    const { taxID } = body;

    // Basic validation
    if (!taxID) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Tax ID is required' 
        },
        { status: 400 }
      );
    }

    // Validate format first
    const formatValidation = KRAService.validateTaxIDFormat(taxID);
    if (!formatValidation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          message: formatValidation.message 
        },
        { status: 400 }
      );
    }


    // Verify with KRA API
    const verificationResult = await KRAService.verifyTaxID(taxID);
    
      success: verificationResult.success,
      hasData: !!verificationResult.data,
      hasError: !!verificationResult.error
    });

    if (verificationResult.success && verificationResult.data) {
      return NextResponse.json({
        success: true,
        data: {
          pin: verificationResult.data.pin,
          name: verificationResult.data.name,
          formattedPin: KRAService.formatTaxID(verificationResult.data.pin)
        },
        message: 'Tax ID verified successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: verificationResult.error?.message || 'Verification failed',
          error: verificationResult.error,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

  } catch (error) {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error during verification',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 