"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';

/**
 * Sync all paid invoices to ledger for the current user
 * This fixes missing ledger entries that prevent net balance from updating
 */
export async function syncAllPaidInvoicesToLedger() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const ledgerCollection = db.collection('financial_ledger');

    // Build query for user's invoices
    const isOrganization = !!session.user.organizationId;
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { ownerId: session.user.email },
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get all paid invoices
    const paidInvoices = await invoicesCollection.find({
      ...baseQuery,
      status: 'paid'
    }).toArray();

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const invoice of paidInvoices) {
      try {
        // Check if ledger entry exists
        const existingEntry = await ledgerCollection.findOne({
          $or: [
            { relatedInvoiceId: invoice._id },
            { entryId: invoice.invoiceNumber }
          ],
          type: 'receivable'
        });

        if (existingEntry) {
          // Update existing entry to ensure it's marked as paid and has correct ownerId
          const ownerId = isOrganization ? session.user.organizationId : session.user.email;
          
          await ledgerCollection.updateOne(
            { _id: existingEntry._id },
            {
              $set: {
                status: 'paid',
                ownerId: ownerId,
                updatedAt: new Date()
              }
            }
          );
          updated++;
        } else {
          // Create new ledger entry
          await LedgerSyncService.syncInvoiceToLedger(invoice as unknown as Record<string, unknown>);
          synced++;
        }
      } catch (error) {
        console.error(`Error syncing invoice ${invoice._id}:`, error);
        errors++;
      }
    }

    return {
      success: true,
      message: `Synced ${synced} new entries, updated ${updated} existing entries. ${errors} errors.`,
      synced,
      updated,
      errors,
      total: paidInvoices.length
    };

  } catch (error) {
    console.error('Error syncing paid invoices to ledger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync invoices'
    };
  }
}

/**
 * Sync all paid payables to ledger for the current user
 */
export async function syncAllPaidPayablesToLedger() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const ledgerCollection = db.collection('financial_ledger');

    // Build query for user's payables
    const isOrganization = !!session.user.organizationId;
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get all paid payables
    const paidPayables = await payablesCollection.find({
      ...baseQuery,
      status: 'paid'
    }).toArray();

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const payable of paidPayables) {
      try {
        // Check if ledger entry exists
        const existingEntry = await ledgerCollection.findOne({
          $or: [
            { relatedPayableId: payable._id },
            { entryId: payable.payableNumber }
          ],
          type: 'payable'
        });

        if (existingEntry) {
          // Update existing entry to ensure it's marked as paid and has correct ownerId
          const ownerId = isOrganization ? session.user.organizationId : session.user.email;
          
          await ledgerCollection.updateOne(
            { _id: existingEntry._id },
            {
              $set: {
                status: 'paid',
                ownerId: ownerId,
                updatedAt: new Date()
              }
            }
          );
          updated++;
        } else {
          // Create new ledger entry
          await LedgerSyncService.syncPayableToLedger(payable as unknown as Record<string, unknown>);
          synced++;
        }
      } catch (error) {
        console.error(`Error syncing payable ${payable._id}:`, error);
        errors++;
      }
    }

    return {
      success: true,
      message: `Synced ${synced} new entries, updated ${updated} existing entries. ${errors} errors.`,
      synced,
      updated,
      errors,
      total: paidPayables.length
    };

  } catch (error) {
    console.error('Error syncing paid payables to ledger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync payables'
    };
  }
}

