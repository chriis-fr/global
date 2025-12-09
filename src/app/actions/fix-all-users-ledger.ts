"use server";

import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';

/**
 * Fix ledger entries for all users
 * This syncs all paid invoices and payables to ledger with correct ownerId
 * Only fixes missing or incorrect entries, doesn't touch existing correct data
 */
export async function fixAllUsersLedgerEntries() {
  try {
    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const payablesCollection = db.collection('payables');
    const ledgerCollection = db.collection('financial_ledger');
    const usersCollection = db.collection('users');

    // Get all users
    const users = await usersCollection.find({}).toArray();
    
    let totalUsersProcessed = 0;
    let totalInvoicesSynced = 0;
    let totalPayablesSynced = 0;
    let totalEntriesUpdated = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const userEmail = user.email;
        const userId = user._id.toString();
        const organizationId = user.organizationId;
        const isOrganization = !!organizationId;
        
        // Determine ownerId
        const ownerId = isOrganization ? organizationId.toString() : userEmail;

        // Build query for this user's invoices
        const invoiceQuery = isOrganization 
          ? { 
              $or: [
                { organizationId: organizationId },
                { organizationId: new ObjectId(organizationId) }
              ]
            }
          : { 
              $or: [
                { ownerId: userEmail },
                { issuerId: userId },
                { userId: userEmail }
              ]
            };

        // Get all paid invoices for this user
        const paidInvoices = await invoicesCollection.find({
          ...invoiceQuery,
          status: 'paid'
        }).toArray();

        // Sync each paid invoice
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
              // Update existing entry to ensure correct ownerId and status
              await ledgerCollection.updateOne(
                { _id: existingEntry._id },
                {
                  $set: {
                    status: 'paid',
                    ownerId: ownerId,
                    ownerType: isOrganization ? 'organization' : 'individual',
                    updatedAt: new Date()
                  }
                }
              );
              totalEntriesUpdated++;
            } else {
              // Create new ledger entry
              await LedgerSyncService.syncInvoiceToLedger(invoice as unknown as Record<string, unknown>);
              totalInvoicesSynced++;
            }
          } catch (error) {
            errors.push(`Invoice ${invoice._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Build query for this user's payables
        const payableQuery = isOrganization 
          ? { 
              $or: [
                { organizationId: organizationId },
                { organizationId: new ObjectId(organizationId) }
              ]
            }
          : { 
              $or: [
                { issuerId: userId },
                { userId: userEmail }
              ]
            };

        // Get all paid payables for this user
        const paidPayables = await payablesCollection.find({
          ...payableQuery,
          status: 'paid'
        }).toArray();

        // Sync each paid payable
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
              // Update existing entry to ensure correct ownerId and status
              await ledgerCollection.updateOne(
                { _id: existingEntry._id },
                {
                  $set: {
                    status: 'paid',
                    ownerId: ownerId,
                    ownerType: isOrganization ? 'organization' : 'individual',
                    updatedAt: new Date()
                  }
                }
              );
              totalEntriesUpdated++;
            } else {
              // Create new ledger entry
              await LedgerSyncService.syncPayableToLedger(payable as unknown as Record<string, unknown>);
              totalPayablesSynced++;
            }
          } catch (error) {
            errors.push(`Payable ${payable._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        totalUsersProcessed++;
      } catch (error) {
        errors.push(`User ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: true,
      message: `Fixed ledger entries for ${totalUsersProcessed} users`,
      stats: {
        usersProcessed: totalUsersProcessed,
        invoicesSynced: totalInvoicesSynced,
        payablesSynced: totalPayablesSynced,
        entriesUpdated: totalEntriesUpdated,
        errors: errors.length,
        errorDetails: errors.slice(0, 10) // First 10 errors
      }
    };

  } catch (error) {
    console.error('Error fixing all users ledger entries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fix ledger entries'
    };
  }
}

