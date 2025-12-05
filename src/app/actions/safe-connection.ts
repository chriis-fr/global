"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/database";
import { ObjectId } from "mongodb";
import type { PaymentMethod, SafeWalletDetails } from "@/models/PaymentMethod";
import { getChainById, DEFAULT_CHAIN } from "@/lib/chains";
import { paymentMethodService } from "@/lib/services/paymentMethodService";
import { UserService } from "@/lib/services/userService";

/**
 * Structured logging for Safe wallet operations
 */
function logSafeOperation(
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

    const logMessage = `${emoji} [Safe Connection] ${operation}: ${message}`;
    
    if (metadata) {
        console.log(logMessage, {
            timestamp,
            ...metadata,
        });
    } else {
        console.log(logMessage, { timestamp });
    }

    // Log errors to console.error for better visibility
    if (level === "error") {
        console.error(`❌ [Safe Connection] ${operation} ERROR:`, {
            timestamp,
            message,
            ...metadata,
        });
    }
}

/**
 * Import an existing Safe wallet by fetching its metadata from the blockchain
 * This is the easiest way - just provide the Safe address
 */
export async function importExistingSafe({
    safeAddress,
    chainId,
    name,
    organizationId,
}: {
    safeAddress: string;
    chainId?: string;
    name?: string;
    organizationId?: string;
}) {
    const operation = "importExistingSafe";
    const startTime = Date.now();
    
    try {
        logSafeOperation(operation, "info", "Starting Safe wallet import", {
            safeAddress: safeAddress.toLowerCase(),
            chainId: chainId || "default",
            hasName: !!name,
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logSafeOperation(operation, "error", "Unauthorized - no session", {
                userId: session?.user?.id,
            });
            throw new Error("Unauthorized");
        }

        logSafeOperation(operation, "info", "Session validated", {
            userId: session.user.id,
            userEmail: session.user.email,
        });

        // Use provided chainId or default to CELO
        const targetChainId = chainId || DEFAULT_CHAIN.id;
        const chainConfig = getChainById(targetChainId);
        if (!chainConfig) {
            logSafeOperation(operation, "error", "Chain not found", {
                chainId: targetChainId,
            });
            throw new Error(`Chain not found or not enabled: ${targetChainId}`);
        }

        logSafeOperation(operation, "info", "Fetching Safe info from blockchain", {
            safeAddress: safeAddress.toLowerCase(),
            chainId: targetChainId,
            chainName: chainConfig.chain.name,
        });

        // Get Safe info from the blockchain
        const { getSafeInfoFromChain } = await import("@/lib/payments/safe");
        const safeInfo = await getSafeInfoFromChain(safeAddress, targetChainId);
        
        logSafeOperation(operation, "success", "Safe info fetched successfully", {
            safeAddress: safeInfo.safeAddress,
            ownersCount: safeInfo.owners.length,
            threshold: safeInfo.threshold,
            version: safeInfo.version,
        });

        // Build Safe wallet details
        const safeDetails: SafeWalletDetails = {
            safeAddress: safeInfo.safeAddress,
            owners: safeInfo.owners,
            threshold: safeInfo.threshold,
            version: safeInfo.version,
            modules: safeInfo.modules,
            nonce: safeInfo.nonce,
            connectionMethod: "imported",
            chainId: chainConfig.chain.id,
        };

        // Determine organization ID
        const orgId = organizationId 
            ? new ObjectId(organizationId)
            : session.user.organizationId 
                ? new ObjectId(session.user.organizationId)
                : undefined;

        if (!orgId) {
            throw new Error("Organization ID is required for Safe wallet connection");
        }

        // Check if Safe already exists for this organization
        const db = await connectToDatabase();
        const paymentMethods = db.collection<PaymentMethod>("paymentMethods");
        
        const existingSafe = await paymentMethods.findOne({
            organizationId: orgId,
            "cryptoDetails.safeDetails.safeAddress": safeAddress.toLowerCase(),
            isActive: true,
        });

        if (existingSafe) {
            logSafeOperation(operation, "warn", "Safe wallet already connected", {
                safeAddress: safeAddress.toLowerCase(),
                existingPaymentMethodId: existingSafe._id?.toString(),
                organizationId: orgId.toString(),
            });
            
            return {
                success: true,
                message: "Safe wallet already connected",
                paymentMethodId: existingSafe._id?.toString(),
                safeAddress,
                safeDetails,
            };
        }

        // Create payment method with Safe details using PaymentMethodService
        const paymentMethod = await paymentMethodService.createSafePaymentMethod(
            {
                name: name || `Safe Wallet (${safeAddress.slice(0, 6)}...${safeAddress.slice(-4)})`,
                safeAddress: safeAddress.toLowerCase(),
                owners: safeDetails.owners,
                threshold: safeDetails.threshold,
                chainId: chainConfig.chain.id,
                network: chainConfig.chain.name,
                currency: chainConfig.chain.nativeCurrency.symbol,
                version: safeDetails.version,
                modules: safeDetails.modules,
                nonce: safeDetails.nonce,
                connectionMethod: "imported",
                tags: ["safe", "multisig"],
            },
            orgId
        );

        logSafeOperation(operation, "info", "Updating organization with Safe wallet", {
            organizationId: orgId.toString(),
            paymentMethodId: paymentMethod._id?.toString(),
        });

        // Update organization's connectedSafeWallets array
        const organizations = db.collection("organizations");
        await organizations.updateOne(
            { _id: orgId },
            {
                $addToSet: { connectedSafeWallets: paymentMethod._id },
                $set: {
                    safeAddress: safeAddress.toLowerCase(),
                    safeOwners: safeDetails.owners,
                    safeThreshold: safeDetails.threshold,
                    updatedAt: new Date(),
                },
            }
        );

        const duration = Date.now() - startTime;
        logSafeOperation(operation, "success", "Safe wallet imported successfully", {
            safeAddress: safeAddress.toLowerCase(),
            paymentMethodId: paymentMethod._id?.toString(),
            organizationId: orgId.toString(),
            ownersCount: safeDetails.owners.length,
            threshold: safeDetails.threshold,
            durationMs: duration,
        });

        return {
            success: true,
            message: "Safe wallet imported successfully",
            paymentMethodId: paymentMethod._id?.toString(),
            safeAddress,
            safeDetails,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logSafeOperation(operation, "error", "Failed to import Safe wallet", {
            safeAddress: safeAddress?.toLowerCase(),
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to import Safe wallet",
        };
    }
}

/**
 * Connect a Safe wallet (manual connection with verification)
 */
export async function connectSafeWallet({
    safeAddress,
    chainId,
    name,
    organizationId,
}: {
    safeAddress: string;
    chainId?: string;
    name?: string;
    organizationId?: string;
}) {
    // For manual connection, we import the Safe
    // For Safe App connection, use authorizeSafeApp after importing
    return importExistingSafe({
        safeAddress,
        chainId,
        name,
        organizationId,
    });
}

/**
 * Get all connected Safe wallets for an organization or user
 */
export async function getConnectedSafeWallets({
    organizationId,
}: {
    organizationId?: string;
}) {
    const operation = "getConnectedSafeWallets";
    const startTime = Date.now();
    
    try {
        logSafeOperation(operation, "info", "Fetching connected Safe wallets", {
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logSafeOperation(operation, "error", "Unauthorized - no session");
            throw new Error("Unauthorized");
        }

        const db = await connectToDatabase();
        const paymentMethods = db.collection<PaymentMethod>("paymentMethods");

        // Get user to determine if they have organizationId or userId
        const user = await UserService.getUserByEmail(session.user.email || '');
        if (!user) {
            logSafeOperation(operation, "error", "User not found");
            throw new Error("User not found");
        }

        // Build query - support both organization and individual users
        const query: Record<string, unknown> = {
            type: "crypto",
            "cryptoDetails.safeDetails": { $exists: true },
            isActive: true,
        };

        // Use organizationId if provided or if user has one, otherwise use userId
        const orgId = organizationId
            ? new ObjectId(organizationId)
            : user.organizationId
                ? user.organizationId
                : undefined;

        if (orgId) {
            query.organizationId = orgId;
            logSafeOperation(operation, "info", "Querying Safe wallets for organization", {
                organizationId: orgId.toString(),
            });
        } else {
            query.userId = user._id;
            logSafeOperation(operation, "info", "Querying Safe wallets for user", {
                userId: user._id.toString(),
            });
        }

        // Get all Safe wallets
        const safeWallets = await paymentMethods
            .find(query)
            .toArray();

        const duration = Date.now() - startTime;
        logSafeOperation(operation, "success", "Safe wallets fetched", {
            organizationId: orgId?.toString(),
            userId: !orgId ? user._id.toString() : undefined,
            count: safeWallets.length,
            durationMs: duration,
        });

        return {
            success: true,
            safeWallets: safeWallets.map((wallet) => ({
                paymentMethodId: wallet._id?.toString(),
                name: wallet.name,
                safeAddress: wallet.cryptoDetails?.safeDetails?.safeAddress,
                owners: wallet.cryptoDetails?.safeDetails?.owners || [],
                threshold: wallet.cryptoDetails?.safeDetails?.threshold || 0,
                chainId: wallet.cryptoDetails?.safeDetails?.chainId,
                isDefault: wallet.isDefault,
            })),
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logSafeOperation(operation, "error", "Failed to fetch Safe wallets", {
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch Safe wallets",
            safeWallets: [],
        };
    }
}

/**
 * Disconnect a Safe wallet
 */
export async function disconnectSafeWallet({
    paymentMethodId,
    organizationId,
}: {
    paymentMethodId: string;
    organizationId?: string;
}) {
    const operation = "disconnectSafeWallet";
    const startTime = Date.now();
    
    try {
        logSafeOperation(operation, "info", "Disconnecting Safe wallet", {
            paymentMethodId,
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logSafeOperation(operation, "error", "Unauthorized - no session");
            throw new Error("Unauthorized");
        }

        const db = await connectToDatabase();
        const paymentMethods = db.collection<PaymentMethod>("paymentMethods");

        // Determine organization ID
        const orgId = organizationId
            ? new ObjectId(organizationId)
            : session.user.organizationId
                ? new ObjectId(session.user.organizationId)
                : undefined;

        if (!orgId) {
            logSafeOperation(operation, "error", "Organization ID required");
            throw new Error("Organization ID is required");
        }

        // Get the payment method to verify ownership
        const paymentMethod = await paymentMethods.findOne({
            _id: new ObjectId(paymentMethodId),
            organizationId: orgId,
        });

        if (!paymentMethod) {
            logSafeOperation(operation, "error", "Payment method not found or access denied", {
                paymentMethodId,
                organizationId: orgId.toString(),
            });
            throw new Error("Payment method not found or access denied");
        }

        const safeAddress = paymentMethod.cryptoDetails?.safeDetails?.safeAddress;
        logSafeOperation(operation, "info", "Payment method found, marking as inactive", {
            paymentMethodId,
            safeAddress,
        });

        // Mark as inactive instead of deleting (for audit trail)
        await paymentMethods.updateOne(
            { _id: new ObjectId(paymentMethodId) },
            {
                $set: {
                    isActive: false,
                    updatedAt: new Date(),
                },
            }
        );

        // Remove from organization's connectedSafeWallets array
        const organizations = db.collection("organizations");
        // MongoDB $pull operator - TypeScript type limitation workaround
        // Using Record<string, unknown> to satisfy type checker while maintaining functionality
        await organizations.updateOne(
            { _id: orgId },
            {
                $pull: { connectedSafeWallets: new ObjectId(paymentMethodId) },
                $set: { updatedAt: new Date() },
            } as Record<string, unknown> as Parameters<typeof organizations.updateOne>[1]
        );

        const duration = Date.now() - startTime;
        logSafeOperation(operation, "success", "Safe wallet disconnected successfully", {
            paymentMethodId,
            safeAddress,
            organizationId: orgId.toString(),
            durationMs: duration,
        });

        return {
            success: true,
            message: "Safe wallet disconnected successfully",
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logSafeOperation(operation, "error", "Failed to disconnect Safe wallet", {
            paymentMethodId,
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to disconnect Safe wallet",
        };
    }
}

/**
 * Authorize Safe App (for Safe App integration)
 */
export async function authorizeSafeApp({
    paymentMethodId,
    safeAppManifest,
    organizationId,
}: {
    paymentMethodId: string;
    safeAppManifest?: string; // Reserved for future Safe App manifest validation
    organizationId?: string;
}) {
    const operation = "authorizeSafeApp";
    const startTime = Date.now();
    
    try {
        logSafeOperation(operation, "info", "Authorizing Safe App", {
            paymentMethodId,
            hasManifest: !!safeAppManifest,
            hasOrgId: !!organizationId,
        });

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            logSafeOperation(operation, "error", "Unauthorized - no session");
            throw new Error("Unauthorized");
        }

        const db = await connectToDatabase();
        const paymentMethods = db.collection<PaymentMethod>("paymentMethods");

        // Determine organization ID
        const orgId = organizationId
            ? new ObjectId(organizationId)
            : session.user.organizationId
                ? new ObjectId(session.user.organizationId)
                : undefined;

        if (!orgId) {
            logSafeOperation(operation, "error", "Organization ID required");
            throw new Error("Organization ID is required");
        }

        // Get the payment method
        const paymentMethod = await paymentMethods.findOne({
            _id: new ObjectId(paymentMethodId),
            organizationId: orgId,
        });

        if (!paymentMethod || !paymentMethod.cryptoDetails?.safeDetails) {
            logSafeOperation(operation, "error", "Safe wallet not found", {
                paymentMethodId,
                organizationId: orgId.toString(),
            });
            throw new Error("Safe wallet not found");
        }

        const safeAddress = paymentMethod.cryptoDetails.safeDetails.safeAddress;
        logSafeOperation(operation, "info", "Updating Safe App authorization", {
            paymentMethodId,
            safeAddress,
        });

        // Update Safe App authorization status
        await paymentMethods.updateOne(
            { _id: new ObjectId(paymentMethodId) },
            {
                $set: {
                    "cryptoDetails.safeDetails.safeAppAuthorized": true,
                    "cryptoDetails.safeDetails.authorizedAt": new Date(),
                    "cryptoDetails.safeDetails.connectionMethod": "safe_app",
                    updatedAt: new Date(),
                },
            }
        );

        const duration = Date.now() - startTime;
        logSafeOperation(operation, "success", "Safe App authorized successfully", {
            paymentMethodId,
            safeAddress,
            organizationId: orgId.toString(),
            durationMs: duration,
        });

        return {
            success: true,
            message: "Safe App authorized successfully",
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logSafeOperation(operation, "error", "Failed to authorize Safe App", {
            paymentMethodId,
            error: error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            durationMs: duration,
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to authorize Safe App",
        };
    }
}

