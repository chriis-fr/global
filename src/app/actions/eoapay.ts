"use server";

import { sendCeloToken } from "@/lib/payments/celo";
import { getInvoiceById, markInvoicePaid } from "@/lib/db";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

/**
 * Pay invoice directly from an EOA (Externally Owned Account) wallet
 * - payerPrivateKey: private key of the payer (will be converted to Account)
 * - invoiceId: invoice ID to pay
 * - chainId: optional chain ID (defaults to CELO)
 */
export async function payInvoiceDirectEOA({
    payerPrivateKey,
    invoiceId,
    chainId,
}: {
    payerPrivateKey: string | Hex;
    invoiceId: string;
    chainId?: string;
}) {
    // Get invoice from database
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Validate invoice has required blockchain payment fields
    if (!invoice.tokenAddress || !invoice.payeeAddress || !invoice.tokenDecimals) {
        throw new Error("Invoice missing required blockchain payment fields");
    }

    // Convert private key to Account for viem
    const account = privateKeyToAccount(payerPrivateKey as Hex);

    // Get amount from invoice (prefer total, fallback to totalAmount)
    const amount = invoice.total || invoice.totalAmount || 0;
    if (amount <= 0) {
        throw new Error("Invoice amount is invalid");
    }

    // Send token transfer
    // Use chainId from invoice or provided chainId, default to CELO
    const targetChainId = chainId || (invoice.chainId ? invoice.chainId.toString() : undefined);
    
    const txHash = await sendCeloToken({
        signer: account,
        tokenAddress: invoice.tokenAddress as `0x${string}`,
        amount: amount,
        to: invoice.payeeAddress as `0x${string}`,
        decimals: invoice.tokenDecimals,
        chainId: targetChainId,
    });

    // Mark invoice as paid in database
    await markInvoicePaid(invoiceId, {
        status: "paid",
        txHash: txHash as string,
    });

    return {
        success: true,
        txHash,
        invoiceId,
    };
}