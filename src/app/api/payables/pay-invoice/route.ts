import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { payableId, paymentMethod, paymentDetails } = body;

    if (!payableId) {
      return NextResponse.json(
        { success: false, message: 'Payable ID is required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const invoicesCollection = db.collection('invoices');

    // Get the payable
    const payable = await payablesCollection.findOne({
      _id: new ObjectId(payableId)
    });

    if (!payable) {
      return NextResponse.json(
        { success: false, message: 'Payable not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to pay this payable
    const isOrganization = !!session.user.organizationId;
    let hasPermission = false;

    if (isOrganization) {
      // Organization members can pay organization payables
      hasPermission = payable.organizationId?.toString() === session.user.organizationId;
    } else {
      // Individual users can pay their own payables
      hasPermission = payable.issuerId?.toString() === session.user.id || 
                     payable.userId === session.user.email;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: 'You do not have permission to pay this payable' },
        { status: 403 }
      );
    }

    // Check if payable is approved (can only pay approved payables)
    if (payable.status !== 'approved') {
      return NextResponse.json(
        { success: false, message: 'Payable must be approved before payment' },
        { status: 400 }
      );
    }

    // Update payable status to paid
    const updateResult = await payablesCollection.updateOne(
      { _id: new ObjectId(payableId) },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'completed',
          paymentDate: new Date(),
          paymentMethod: paymentMethod || 'manual',
          paymentDetails: paymentDetails || {},
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Failed to update payable status' },
        { status: 500 }
      );
    }

    // Update related invoice status if it exists
    if (payable.relatedInvoiceId) {
      try {
        const invoiceUpdateResult = await invoicesCollection.updateOne(
          { _id: new ObjectId(payable.relatedInvoiceId) },
          {
            $set: {
              status: 'paid',
              paidAt: new Date(),
              updatedAt: new Date()
            }
          }
        );

        if (invoiceUpdateResult.modifiedCount > 0) {
        }
      } catch {
        // Don't fail the payment if invoice update fails
      }
    }

    // Sync to financial ledger
    try {
      // Log that the payable is paid
      console.log('✅ [Pay Invoice] Payable marked as paid:', payableId);
    } catch {
      // Don't fail the payment if ledger sync fails
    }


    return NextResponse.json({
      success: true,
      message: 'Payable marked as paid successfully',
      payableId,
      status: 'paid',
      paymentDate: new Date().toISOString()
    });

  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
