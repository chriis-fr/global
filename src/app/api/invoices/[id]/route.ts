import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';
// import { NotificationService } from '@/lib/services/notificationService';

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
    // For organization owners, they should access organization invoices
    const isOrganization = !!session.user.organizationId;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    console.log('📊 [API Invoice] Fetching invoice:', {
      id,
      ownerType,
      ownerId,
      userEmail: session.user.email,
      userId: session.user.id
    });

    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Query based on owner type - Organization members should always see organization's invoices
    // issuerId is stored as ObjectId in DB; session.user.id is string - must use ObjectId for match
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { 
          _id: new ObjectId(id),
          $or: [
            ...(session.user.id ? [{ issuerId: new ObjectId(session.user.id) }] : []),
            { userId: session.user.email }
          ]
        };

    const invoice = await collection.findOne(query);

    if (!invoice) {
      console.log('❌ [API Invoice] Invoice not found:', {
        id,
        ownerType,
        ownerId,
        userEmail: session.user.email,
        userId: session.user.id,
        query
      });
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('✅ [API Invoice] Invoice found:', {
      id,
      invoiceNumber: invoice.invoiceNumber,
      issuerId: invoice.issuerId,
      userId: invoice.userId
    });

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
    // For organization owners, they should access organization invoices
    const isOrganization = !!session.user.organizationId;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    const db = await connectToDatabase();
    const collection = db.collection('invoices');

    // Check if invoice exists and belongs to user/organization - use same logic as GET (issuerId as ObjectId)
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { 
          _id: new ObjectId(id),
          $or: [
            ...(session.user.id ? [{ issuerId: new ObjectId(session.user.id) }] : []),
            { userId: session.user.email }
          ]
        };

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

    // Block bypassing approval: do not allow changing status from pending_approval to sent or approved via PUT
    if (existingInvoice.status === 'pending_approval' && (body.status === 'sent' || body.status === 'approved')) {
      return NextResponse.json(
        {
          success: false,
          message: 'This invoice is pending approval. Only an approver can approve it; status cannot be set to sent or approved here.'
        },
        { status: 403 }
      );
    }

    // Check permissions for status updates
    if (body.status === 'paid') {
      // Individual users can always mark their own invoices as paid
      if (isOrganization) {
        // For organization users, check if they have permission to mark invoices as paid
        // Get user's permissions
        const user = await db.collection('users').findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json(
            { success: false, message: 'User not found' },
            { status: 404 }
          );
        }

        // Get organization and member details
        const organization = await db.collection('organizations').findOne({
          _id: user.organizationId
        });

        if (!organization) {
          return NextResponse.json(
            { success: false, message: 'Organization not found' },
            { status: 404 }
          );
        }

        const member = organization.members.find((m: { userId: string | ObjectId }) => m.userId.toString() === user._id?.toString());
        if (!member) {
          return NextResponse.json(
            { success: false, message: 'User not found in organization' },
            { status: 404 }
          );
        }

        // Check if user has permission to mark invoices as paid
        const { RBACService } = await import('@/lib/services/rbacService');
        if (!RBACService.canMarkInvoiceAsPaid(member)) {
          return NextResponse.json(
            { success: false, message: 'Insufficient permissions to mark invoice as paid' },
            { status: 403 }
          );
        }

        // Additional check: Only allow marking approved invoices as paid for approvers
        if (member.role === 'approver' && existingInvoice.status !== 'approved') {
          return NextResponse.json(
            { success: false, message: 'Approvers can only mark approved invoices as paid' },
            { status: 403 }
          );
        }
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
        
        const payablesCollection = db.collection('payables');
        await payablesCollection.updateOne(
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
          } as Record<string, unknown>
        );
        

        // Update financial ledger for net balance calculation
        try {
          const ledgerCollection = db.collection('financial_ledger');
          
          // Find ledger entry by relatedInvoiceId or entryId
          const existingLedgerEntry = await ledgerCollection.findOne({
            relatedInvoiceId: new ObjectId(id),
            type: 'receivable'
          });
          
          const existingLedgerEntryByNumber = await ledgerCollection.findOne({
            entryId: existingInvoice.invoiceNumber,
            type: 'receivable'
          });
          
          const ledgerEntryToUpdate = existingLedgerEntry || existingLedgerEntryByNumber;
          
          if (ledgerEntryToUpdate) {
            await ledgerCollection.updateOne(
              { 
                _id: ledgerEntryToUpdate._id
              },
              {
                $set: {
                  status: 'paid',
                  updatedAt: new Date()
                }
              }
            );
            console.log('✅ [Invoice Update] Financial ledger updated for invoice:', id);
          }
        } catch (ledgerError) {
          console.error('⚠️ [Invoice Update] Failed to update financial ledger:', ledgerError);
        }
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
    // For organization owners, they should access organization invoices
    const isOrganization = !!session.user.organizationId;
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

    // Query based on owner type - use same logic as GET (issuerId as ObjectId)
    const query = isOrganization 
      ? { _id: new ObjectId(id), organizationId: session.user.organizationId }
      : { 
          _id: new ObjectId(id),
          $or: [
            ...(session.user.id ? [{ issuerId: new ObjectId(session.user.id) }] : []),
            { userId: session.user.email }
          ]
        };

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