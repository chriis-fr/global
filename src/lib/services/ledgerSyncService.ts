import { connectToDatabase } from '@/lib/database';
import { FinancialLedgerEntry, PaymentMethodType, LedgerEntryStatus } from '@/models/FinancialLedger';
import { ObjectId } from 'mongodb';

export class LedgerSyncService {
  /**
   * Sync an invoice to the financial ledger
   */
  static async syncInvoiceToLedger(invoice: Record<string, unknown>): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      // Check if this invoice is already synced
      const existingEntry = await ledgerCollection.findOne({
        relatedInvoiceId: new ObjectId(invoice._id as string)
      });

      if (existingEntry) {
        // Update existing entry
        return await this.updateLedgerEntryFromInvoice(existingEntry._id, invoice);
      }

      // Create new ledger entry from invoice
      const ledgerEntry: FinancialLedgerEntry = {
        entryId: (invoice.invoiceNumber as string) || `INV-${invoice._id}`,
        type: 'receivable',
        ownerId: (invoice.ownerId as string) || (invoice.userId as string),
        ownerType: (invoice.ownerType as 'individual' | 'organization') || 'individual',
        userId: invoice.userId as string,
        organizationId: invoice.organizationId as string,
        issuerId: (invoice.issuerId as string) || (invoice.userId as string),
        relatedInvoiceId: new ObjectId(invoice._id as string),
        counterparty: {
          name: (invoice.clientName as string) || ((invoice.clientDetails as Record<string, unknown>)?.firstName as string) || 'Unknown Client',
          email: (invoice.clientEmail as string) || ((invoice.clientDetails as Record<string, unknown>)?.email as string) || '',
          phone: (invoice.clientPhone as string) || ((invoice.clientDetails as Record<string, unknown>)?.phone as string),
          company: (invoice.clientCompany as string) || ((invoice.clientDetails as Record<string, unknown>)?.companyName as string),
          address: {
            street: ((invoice.clientAddress as Record<string, unknown>)?.street as string) || ((invoice.clientDetails as Record<string, unknown>)?.addressLine1 as string),
            city: ((invoice.clientAddress as Record<string, unknown>)?.city as string) || ((invoice.clientDetails as Record<string, unknown>)?.city as string),
            state: ((invoice.clientAddress as Record<string, unknown>)?.state as string) || ((invoice.clientDetails as Record<string, unknown>)?.region as string),
            zipCode: ((invoice.clientAddress as Record<string, unknown>)?.zipCode as string) || ((invoice.clientDetails as Record<string, unknown>)?.postalCode as string),
            country: ((invoice.clientAddress as Record<string, unknown>)?.country as string) || ((invoice.clientDetails as Record<string, unknown>)?.country as string)
          }
        },
        amount: (invoice.total as number) || (invoice.totalAmount as number) || 0,
        currency: (invoice.currency as string) || 'USD',
        subtotal: (invoice.subtotal as number) || 0,
        totalTax: (invoice.totalTax as number) || 0,
        items: ((invoice.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
          id: (item.id as string) || `item-${Date.now()}`,
          description: (item.description as string) || '',
          quantity: (item.quantity as number) || 0,
          unitPrice: (item.unitPrice as number) || 0,
          discount: (item.discount as number) || 0,
          tax: (item.tax as number) || 0,
          amount: (item.amount as number) || 0
        })),
        paymentDetails: {
          method: (invoice.paymentMethod as PaymentMethodType) || 'fiat',
          network: invoice.paymentNetwork as string,
          address: invoice.paymentAddress as string,
          bankName: invoice.bankName as string,
          accountNumber: invoice.accountNumber as string,
          routingNumber: invoice.routingNumber as string,
          swiftCode: invoice.swiftCode as string,
          paybillNumber: invoice.paybillNumber as string,
          tillNumber: invoice.tillNumber as string,
          mpesaAccountNumber: invoice.mpesaAccountNumber as string
        },
        issueDate: new Date(invoice.issueDate as string | number | Date),
        dueDate: new Date(invoice.dueDate as string | number | Date),
        status: this.mapInvoiceStatusToLedgerStatus(invoice.status as string),
        priority: 'medium',
        category: 'Invoice',
        notes: (invoice.memo as string) || (invoice.notes as string),
        memo: invoice.memo as string,
        approvalWorkflow: undefined,
        createdAt: new Date(invoice.createdAt as string | number | Date),
        updatedAt: new Date(invoice.updatedAt as string | number | Date),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      const result = await ledgerCollection.insertOne(ledgerEntry);
      
