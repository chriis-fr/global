import { connectToDatabase } from '@/lib/database';
import { FinancialLedgerEntry, LedgerEntryType } from '@/models/FinancialLedger';
import { ObjectId } from 'mongodb';

export class LedgerSyncService {
  /**
   * Sync an invoice to the financial ledger
   */
  static async syncInvoiceToLedger(invoice: any): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      // Check if this invoice is already synced
      const existingEntry = await ledgerCollection.findOne({
        relatedInvoiceId: new ObjectId(invoice._id)
      });

      if (existingEntry) {
        // Update existing entry
        return await this.updateLedgerEntryFromInvoice(existingEntry._id, invoice);
      }

      // Create new ledger entry from invoice
      const ledgerEntry: FinancialLedgerEntry = {
        entryId: invoice.invoiceNumber || `INV-${invoice._id}`,
        type: 'receivable',
        ownerId: invoice.ownerId || invoice.userId,
        ownerType: invoice.ownerType || 'individual',
        userId: invoice.userId,
        organizationId: invoice.organizationId,
        issuerId: invoice.issuerId || invoice.userId,
        relatedInvoiceId: new ObjectId(invoice._id),
        counterparty: {
          name: invoice.clientName || invoice.clientDetails?.firstName || 'Unknown Client',
          email: invoice.clientEmail || invoice.clientDetails?.email || '',
          phone: invoice.clientPhone || invoice.clientDetails?.phone,
          company: invoice.clientCompany || invoice.clientDetails?.companyName,
          address: {
            street: invoice.clientAddress?.street || invoice.clientDetails?.addressLine1,
            city: invoice.clientAddress?.city || invoice.clientDetails?.city,
            state: invoice.clientAddress?.state || invoice.clientDetails?.region,
            zipCode: invoice.clientAddress?.zipCode || invoice.clientDetails?.postalCode,
            country: invoice.clientAddress?.country || invoice.clientDetails?.country
          }
        },
        amount: invoice.total || invoice.totalAmount || 0,
        currency: invoice.currency || 'USD',
        subtotal: invoice.subtotal || 0,
        totalTax: invoice.totalTax || 0,
        items: (invoice.items || []).map((item: any) => ({
          id: item.id || `item-${Date.now()}`,
          description: item.description || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          amount: item.amount || 0
        })),
        paymentDetails: {
          method: invoice.paymentMethod || 'fiat',
          network: invoice.paymentNetwork,
          address: invoice.paymentAddress,
          bankName: invoice.bankName,
          accountNumber: invoice.accountNumber,
          routingNumber: invoice.routingNumber,
          swiftCode: invoice.swiftCode,
          paybillNumber: invoice.paybillNumber,
          tillNumber: invoice.tillNumber,
          mpesaAccountNumber: invoice.mpesaAccountNumber
        },
        issueDate: new Date(invoice.issueDate),
        dueDate: new Date(invoice.dueDate),
        status: this.mapInvoiceStatusToLedgerStatus(invoice.status),
        priority: 'medium',
        category: 'Invoice',
        notes: invoice.memo || invoice.notes,
        memo: invoice.memo,
        approvalWorkflow: invoice.approvalWorkflow,
        createdAt: new Date(invoice.createdAt),
        updatedAt: new Date(invoice.updatedAt),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      const result = await ledgerCollection.insertOne(ledgerEntry);
      
      console.log('✅ [LedgerSync] Invoice synced to ledger:', {
        invoiceId: invoice._id,
        ledgerEntryId: result.insertedId,
        entryId: ledgerEntry.entryId
      });

      return { _id: result.insertedId, ...ledgerEntry };
    } catch (error) {
      console.error('❌ [LedgerSync] Error syncing invoice to ledger:', error);
      return null;
    }
  }

  /**
   * Sync a payable to the financial ledger
   */
  static async syncPayableToLedger(payable: any): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      // Check if this payable is already synced
      const existingEntry = await ledgerCollection.findOne({
        relatedPayableId: new ObjectId(payable._id)
      });

      if (existingEntry) {
        // Update existing entry
        return await this.updateLedgerEntryFromPayable(existingEntry._id, payable);
      }

      // Create new ledger entry from payable
      const ledgerEntry: FinancialLedgerEntry = {
        entryId: payable.payableNumber || `PAY-${payable._id}`,
        type: 'payable',
        ownerId: payable.ownerId || payable.userId,
        ownerType: payable.ownerType || 'individual',
        userId: payable.userId,
        organizationId: payable.organizationId,
        issuerId: payable.issuerId || payable.userId,
        relatedPayableId: new ObjectId(payable._id),
        counterparty: {
          name: payable.vendorName || 'Unknown Vendor',
          email: payable.vendorEmail || '',
          phone: payable.vendorPhone,
          company: payable.vendorCompany,
          address: {
            street: payable.vendorAddress?.street,
            city: payable.vendorAddress?.city,
            state: payable.vendorAddress?.state,
            zipCode: payable.vendorAddress?.zipCode,
            country: payable.vendorAddress?.country
          }
        },
        amount: payable.total || 0,
        currency: payable.currency || 'USD',
        subtotal: payable.subtotal || 0,
        totalTax: payable.totalTax || 0,
        items: (payable.items || []).map((item: any) => ({
          id: item.id || `item-${Date.now()}`,
          description: item.description || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          amount: item.amount || 0
        })),
        paymentDetails: {
          method: payable.paymentMethod || 'fiat',
          network: payable.paymentNetwork,
          address: payable.paymentAddress,
          bankName: payable.bankName,
          accountNumber: payable.accountNumber,
          routingNumber: payable.routingNumber
        },
        issueDate: new Date(payable.issueDate),
        dueDate: new Date(payable.dueDate),
        status: this.mapPayableStatusToLedgerStatus(payable.status),
        priority: payable.priority || 'medium',
        category: payable.category || 'General',
        notes: payable.memo || payable.notes,
        memo: payable.memo,
        approvalWorkflow: payable.approvalWorkflow,
        createdAt: new Date(payable.createdAt),
        updatedAt: new Date(payable.updatedAt),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      const result = await ledgerCollection.insertOne(ledgerEntry);
      
      console.log('✅ [LedgerSync] Payable synced to ledger:', {
        payableId: payable._id,
        ledgerEntryId: result.insertedId,
        entryId: ledgerEntry.entryId
      });

      return { _id: result.insertedId, ...ledgerEntry };
    } catch (error) {
      console.error('❌ [LedgerSync] Error syncing payable to ledger:', error);
      return null;
    }
  }

  /**
   * Update existing ledger entry from invoice changes
   */
  private static async updateLedgerEntryFromInvoice(ledgerEntryId: ObjectId, invoice: any): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      const updateData = {
        amount: invoice.total || invoice.totalAmount || 0,
        currency: invoice.currency || 'USD',
        subtotal: invoice.subtotal || 0,
        totalTax: invoice.totalTax || 0,
        items: (invoice.items || []).map((item: any) => ({
          id: item.id || `item-${Date.now()}`,
          description: item.description || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          amount: item.amount || 0
        })),
        status: this.mapInvoiceStatusToLedgerStatus(invoice.status),
        notes: invoice.memo || invoice.notes,
        memo: invoice.memo,
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      await ledgerCollection.updateOne(
        { _id: ledgerEntryId },
        { $set: updateData }
      );

      const updatedEntry = await ledgerCollection.findOne({ _id: ledgerEntryId });
      return updatedEntry;
    } catch (error) {
      console.error('❌ [LedgerSync] Error updating ledger entry from invoice:', error);
      return null;
    }
  }

  /**
   * Update existing ledger entry from payable changes
   */
  private static async updateLedgerEntryFromPayable(ledgerEntryId: ObjectId, payable: any): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      const updateData = {
        amount: payable.total || 0,
        currency: payable.currency || 'USD',
        subtotal: payable.subtotal || 0,
        totalTax: payable.totalTax || 0,
        items: (payable.items || []).map((item: any) => ({
          id: item.id || `item-${Date.now()}`,
          description: item.description || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          amount: item.amount || 0
        })),
        status: this.mapPayableStatusToLedgerStatus(payable.status),
        priority: payable.priority || 'medium',
        category: payable.category || 'General',
        notes: payable.memo || payable.notes,
        memo: payable.memo,
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      await ledgerCollection.updateOne(
        { _id: ledgerEntryId },
        { $set: updateData }
      );

      const updatedEntry = await ledgerCollection.findOne({ _id: ledgerEntryId });
      return updatedEntry;
    } catch (error) {
      console.error('❌ [LedgerSync] Error updating ledger entry from payable:', error);
      return null;
    }
  }

  /**
   * Map invoice status to ledger status
   */
  private static mapInvoiceStatusToLedgerStatus(invoiceStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'draft': 'draft',
      'sent': 'pending',
      'pending': 'pending',
      'paid': 'paid',
      'overdue': 'overdue',
      'cancelled': 'cancelled'
    };
    return statusMap[invoiceStatus] || 'draft';
  }

  /**
   * Map payable status to ledger status
   */
  private static mapPayableStatusToLedgerStatus(payableStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'draft': 'draft',
      'pending': 'pending',
      'approved': 'pending',
      'paid': 'paid',
      'overdue': 'overdue',
      'cancelled': 'cancelled'
    };
    return statusMap[payableStatus] || 'draft';
  }

  /**
   * Sync all existing invoices and payables to the ledger
   */
  static async syncAllExistingData(): Promise<{ invoicesSynced: number; payablesSynced: number }> {
    try {
      const db = await connectToDatabase();
      
      // Sync all invoices
      const invoices = await db.collection('invoices').find({}).toArray();
      let invoicesSynced = 0;
      
      for (const invoice of invoices) {
        const result = await this.syncInvoiceToLedger(invoice);
        if (result) invoicesSynced++;
      }

      // Sync all payables
      const payables = await db.collection('payables').find({}).toArray();
      let payablesSynced = 0;
      
      for (const payable of payables) {
        const result = await this.syncPayableToLedger(payable);
        if (result) payablesSynced++;
      }

      console.log('✅ [LedgerSync] Sync completed:', {
        invoicesSynced,
        payablesSynced
      });

      return { invoicesSynced, payablesSynced };
    } catch (error) {
      console.error('❌ [LedgerSync] Error syncing all existing data:', error);
      return { invoicesSynced: 0, payablesSynced: 0 };
    }
  }
}
