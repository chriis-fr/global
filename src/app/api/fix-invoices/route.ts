import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Find invoices that belong to this user but have incorrect organizationId
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    
    if (isOrganization) {
      // For organization users, ensure invoices have correct organizationId
      const result = await invoicesCollection.updateMany(
        { 
          issuerId: session.user.id,
          organizationId: { $ne: session.user.organizationId }
        },
        { 
          $set: { organizationId: session.user.organizationId }
        }
      );
      
      return NextResponse.json({
        success: true,
        message: 'Fixed organization invoices',
        updated: result.modifiedCount
      });
    } else {
      // For individual users, set organizationId to null for their invoices
      const result = await invoicesCollection.updateMany(
        { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ],
          organizationId: { $ne: null }
        },
        { 
          $set: { organizationId: null }
        }
      );
      
      return NextResponse.json({
        success: true,
        message: 'Fixed individual invoices',
        updated: result.modifiedCount
      });
    }

  } catch (error) {
    console.error('❌ [Fix Invoices] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fixing invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 