import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Await params to get the id
    const { id } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const convertToPreferred = searchParams.get('convertToPreferred') === 'true';

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    console.log('📊 [API Invoice] Fetching invoice:', {
      id,
      ownerType,
      ownerId,
      userEmail: session.user.email
    });

    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Query based on owner type
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { _id: new ObjectId(id), issuerId: session.user.id };

    const invoice = await collection.findOne(query);

    if (!invoice) {
      console.log('❌ [API Invoice] Invoice not found:', {
        id,
        ownerType,
        ownerId,
        userEmail: session.user.email
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }


    // Convert currencies if requested
    let processedInvoice = invoice;
    if (convertToPreferred) {
      try {
        // Get user's preferred currency
        const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
        const preferredCurrency = userPreferences.preferredCurrency;

        // Convert invoice amounts to preferred currency
        processedInvoice = await CurrencyService.convertInvoiceForReporting(invoice as { [key: string]: unknown }, preferredCurrency) as typeof invoice;

      } catch (error) {
        console.error('❌ [API Invoice] Currency conversion failed:', error);
        // Continue with original invoice if conversion fails
      }
    }

    return NextResponse.json({
      success: true,
      data: processedInvoice
    });
  } catch (error) {
    console.error('❌ [API Invoice] Error fetching invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invoice' },
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
    const body = await request.json();

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';


    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Check if invoice exists and belongs to user/organization
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { _id: new ObjectId(id), issuerId: session.user.id };

    const existingInvoice = await collection.findOne(query);

    if (!existingInvoice) {
      console.log('❌ [API Invoice] Invoice not found for update:', {
        id,
        ownerType,
        ownerId
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check permissions for status updates
    if (body.status === 'paid') {
      // Individual users can always mark their own invoices as paid
      if (isOrganization) {
        // For organization users, we'll allow organization members to mark invoices as paid
        // You can add more specific permission checks here later
      } else {
      }
    }

    // Update invoice - remove _id from body to avoid immutable field error
    const { _id, ...bodyWithoutId } = body; // eslint-disable-line @typescript-eslint/no-unused-vars
    const updateData = {
      ...bodyWithoutId,
      updatedAt: new Date()
    };

    // If status is being updated to 'paid', add payment date
    if (body.status === 'paid') {
      updateData.paidAt = new Date();
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // If invoice status is being updated to 'paid', also update the related payable
    if (body.status === 'paid') {
      try {
        console.log('🔄 [Invoice Update] Updating related payable:', {
          invoiceId: id,
          status: 'paid'
        });
        
        const payablesCollection = db.collection('payables');
        const payableUpdateResult = await payablesCollection.updateOne(
          { relatedInvoiceId: new ObjectId(id) },
          { 
            $set: { 
              status: 'paid',
              paymentStatus: 'completed',
              paymentDate: new Date(),
              updatedAt: new Date()
            },
            $push: {
              statusHistory: {
                status: 'paid',
                timestamp: new Date(),
                updatedBy: session.user.email,
                notes: 'Status updated from related invoice'
              }
            }
          }
        );
        
        console.log('✅ [Invoice Update] Related payable update result:', {
          matchedCount: payableUpdateResult.matchedCount,
          modifiedCount: payableUpdateResult.modifiedCount,
          invoiceId: id
        });
      } catch (payableUpdateError) {
        console.error('⚠️ [Invoice Update] Failed to update related payable:', payableUpdateError);
        // Don't fail the invoice update if payable update fails
      }
    }

    // Get the updated invoice to return full data
    const updatedInvoice = await collection.findOne({ _id: new ObjectId(id) });


    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });
  } catch (error) {
    console.error('❌ [API Invoice] Error updating invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update invoice' },
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

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    console.log('🗑️ [API Invoice] Deleting invoice:', {
      id,
      ownerType,
      ownerId,
      userEmail: session.user.email
    });

    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Query based on owner type
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { _id: new ObjectId(id), issuerId: session.user.id };

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      console.log('❌ [API Invoice] Invoice not found for deletion:', {
        id,
        ownerType,
        ownerId
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }


    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('❌ [API Invoice] Error deleting invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
} 