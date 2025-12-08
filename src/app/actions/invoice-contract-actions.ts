"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/database";
import { ObjectId } from "mongodb";
import {
  getInvoiceFromContract,
  isInvoicePaidOnChain,
  getContractFeeConfig,
  getInvoiceManagerContractAddress,
} from "@/lib/contracts/invoiceManager";
import type { Invoice } from "@/models/Invoice";

/**
 * Sync invoice payment status from blockchain
 * Checks if invoice is paid on-chain and updates database
 */
export async function syncInvoicePaymentStatus(invoiceId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection<Invoice>("invoices");

    // Get invoice from database
    const invoice = await invoicesCollection.findOne({
      _id: new ObjectId(invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Check if invoice is paid on-chain (only for crypto invoices)
    if (invoice.paymentSettings?.method === "crypto" && invoice.chainId) {
      const isPaid = await isInvoicePaidOnChain(
        invoice.invoiceNumber || invoiceId,
        invoice.chainId
      );

      if (isPaid && invoice.status !== "paid") {
        // Update invoice status to paid
        await invoicesCollection.updateOne(
          { _id: new ObjectId(invoiceId) },
          {
            $set: {
              status: "paid",
              paidAt: new Date(),
            },
          }
        );

        return {
          success: true,
          updated: true,
          message: "Invoice marked as paid from blockchain",
        };
      }
    }

    return {
      success: true,
      updated: false,
      message: "Invoice status is up to date",
    };
  } catch (error) {
    console.error("Error syncing invoice payment status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get invoice status from blockchain
 */
export async function getInvoiceContractStatus(invoiceId: string, chainId?: number) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection<Invoice>("invoices");

    const invoice = await invoicesCollection.findOne({
      _id: new ObjectId(invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const targetChainId = chainId || invoice.chainId || 42220;
    const contractInvoiceId = invoice.invoiceNumber || invoiceId;

    const contractData = await getInvoiceFromContract(contractInvoiceId, targetChainId);

    if (!contractData) {
      return {
        success: true,
        exists: false,
        message: "Invoice not found on blockchain",
      };
    }

    return {
      success: true,
      exists: true,
      data: {
        issuer: contractData.issuer,
        payer: contractData.payer,
        token: contractData.token,
        amount: contractData.amount.toString(),
        paid: contractData.paid,
      },
    };
  } catch (error) {
    console.error("Error getting invoice contract status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get contract fee configuration
 */
export async function getInvoiceManagerFeeConfig(chainId: number = 42220) {
  try {
    const config = await getContractFeeConfig(chainId);
    
    if (!config) {
      return { success: false, error: "Failed to fetch fee configuration" };
    }

    return {
      success: true,
      data: {
        feePercentage: config.feePercentage,
        feeThreshold: config.feeThreshold.toString(),
        feeRecipient: config.feeRecipient,
        contractAddress: getInvoiceManagerContractAddress(chainId),
      },
    };
  } catch (error) {
    console.error("Error getting fee config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