        invoiceId: invoice._id,
        ledgerEntryId: result.insertedId,
        entryId: ledgerEntry.entryId
      });

      return { _id: result.insertedId, ...ledgerEntry };
    } catch (error) {
      return null;
    }
  }

  /**
   * Sync a payable to the financial ledger
   */
  static async syncPayableToLedger(payable: Record<string, unknown>): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      // Check if this payable is already synced
      const existingEntry = await ledgerCollection.findOne({
        relatedPayableId: new ObjectId(payable._id as string)
      });

      if (existingEntry) {
        // Update existing entry
        return await this.updateLedgerEntryFromPayable(existingEntry._id, payable);
      }

      // Create new ledger entry from payable
      const ledgerEntry: FinancialLedgerEntry = {
        entryId: (payable.payableNumber as string) || `PAY-${payable._id}`,
        type: 'payable',
        ownerId: (payable.ownerId as string) || (payable.userId as string),
        ownerType: (payable.ownerType as 'individual' | 'organization') || 'individual',
        userId: payable.userId as string,
        organizationId: payable.organizationId as string,
        issuerId: (payable.issuerId as string) || (payable.userId as string),
        relatedPayableId: new ObjectId(payable._id as string),
        counterparty: {
          name: (payable.vendorName as string) || 'Unknown Vendor',
          email: (payable.vendorEmail as string) || '',
          phone: payable.vendorPhone as string,
          company: payable.vendorCompany as string,
          address: {
            street: ((payable.vendorAddress as Record<string, unknown>)?.street as string),
            city: ((payable.vendorAddress as Record<string, unknown>)?.city as string),
            state: ((payable.vendorAddress as Record<string, unknown>)?.state as string),
            zipCode: ((payable.vendorAddress as Record<string, unknown>)?.zipCode as string),
            country: ((payable.vendorAddress as Record<string, unknown>)?.country as string)
          }
        },
        amount: (payable.total as number) || 0,
        currency: (payable.currency as string) || 'USD',
        subtotal: (payable.subtotal as number) || 0,
        totalTax: (payable.totalTax as number) || 0,
        items: ((payable.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
          id: (item.id as string) || `item-${Date.now()}`,
          description: (item.description as string) || '',
          quantity: (item.quantity as number) || 0,
          unitPrice: (item.unitPrice as number) || 0,
          discount: (item.discount as number) || 0,
          tax: (item.tax as number) || 0,
          amount: (item.amount as number) || 0
        })),
        paymentDetails: {
          method: (payable.paymentMethod as PaymentMethodType) || 'fiat',
          network: payable.paymentNetwork as string,
          address: payable.paymentAddress as string,
          bankName: payable.bankName as string,
          accountNumber: payable.accountNumber as string,
          routingNumber: payable.routingNumber as string
        },
        issueDate: new Date(payable.issueDate as string | number | Date),
        dueDate: new Date(payable.dueDate as string | number | Date),
        status: this.mapPayableStatusToLedgerStatus(payable.status as string),
        priority: (payable.priority as 'low' | 'medium' | 'high') || 'medium',
        category: (payable.category as string) || 'General',
        notes: (payable.memo as string) || (payable.notes as string),
        memo: payable.memo as string,
        approvalWorkflow: undefined,
        createdAt: new Date(payable.createdAt as string | number | Date),
        updatedAt: new Date(payable.updatedAt as string | number | Date),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      const result = await ledgerCollection.insertOne(ledgerEntry);
      
        payableId: payable._id,
        ledgerEntryId: result.insertedId,
        entryId: ledgerEntry.entryId
      });

      return { _id: result.insertedId, ...ledgerEntry };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update existing ledger entry from invoice changes
   */
  private static async updateLedgerEntryFromInvoice(ledgerEntryId: ObjectId, invoice: Record<string, unknown>): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      const updateData = {
        amount: (invoice.total as number) || (invoice.totalAmount as number) || 0,
        currency: (invoice.currency as string) || 'USD',
        subtotal: (invoice.subtotal as number) || 0,
        totalTax: (invoice.totalTax as number) || 0,
        items: ((invoice.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
          id: (item.id as string) || `item-${Date.now()}`,
          description: (item.description as string) || '',
          quantity: (item.quantity as number) || 0,
          unitPrice: (item.unitPrice as number) || 0,
          discount: (item.discount as number) || 0,
          tax: (item.tax as number) || 0,
          amount: (item.amount as number) || 0
        })),
        status: this.mapInvoiceStatusToLedgerStatus(invoice.status as string),
        notes: (invoice.memo as string) || (invoice.notes as string),
        memo: invoice.memo as string,
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      await ledgerCollection.updateOne(
        { _id: ledgerEntryId },
        { $set: updateData }
      );

      const updatedEntry = await ledgerCollection.findOne({ _id: ledgerEntryId });
      return updatedEntry as FinancialLedgerEntry;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update existing ledger entry from payable changes
   */
  private static async updateLedgerEntryFromPayable(ledgerEntryId: ObjectId, payable: Record<string, unknown>): Promise<FinancialLedgerEntry | null> {
    try {
      const db = await connectToDatabase();
      const ledgerCollection = db.collection('financial_ledger');

      const updateData = {
        amount: (payable.total as number) || 0,
        currency: (payable.currency as string) || 'USD',
        subtotal: (payable.subtotal as number) || 0,
        totalTax: (payable.totalTax as number) || 0,
        items: ((payable.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => ({
          id: (item.id as string) || `item-${Date.now()}`,
          description: (item.description as string) || '',
          quantity: (item.quantity as number) || 0,
          unitPrice: (item.unitPrice as number) || 0,
          discount: (item.discount as number) || 0,
          tax: (item.tax as number) || 0,
          amount: (item.amount as number) || 0
        })),
        status: this.mapPayableStatusToLedgerStatus(payable.status as string),
        priority: (payable.priority as 'low' | 'medium' | 'high') || 'medium',
        category: (payable.category as string) || 'General',
        notes: (payable.memo as string) || (payable.notes as string),
        memo: payable.memo as string,
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      await ledgerCollection.updateOne(
        { _id: ledgerEntryId },
        { $set: updateData }
      );

      const updatedEntry = await ledgerCollection.findOne({ _id: ledgerEntryId });
      return updatedEntry as FinancialLedgerEntry;
    } catch (error) {
      return null;
    }
  }

  /**
   * Map invoice status to ledger status
   */
  private static mapInvoiceStatusToLedgerStatus(invoiceStatus: string): LedgerEntryStatus {
    const statusMap: { [key: string]: LedgerEntryStatus } = {
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
  private static mapPayableStatusToLedgerStatus(payableStatus: string): LedgerEntryStatus {
    const statusMap: { [key: string]: LedgerEntryStatus } = {
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

        invoicesSynced,
        payablesSynced
      });

      return { invoicesSynced, payablesSynced };
    } catch (error) {
      return { invoicesSynced: 0, payablesSynced: 0 };
    }
  }
}
