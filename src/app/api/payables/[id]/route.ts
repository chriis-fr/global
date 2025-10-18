import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { NotificationService } from '@/lib/services/notificationService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type - Organization members should always see organization's payables
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    
    // Handle both MongoDB ObjectIds and OAuth IDs
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.$or = [
        { organizationId: session.user.organizationId },
        { organizationId: new ObjectId(session.user.organizationId) }
      ];
    } else {
      query.$or = [
        issuerIdQuery,
        { userId: session.user.email }
      ];
    }

    const payable = await collection.findOne(query);

    if (!payable) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: payable
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch payable' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      payableNumber,
      issueDate,
      dueDate,
      companyLogo,
      companyName,
      companyAddress,
      companyTaxNumber,
      vendorName,
      vendorCompany,
      vendorEmail,
      vendorAddress,
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      payableType,
      items,
      subtotal,
      totalTax,
      total,
      memo,
      status,
      category,
      priority,
      companyEmail,
      companyPhone,
      vendorPhone,
      // Status update fields
      newStatus,
      approvalStatus,
      approvalNotes,
      paymentStatus,
      paymentDate,
      updatedAt,
      // Payment action
      markAsPaid
    } = body;

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    
    // Handle both MongoDB ObjectIds and OAuth IDs
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.$or = [
        { organizationId: session.user.organizationId },
        { organizationId: new ObjectId(session.user.organizationId) }
      ];
    } else {
      query.$or = [
        issuerIdQuery,
        { userId: session.user.email }
      ];
    }

    // Check if payable exists and user has access
    const existingPayable = await collection.findOne(query);
    if (!existingPayable) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }


    // Handle "Mark as Paid" action
    if (markAsPaid) {
      const statusHistoryUpdate = {
        status: 'paid',
        timestamp: new Date(),
        updatedBy: session.user.email,
        notes: 'Marked as paid by payer'
      };

      const updateData = {
        status: 'paid',
        paymentStatus: 'completed',
        paymentDate: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateData,
          $push: { statusHistory: statusHistoryUpdate }
        } as Record<string, unknown>
      );

      if (result.modifiedCount === 0) {
        return NextResponse.json({ success: false, message: 'Failed to update payable' }, { status: 500 });
      }

      // Update the related invoice status to "paid" as well
      try {
        if (existingPayable.relatedInvoiceId) {
            payableId: id,
            relatedInvoiceId: existingPayable.relatedInvoiceId,
            payableStatus: 'paid'
          });
          
          const invoicesCollection = db.collection('invoices');
          const invoiceUpdateResult = await invoicesCollection.updateOne(
            { _id: existingPayable.relatedInvoiceId },
            { 
              $set: { 
                status: 'paid',
                paidAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
          
        }
      } catch (invoiceUpdateError) {
        // Don't fail the payable update if invoice update fails
      }

      // Create notification for payment made
      try {
        const userId = isOrganization ? new ObjectId(session.user.organizationId) : new ObjectId(session.user.id);
        
        await NotificationService.createNotification({
          userId,
          organizationId: isOrganization ? new ObjectId(session.user.organizationId) : undefined,
          type: 'payment_received',
          title: 'Payment Made! 💳',
          message: `Payable ${existingPayable.payableNumber || '#' + id.slice(-6)} has been marked as paid. Amount: ${existingPayable.currency || 'USD'} ${(existingPayable.total || 0).toFixed(2)}`,
          priority: 'high',
          actionUrl: `/dashboard/services/payables/${id}`,
          actionText: 'View Payable',
          relatedInvoiceId: existingPayable.relatedInvoiceId,
          metadata: {
            payableNumber: existingPayable.payableNumber,
            amount: existingPayable.total,
            currency: existingPayable.currency,
            vendorName: existingPayable.vendorName
          },
          tags: ['payment', 'payable', 'expense']
        });
        
      } catch (notificationError) {
      }

        // Update financial ledger for net balance calculation
        try {
          const ledgerCollection = db.collection('financial_ledger');
          await ledgerCollection.updateOne(
            { 
              relatedPayableId: new ObjectId(id),
              type: 'payable'
            },
            {
              $set: {
                status: 'paid',
                updatedAt: new Date()
              }
            }
          );
        } catch (ledgerError) {
        }

      return NextResponse.json({
        success: true,
        message: 'Payable marked as paid successfully',
        data: { status: 'paid', paymentDate: new Date() }
      });
    }

    // Prepare update data
    // Get current payable to check for status changes
    const currentPayable = await collection.findOne({ _id: new ObjectId(id) });
    if (!currentPayable) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    // Prepare status history update
    const statusHistoryUpdate = [];
    const currentTime = new Date();
    const userEmail = session.user.email;

    // Check for status changes and add to history
    if (newStatus && newStatus !== currentPayable.status) {
      statusHistoryUpdate.push({
        status: newStatus,
        changedBy: userEmail,
        changedAt: currentTime,
        notes: `Status changed from ${currentPayable.status} to ${newStatus}`
      });

      // If status is being changed to 'paid', also update the related invoice
      if (newStatus === 'paid') {
        try {
          if (currentPayable.relatedInvoiceId) {
              payableId: id,
              relatedInvoiceId: currentPayable.relatedInvoiceId,
              newStatus: 'paid'
            });
            
            const invoicesCollection = db.collection('invoices');
            const invoiceUpdateResult = await invoicesCollection.updateOne(
              { _id: currentPayable.relatedInvoiceId },
              { 
                $set: { 
                  status: 'paid',
                  paidAt: new Date(),
                  updatedAt: new Date()
                }
              }
            );
            
          }
        } catch (invoiceUpdateError) {
          // Don't fail the payable update if invoice update fails
        }

        // Update financial ledger for net balance calculation
        try {
          const ledgerCollection = db.collection('financial_ledger');
          await ledgerCollection.updateOne(
            { 
              relatedPayableId: new ObjectId(id),
              type: 'payable'
            },
            {
              $set: {
                status: 'paid',
                updatedAt: new Date()
              }
            }
          );
        } catch (ledgerError) {
        }
      }
    }

    if (approvalStatus && approvalStatus !== currentPayable.approvalStatus) {
      statusHistoryUpdate.push({
        status: approvalStatus,
        changedBy: userEmail,
        changedAt: currentTime,
        notes: approvalNotes || `Approval status changed to ${approvalStatus}`
      });
    }

    if (paymentStatus && paymentStatus !== currentPayable.paymentStatus) {
      statusHistoryUpdate.push({
        status: paymentStatus,
        changedBy: userEmail,
        changedAt: currentTime,
        notes: `Payment status changed to ${paymentStatus}`
      });
    }

    const updateData = {
      payableNumber,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      companyLogo,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress: {
        street: companyAddress?.street || '',
        city: companyAddress?.city || '',
        state: companyAddress?.state || '',
        zipCode: companyAddress?.zipCode || '',
        country: companyAddress?.country || ''
      },
      companyTaxNumber,
      vendorName,
      vendorCompany,
      vendorEmail,
      vendorPhone,
      vendorAddress: {
        street: vendorAddress?.street || '',
        city: vendorAddress?.city || '',
        state: vendorAddress?.state || '',
        zipCode: vendorAddress?.zipCode || '',
        country: vendorAddress?.country || ''
      },
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      payableType: payableType || 'regular',
      category: category || 'General',
      priority: priority || 'medium',
      items: items ? items.map((item: { id?: string; description: string; quantity: number; unitPrice: number; amount: number; tax: number; discount?: number }) => ({
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        amount: item.amount
      })) : undefined,
      subtotal,
      totalTax,
      total,
      memo,
      status: newStatus || status,
      // Status update fields
      ...(approvalStatus && { approvalStatus }),
      ...(approvalNotes && { approvalNotes }),
      ...(approvalStatus === 'approved' && { 
        approvedBy: userEmail,
        approvedAt: currentTime
      }),
      ...(paymentStatus && { paymentStatus }),
      ...(paymentDate && { paymentDate: new Date(paymentDate) }),
      ...(paymentStatus === 'completed' && { paymentDate: currentTime }),
      updatedAt: updatedAt ? new Date(updatedAt) : currentTime
    };

    // Update the payable with status history
    const updateOperation: Record<string, unknown> = { $set: updateData };
    
    if (statusHistoryUpdate.length > 0) {
      updateOperation.$push = {
        statusHistory: { $each: statusHistoryUpdate }
      };
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      updateOperation
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payable updated successfully',
      data: { _id: id, ...updateData }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to update payable' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid payable ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const collection = db.collection('payables');

    // Build query based on user type
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const query: Record<string, unknown> = { _id: new ObjectId(id) };
    
    if (isOrganization) {
      query.organizationId = session.user.organizationId;
    } else {
      query.$or = [
        { issuerId: session.user.id },
        { userId: session.user.email }
      ];
    }

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Payable not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payable deleted successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to delete payable' },
      { status: 500 }
    );
  }
}
