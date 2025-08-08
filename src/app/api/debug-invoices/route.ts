import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
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

    // Get all invoices for this user
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const invoices = await invoicesCollection.find(query).toArray();

    // Count by status
    const statusCounts = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate pending count with different logics
    const pendingLogic1 = invoices.filter(inv => inv.status === 'draft' || inv.status === 'sent').length;
    const pendingLogic2 = invoices.filter(inv => inv.status === 'draft' || inv.status === 'pending').length;

    return NextResponse.json({
      success: true,
      data: {
        totalInvoices: invoices.length,
        statusCounts,
        pendingCalculations: {
          logic1_draftOrSent: pendingLogic1,
          logic2_draftOrPending: pendingLogic2
        },
        query,
        user: {
          id: session.user.id,
          email: session.user.email,
          organizationId: session.user.organizationId,
          isOrganization
        },
        sampleInvoices: invoices.slice(0, 3).map(inv => ({
          _id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          totalAmount: inv.totalAmount
        }))
      }
    });

  } catch (error) {
    console.error('❌ [Debug Invoices] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error debugging invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 