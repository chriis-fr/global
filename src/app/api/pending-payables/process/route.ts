import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [Process Pending Payables] Processing for user:', session.user.email);

    const db = await connectToDatabase();
    const pendingPayablesCollection = db.collection('pending_payables');
    const payablesCollection = db.collection('payables');

    // Find all pending payables for this user's email
    const pendingPayables = await pendingPayablesCollection.find({
      recipientEmail: session.user.email,
      processed: false
    }).toArray();

    if (pendingPayables.length === 0) {
      console.log('✅ [Process Pending Payables] No pending payables found');
      return NextResponse.json({
        success: true,
        message: 'No pending payables to process',
        processedCount: 0
      });
    }

    console.log(`📋 [Process Pending Payables] Found ${pendingPayables.length} pending payables`);

    let processedCount = 0;

    for (const pendingPayable of pendingPayables) {
      try {
        // Check if payable already exists
        const existingPayable = await payablesCollection.findOne({
          relatedInvoiceId: pendingPayable.invoiceId,
          issuerId: new ObjectId(session.user.id)
        });

        if (existingPayable) {
          console.log('✅ [Process Pending Payables] Payable already exists, marking as processed');
          await pendingPayablesCollection.updateOne(
            { _id: pendingPayable._id },
            { $set: { processed: true, processedAt: new Date() } }
          );
          continue;
        }

        // Generate payable number
        const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Create payable data
        const payableData = {
          payableNumber,
          payableName: `Invoice Payment - ${pendingPayable.invoiceData.invoiceNumber}`,
          issueDate: new Date(),
          dueDate: new Date(pendingPayable.invoiceData.dueDate),
          companyName: pendingPayable.invoiceData.companyDetails?.name || '',
          companyEmail: pendingPayable.invoiceData.companyDetails?.email || '',
          companyPhone: pendingPayable.invoiceData.companyDetails?.phone || '',
          companyAddress: pendingPayable.invoiceData.companyDetails?.address || {},
          companyTaxNumber: '',
          vendorName: pendingPayable.invoiceData.clientDetails?.name || '',
          vendorEmail: pendingPayable.invoiceData.clientDetails?.email || '',
          vendorPhone: pendingPayable.invoiceData.clientDetails?.phone || '',
          vendorAddress: pendingPayable.invoiceData.clientDetails?.address || {},
          currency: pendingPayable.invoiceData.currency,
          paymentMethod: pendingPayable.invoiceData.paymentMethod,
          paymentNetwork: pendingPayable.invoiceData.paymentNetwork,
          paymentAddress: pendingPayable.invoiceData.paymentAddress,
          enableMultiCurrency: false,
          payableType: 'regular',
          items: pendingPayable.invoiceData.items || [],
          subtotal: pendingPayable.invoiceData.subtotal || 0,
          totalTax: pendingPayable.invoiceData.totalTax || 0,
          total: pendingPayable.invoiceData.totalAmount || 0,
          memo: `Auto-generated payable from invoice ${pendingPayable.invoiceData.invoiceNumber}`,
          status: 'pending',
          priority: 'medium',
          category: 'Invoice Payment',
          attachedFiles: [],
          issuerId: new ObjectId(session.user.id),
          organizationId: session.user.organizationId ? new ObjectId(session.user.organizationId) : null,
          relatedInvoiceId: pendingPayable.invoiceId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Insert payable
        const result = await payablesCollection.insertOne(payableData);
        console.log('✅ [Process Pending Payables] Payable created with ID:', result.insertedId);

        // Mark as processed
        await pendingPayablesCollection.updateOne(
          { _id: pendingPayable._id },
          { $set: { processed: true, processedAt: new Date() } }
        );

        // Sync to financial ledger
        try {
          const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
          const payableWithId = { _id: result.insertedId, ...payableData };
          await LedgerSyncService.syncPayableToLedger(payableWithId);
          console.log('✅ [Process Pending Payables] Payable synced to ledger');
        } catch (syncError) {
          console.error('⚠️ [Process Pending Payables] Failed to sync payable to ledger:', syncError);
        }

        processedCount++;

      } catch (error) {
        console.error('❌ [Process Pending Payables] Error processing pending payable:', error);
        // Continue with other payables even if one fails
      }
    }

    console.log(`✅ [Process Pending Payables] Successfully processed ${processedCount} payables`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} pending payables`,
      processedCount
    });

  } catch (error) {
    console.error('❌ [Process Pending Payables] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process pending payables' },
      { status: 500 }
    );
  }
}
