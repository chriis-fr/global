"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';

/**
 * Mark a payable as paid with optional transaction hash (for crypto payments)
 */
export async function markPayableAsPaid({
  payableId,
  txHash,
  chainId,
}: {
  payableId: string;
  txHash?: string;
  chainId?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const invoicesCollection = db.collection('invoices');

    // Get payable
    const payable = await payablesCollection.findOne({
      _id: new ObjectId(payableId)
    });

    if (!payable) {
      return { success: false, error: 'Payable not found' };
    }

    // Check permissions
    const isOrganization = !!session.user.organizationId;
    let hasPermission = false;

    if (isOrganization) {
      hasPermission = payable.organizationId?.toString() === session.user.organizationId;
    } else {
      hasPermission = payable.issuerId?.toString() === session.user.id || 
                     payable.userId === session.user.email;
    }

    if (!hasPermission) {
      return { success: false, error: 'You do not have permission to mark this payable as paid' };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: 'paid',
      paymentStatus: 'completed',
      paymentDate: new Date(),
      updatedAt: new Date(),
    };

    // Add transaction hash if provided (for crypto payments)
    if (txHash) {
      updateData.txHash = txHash;
      if (chainId) {
        updateData.chainId = chainId;
      }
    }

    // Update payable
    await payablesCollection.updateOne(
      { _id: new ObjectId(payableId) },
      { $set: updateData }
    );

    // Update related invoice if exists
    if (payable.relatedInvoiceId) {
      const invoiceUpdate: Record<string, unknown> = {
        status: 'paid',
        updatedAt: new Date(),
      };

      if (txHash) {
        invoiceUpdate.txHash = txHash;
        if (chainId) {
          invoiceUpdate.chainId = chainId;
        }
      }

      await invoicesCollection.updateOne(
        { _id: new ObjectId(payable.relatedInvoiceId) },
        { $set: invoiceUpdate }
      );
    }

    // Sync to ledger
    try {
      await LedgerSyncService.syncPayableToLedger({
        ...payable,
        ...updateData,
      } as unknown as Record<string, unknown>);
    } catch (ledgerError) {
      console.error('Error syncing payable to ledger:', ledgerError);
      // Don't fail the whole operation if ledger sync fails
    }

    return {
      success: true,
      message: 'Payable marked as paid successfully'
    };

  } catch (error) {
    console.error('Error marking payable as paid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark payable as paid'
    };
  }
}

