import { NextRequest, NextResponse } from 'next/server';
import { KRAService } from '@/lib/services/kraService';

export async function POST(request: NextRequest) {
  console.log('🔍 [KRA API] Starting tax ID verification request...');
  
  try {
    const body = await request.json();
    const { taxID } = body;

    console.log('📥 [KRA API] Received request:', { 
      hasTaxID: !!taxID,
      taxIDLength: taxID?.length || 0
    });

    // Basic validation
    if (!taxID) {
      console.log('❌ [KRA API] Missing tax ID in request');
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
      console.log('❌ [KRA API] Invalid tax ID format:', formatValidation.message);
      return NextResponse.json(
        { 
          success: false, 
          message: formatValidation.message 
        },
        { status: 400 }
      );
    }

    console.log('✅ [KRA API] Format validation passed, proceeding with KRA verification...');

    // Verify with KRA API
    const verificationResult = await KRAService.verifyTaxID(taxID);
    
    console.log('📋 [KRA API] Verification result:', {
      success: verificationResult.success,
      hasData: !!verificationResult.data,
      hasError: !!verificationResult.error
    });

    if (verificationResult.success && verificationResult.data) {
      console.log('✅ [KRA API] Verification successful, returning data');
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
      console.log('❌ [KRA API] Verification failed:', verificationResult.error);
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
    console.error('❌ [KRA API] Error processing verification request:', error);
    console.error('🔍 [KRA API] Error details:', {
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