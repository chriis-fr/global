import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔧 [Data Repair] Starting paid status synchronization repair...');

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const invoicesCollection = db.collection('invoices');

    // Find all payables that are marked as "paid" but have related invoices that are not "paid"
    const paidPayables = await payablesCollection.find({
      status: 'paid',
      relatedInvoiceId: { $exists: true, $ne: null }
    }).toArray();

    console.log(`🔍 [Data Repair] Found ${paidPayables.length} paid payables to check`);

    let repairedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const payable of paidPayables) {
      try {
        // Find the related invoice
        const relatedInvoice = await invoicesCollection.findOne({
          _id: payable.relatedInvoiceId
        });

        if (relatedInvoice) {
          // Check if invoice status needs to be updated
          if (relatedInvoice.status !== 'paid') {
            console.log(`🔧 [Data Repair] Repairing invoice ${relatedInvoice.invoiceNumber} (${relatedInvoice.status} → paid)`);
            
            // Update the invoice status to paid
            const updateResult = await invoicesCollection.updateOne(
              { _id: payable.relatedInvoiceId },
              { 
                $set: { 
                  status: 'paid',
                  paidAt: payable.paymentDate || new Date(),
                  updatedAt: new Date()
                }
              }
            );

            if (updateResult.modifiedCount > 0) {
              repairedCount++;
              results.push({
                payableId: payable._id,
                payableNumber: payable.payableNumber,
                invoiceId: relatedInvoice._id,
                invoiceNumber: relatedInvoice.invoiceNumber,
                oldStatus: relatedInvoice.status,
                newStatus: 'paid',
                success: true
              });
              console.log(`✅ [Data Repair] Successfully updated invoice ${relatedInvoice.invoiceNumber}`);
            } else {
              results.push({
                payableId: payable._id,
                payableNumber: payable.payableNumber,
                invoiceId: relatedInvoice._id,
                invoiceNumber: relatedInvoice.invoiceNumber,
                oldStatus: relatedInvoice.status,
                newStatus: 'paid',
                success: false,
                error: 'Update failed - no documents modified'
              });
            }
          } else {
            console.log(`✅ [Data Repair] Invoice ${relatedInvoice.invoiceNumber} already marked as paid`);
            results.push({
              payableId: payable._id,
              payableNumber: payable.payableNumber,
              invoiceId: relatedInvoice._id,
              invoiceNumber: relatedInvoice.invoiceNumber,
              oldStatus: relatedInvoice.status,
              newStatus: 'paid',
              success: true,
              note: 'Already synchronized'
            });
          }
        } else {
          console.log(`⚠️ [Data Repair] Related invoice not found for payable ${payable.payableNumber}`);
          results.push({
            payableId: payable._id,
            payableNumber: payable.payableNumber,
            invoiceId: payable.relatedInvoiceId,
            invoiceNumber: 'NOT_FOUND',
            oldStatus: 'unknown',
            newStatus: 'paid',
            success: false,
            error: 'Related invoice not found'
          });
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ [Data Repair] Error processing payable ${payable.payableNumber}:`, error);
        results.push({
          payableId: payable._id,
          payableNumber: payable.payableNumber,
          invoiceId: payable.relatedInvoiceId,
          invoiceNumber: 'ERROR',
          oldStatus: 'unknown',
          newStatus: 'paid',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    console.log(`✅ [Data Repair] Repair completed: ${repairedCount} invoices updated, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Data repair completed: ${repairedCount} invoices updated, ${errorCount} errors`,
      data: {
        totalPayablesChecked: paidPayables.length,
        invoicesUpdated: repairedCount,
        errors: errorCount,
        results: results
      }
    });

  } catch (error) {
    console.error('❌ [Data Repair] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to repair data synchronization' },
      { status: 500 }
    );
  }
}
