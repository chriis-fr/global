"use server";

import { connectToDatabase } from "@/lib/database";
import { ObjectId } from "mongodb";
import type { Organization } from "@/models/Organization";
import type { Invoice, InvoiceStatus } from "@/models/Invoice";

/**
 * Database helper functions for Safe wallet operations
 * These functions are additive and don't modify existing functionality
 */

/**
 * Get company/organization by ID
 */
export async function getCompanyById(companyId: string): Promise<Organization | null> {
  try {
    const db = await connectToDatabase();
    const organizations = db.collection<Organization>("organizations");
    
    const company = await organizations.findOne({ 
      _id: new ObjectId(companyId) 
    });
    
    return company;
  } catch (error) {
    console.error("Error fetching company:", error);
    return null;
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  try {
    const db = await connectToDatabase();
    const invoices = db.collection<Invoice>("invoices");
    
    const invoice = await invoices.findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    return invoice;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }
}

/**
 * Get multiple invoices by IDs
 */
export async function getInvoicesByIds(invoiceIds: string[]): Promise<Invoice[]> {
  try {
    const db = await connectToDatabase();
    const invoices = db.collection<Invoice>("invoices");
    
    const objectIds = invoiceIds.map(id => new ObjectId(id));
    const invoiceList = await invoices.find({ 
      _id: { $in: objectIds } 
    }).toArray();
    
    return invoiceList;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }
}

/**
 * Mark a single invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: string,
  updateData?: { status?: InvoiceStatus; txHash?: string; safeTxHash?: string }
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const invoices = db.collection<Invoice>("invoices");
    
    // Get invoice first to sync to ledger
    const invoice = await invoices.findOne({ _id: new ObjectId(invoiceId) });
    if (!invoice) {
      return false;
    }
    
    const update: Partial<Invoice> & { txHash?: string; safeTxHash?: string } = {
      status: (updateData?.status || "paid") as InvoiceStatus,
      updatedAt: new Date(),
    };
    
    if (updateData?.txHash) {
      update.txHash = updateData.txHash;
    }
    
    if (updateData?.safeTxHash) {
      update.safeTxHash = updateData.safeTxHash;
    }
    
    const result = await invoices.updateOne(
      { _id: new ObjectId(invoiceId) },
      { $set: update }
    );
    
    // Sync to ledger if status is 'paid'
    if ((updateData?.status || "paid") === "paid" && result.modifiedCount > 0) {
      try {
        const { LedgerSyncService } = await import("@/lib/services/ledgerSyncService");
        await LedgerSyncService.syncInvoiceToLedger(invoice as unknown as Record<string, unknown>);
      } catch (ledgerError) {
        console.error("Error syncing invoice to ledger:", ledgerError);
        // Don't fail the invoice update if ledger sync fails
      }
    }
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error("Error marking invoice as paid:", error);
    return false;
  }
}

/**
 * Mark multiple invoices as paid/proposed
 */
export async function markInvoicesPaid(
  invoiceIds: string[],
  updateData?: { status?: InvoiceStatus; txHash?: string; safeTxHash?: string }
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const invoices = db.collection<Invoice>("invoices");
    
    const objectIds = invoiceIds.map(id => new ObjectId(id));
    
    const update: Partial<Invoice> & { txHash?: string; safeTxHash?: string } = {
      status: (updateData?.status || "paid") as InvoiceStatus,
      updatedAt: new Date(),
    };
    
    if (updateData?.txHash) {
      update.txHash = updateData.txHash;
    }
    
    if (updateData?.safeTxHash) {
      update.safeTxHash = updateData.safeTxHash;
    }
    
    const result = await invoices.updateMany(
      { _id: { $in: objectIds } },
      { $set: update }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error("Error marking invoices as paid:", error);
    return false;
  }
}

/**
 * Update organization with Safe wallet information
 */
export async function updateOrganizationSafeWallet(
  organizationId: string,
  safeData: {
    safeAddress: string;
    safeOwners: string[];
    safeThreshold: number;
  }
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const organizations = db.collection<Organization>("organizations");
    
    const result = await organizations.updateOne(
      { _id: new ObjectId(organizationId) },
      { 
        $set: {
          safeAddress: safeData.safeAddress,
          safeOwners: safeData.safeOwners,
          safeThreshold: safeData.safeThreshold,
          updatedAt: new Date(),
        }
      }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error("Error updating organization Safe wallet:", error);
    return false;
  }
}

