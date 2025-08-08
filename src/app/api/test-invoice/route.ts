import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get the invoice directly by ID first
    const invoice = await invoicesCollection.findOne({ _id: new ObjectId(invoiceId) });

    if (!invoice) {
      return NextResponse.json({
        success: false,
        message: 'Invoice not found by ID',
        invoiceId,
        session: {
          userId: session.user.id,
          userEmail: session.user.email,
          organizationId: session.user.organizationId
        }
      }, { status: 404 });
    }

    // Check if user has access to this invoice
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const hasAccess = isOrganization 
      ? invoice.organizationId?.toString() === session.user.organizationId
      : invoice.issuerId?.toString() === session.user.id || invoice.userId === session.user.email;

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          issuerId: invoice.issuerId,
          userId: invoice.userId,
          organizationId: invoice.organizationId,
          status: invoice.status,
          totalAmount: invoice.totalAmount
        },
        session: {
          userId: session.user.id,
          userEmail: session.user.email,
          organizationId: session.user.organizationId,
          isOrganization
        },
        hasAccess,
        query: {
          byId: { _id: new ObjectId(invoiceId) },
          byIssuerId: { _id: new ObjectId(invoiceId), issuerId: session.user.id },
          byUserId: { _id: new ObjectId(invoiceId), userId: session.user.email },
          byOrganizationId: isOrganization ? { _id: new ObjectId(invoiceId), organizationId: session.user.organizationId } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ [Test Invoice] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error testing invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 