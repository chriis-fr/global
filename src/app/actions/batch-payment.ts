"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/database";
import { ObjectId } from "mongodb";
import type { Invoice } from "@/models/Invoice";
import { getInvoicesByIds } from "@/lib/db";
import { payInvoicesWithSafe } from "./safe-action";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Structured logging for batch payment operations
 */
function logBatchOperation(
    operation: string,
    level: "info" | "success" | "error" | "warn",
    message: string,
    metadata?: Record<string, unknown>
) {
    const timestamp = new Date().toISOString();
    const emoji = {
        info: "ℹ️",
        success: "✅",
        error: "❌",
        warn: "⚠️",
    }[level];

    const logMessage = `${emoji} [Batch Payment] ${operation}: ${message}`;
    
    if (metadata) {
        console.log(logMessage, {
            timestamp,
            ...metadata,
        });
    } else {
        console.log(logMessage, { timestamp });
    }

    if (level === "error") {
        console.error(`❌ [Batch Payment] ${operation} ERROR:`, {
            timestamp,
            message,
            ...metadata,
        });
    }
}

/**
 * Validate that invoices can be batched together
 */
export async function validateBatchPayment({
    invoiceIds,
    organizationId,
}: {
    invoiceIds: string[];
    organizationId?: string;
}) {
    const operation = "validateBatchPayment";
    const startTime = Date.now();

    try {
        logBatchOperation(operation, "info", "Validating batch payment", {
            invoiceCount: invoiceIds.length,
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logBatchOperation(operation, "error", "Unauthorized - no session");
            throw new Error("Unauthorized");
        }

        const invoices = await getInvoicesByIds(invoiceIds);
        if (invoices.length === 0) {
            logBatchOperation(operation, "error", "No invoices found");
            throw new Error("No invoices found");
        }

        if (invoices.length !== invoiceIds.length) {
            logBatchOperation(operation, "warn", "Some invoices not found", {
                requested: invoiceIds.length,
                found: invoices.length,
            });
        }

        // Check all invoices have required blockchain fields
        const firstInvoice = invoices[0];
        const missingFields = invoices.filter(
            (inv) => !inv.tokenAddress || !inv.tokenDecimals || !inv.payeeAddress
        );

        if (missingFields.length > 0) {
            logBatchOperation(operation, "error", "Invoices missing blockchain fields", {
                count: missingFields.length,
            });
            throw new Error(
                `${missingFields.length} invoice(s) missing required blockchain payment fields`
            );
        }

        // Check all invoices use same chain and token
        const allSameChain = invoices.every(
            (inv) => inv.chainId === firstInvoice.chainId
        );
        const allSameToken = invoices.every(
            (inv) => inv.tokenAddress?.toLowerCase() === firstInvoice.tokenAddress?.toLowerCase()
        );

        if (!allSameChain || !allSameToken) {
            logBatchOperation(operation, "warn", "Invoices use different chains/tokens", {
                allSameChain,
                allSameToken,
            });
            return {
                success: false,
                canBatch: false,
                error: "Invoices must use the same blockchain network and token",
                groups: groupInvoicesByCompatibility(invoices),
            };
        }

        // Check invoice statuses
        const invalidStatuses = invoices.filter(
            (inv) => inv.status !== "sent" && inv.status !== "pending"
        );

        if (invalidStatuses.length > 0) {
            logBatchOperation(operation, "warn", "Some invoices have invalid status", {
                count: invalidStatuses.length,
            });
            return {
                success: false,
                canBatch: false,
                error: `${invalidStatuses.length} invoice(s) cannot be paid (wrong status)`,
            };
        }

        const duration = Date.now() - startTime;
        logBatchOperation(operation, "success", "Batch payment validated", {
            invoiceCount: invoices.length,
            chainId: firstInvoice.chainId,
            tokenAddress: firstInvoice.tokenAddress,
            durationMs: duration,
        });

        return {
            success: true,
            canBatch: true,
            invoiceCount: invoices.length,
            chainId: firstInvoice.chainId,
            tokenAddress: firstInvoice.tokenAddress,
            tokenDecimals: firstInvoice.tokenDecimals,
            totalAmount: invoices.reduce(
                (sum, inv) => sum + (inv.total || inv.totalAmount || 0),
                0
            ),
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logBatchOperation(operation, "error", "Validation failed", {
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });

        return {
            success: false,
            canBatch: false,
            error: error instanceof Error ? error.message : "Validation failed",
        };
    }
}

/**
 * Group invoices by chain/token compatibility
 */
function groupInvoicesByCompatibility(invoices: Invoice[]) {
    const groups: Record<string, Invoice[]> = {};

    invoices.forEach((inv) => {
        const key = `${inv.chainId || "unknown"}-${inv.tokenAddress?.toLowerCase() || "unknown"}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(inv);
    });

    return Object.entries(groups).map(([key, groupInvoices]) => ({
        key,
        chainId: groupInvoices[0].chainId,
        tokenAddress: groupInvoices[0].tokenAddress,
        invoices: groupInvoices,
        totalAmount: groupInvoices.reduce(
            (sum, inv) => sum + (inv.total || inv.totalAmount || 0),
            0
        ),
    }));
}

/**
 * Create and execute batch payment
 */
export async function createBatchPayment({
    invoiceIds,
    paymentMethodId,
    organizationId,
    proposerPrivateKey,
}: {
    invoiceIds: string[];
    paymentMethodId: string;
    organizationId?: string;
    proposerPrivateKey?: Hex | string;
}) {
    const operation = "createBatchPayment";
    const startTime = Date.now();

    try {
        logBatchOperation(operation, "info", "Creating batch payment", {
            invoiceCount: invoiceIds.length,
            paymentMethodId,
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logBatchOperation(operation, "error", "Unauthorized - no session");
            throw new Error("Unauthorized");
        }

        // Get payment method
        const db = await connectToDatabase();
        const paymentMethods = db.collection("paymentMethods");
        const paymentMethod = await paymentMethods.findOne({
            _id: new ObjectId(paymentMethodId),
        });

        if (!paymentMethod) {
            logBatchOperation(operation, "error", "Payment method not found", {
                paymentMethodId,
            });
            throw new Error("Payment method not found");
        }

        // Determine organization ID
        const orgId = organizationId
            ? new ObjectId(organizationId)
            : session.user.organizationId
                ? new ObjectId(session.user.organizationId)
                : undefined;

        if (!orgId) {
            logBatchOperation(operation, "error", "Organization ID required");
            throw new Error("Organization ID is required");
        }

        // Get invoices
        const invoices = await getInvoicesByIds(invoiceIds);
        if (invoices.length === 0) {
            throw new Error("No invoices found");
        }

        // Validate batch
        const validation = await validateBatchPayment({
            invoiceIds,
            organizationId: orgId.toString(),
        });

        if (!validation.success || !validation.canBatch) {
            throw new Error(validation.error || "Batch validation failed");
        }

        // Route to appropriate payment handler
        const isSafeWallet =
            paymentMethod.type === "crypto" &&
            paymentMethod.cryptoDetails?.safeDetails;

        if (isSafeWallet) {
            // Pay with Safe wallet
            if (!proposerPrivateKey) {
                throw new Error("Proposer private key required for Safe wallet payments");
            }

            const safeDetails = paymentMethod.cryptoDetails.safeDetails;
            
            // Extract address from private key
            const account = privateKeyToAccount(proposerPrivateKey as Hex);
            const proposerAddress = account.address;

            logBatchOperation(operation, "info", "Processing Safe wallet batch payment", {
                safeAddress: safeDetails.safeAddress,
                proposerAddress: proposerAddress,
            });

            const result = await payInvoicesWithSafe({
                companyId: orgId.toString(),
                invoiceIds,
                proposerAddress: proposerAddress,
                proposerPrivateKey: proposerPrivateKey as Hex,
                chainId: safeDetails.chainId?.toString(),
            });

            const duration = Date.now() - startTime;
            logBatchOperation(operation, "success", "Safe batch payment created", {
                txHash: result.txHash,
                invoiceCount: invoices.length,
                durationMs: duration,
            });

            return {
                success: true,
                txHash: result.txHash,
                safeTxHash: result.txHash,
                invoiceCount: invoices.length,
                paymentMethod: "safe",
            };
        } else {
            // Pay with EOA (for now, this would need to be implemented)
            // For EOA batch payments, we'd need to handle multiple transfers
            throw new Error("EOA batch payments not yet implemented. Use Safe wallet for batch payments.");
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        logBatchOperation(operation, "error", "Batch payment failed", {
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });

        return {
            success: false,
            error: error instanceof Error ? error.message : "Batch payment failed",
        };
    }
}

/**
 * Get batch payment status
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBatchPaymentStatus(_args: {
    txHash?: string;
    safeTxHash?: string;
    chainId?: number;
}): Promise<{
    success: boolean;
    status: string;
    confirmations: number;
}> {
    // This would poll the blockchain/Safe service for transaction status
    // Implementation depends on your status tracking system
    return {
        success: true,
        status: "pending", // pending | confirmed | failed
        confirmations: 0,
    };
}

