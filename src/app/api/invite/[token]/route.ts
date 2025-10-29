import { NextRequest, NextResponse } from 'next/server';
import { validateInvitationToken, acceptInvitation, declineInvitation } from '@/lib/actions/invitation';

// GET /api/invite/[token] - Validate invitation token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await validateInvitationToken(token);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Invalid invitation token' 
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error validating invitation token:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to validate invitation token',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/invite/[token]/accept - Accept invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await acceptInvitation(token);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Invitation accepted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Failed to accept invitation' 
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to accept invitation',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/invite/[token] - Decline invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await declineInvitation(token);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Invitation declined successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Failed to decline invitation' 
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error declining invitation:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to decline invitation',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
