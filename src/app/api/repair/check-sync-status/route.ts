import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }


    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const invoicesCollection = db.collection('invoices');

    // Find all payables with related invoices
    const payablesWithInvoices = await payablesCollection.find({
      relatedInvoiceId: { $exists: true, $ne: null }
    }).toArray();


    const syncIssues = [];
    const syncedItems = [];

    for (const payable of payablesWithInvoices) {
      try {
        // Find the related invoice
        const relatedInvoice = await invoicesCollection.findOne({
          _id: payable.relatedInvoiceId
        });

        if (relatedInvoice) {
          // Check if statuses are synchronized
          const isSynced = (payable.status === 'paid' && relatedInvoice.status === 'paid') ||
                          (payable.status !== 'paid' && relatedInvoice.status !== 'paid');

          if (!isSynced) {
            syncIssues.push({
              payableId: payable._id,
              payableNumber: payable.payableNumber,
              payableStatus: payable.status,
              invoiceId: relatedInvoice._id,
              invoiceNumber: relatedInvoice.invoiceNumber,
              invoiceStatus: relatedInvoice.status,
              issue: payable.status === 'paid' ? 
                'Payable is paid but invoice is not marked as paid' : 
                'Invoice is paid but payable is not marked as paid'
            });
          } else {
            syncedItems.push({
              payableId: payable._id,
              payableNumber: payable.payableNumber,
              payableStatus: payable.status,
              invoiceId: relatedInvoice._id,
              invoiceNumber: relatedInvoice.invoiceNumber,
              invoiceStatus: relatedInvoice.status
            });
          }
        } else {
          syncIssues.push({
            payableId: payable._id,
            payableNumber: payable.payableNumber,
            payableStatus: payable.status,
            invoiceId: payable.relatedInvoiceId,
            invoiceNumber: 'NOT_FOUND',
            invoiceStatus: 'NOT_FOUND',
            issue: 'Related invoice not found'
          });
        }
      } catch (error) {
        syncIssues.push({
          payableId: payable._id,
          payableNumber: payable.payableNumber,
          payableStatus: payable.status,
          invoiceId: payable.relatedInvoiceId,
          invoiceNumber: 'ERROR',
          invoiceStatus: 'ERROR',
          issue: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }


    return NextResponse.json({
      success: true,
      data: {
        totalPayablesChecked: payablesWithInvoices.length,
        syncIssues: syncIssues.length,
        syncedItems: syncedItems.length,
        issues: syncIssues,
        synced: syncedItems
      }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to check synchronization status' },
      { status: 500 }
    );
  }
}
