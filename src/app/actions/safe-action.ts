"use server";

import { broadcastSafeDeployment, predictSafeAddress, initProtocolKitForDeployedSafe, createSafeTx, proposeSafeTx, encodeERC20Transfer } from "@/lib/payments/safe";
import { getCompanyById, getInvoicesByIds, markInvoicesPaid, updateOrganizationSafeWallet } from "@/lib/db";
import type { Hex } from "viem";

/**
 * Deploy a new Safe wallet for an organization
 * - owners: array of owner addresses
 * - threshold: number of signatures required
 * - organizationId: optional organization ID to update with Safe address
 */
export async function serverDeploySafe({
    owners,
    threshold,
    organizationId,
}: {
    owners: string[];
    threshold: number;
    organizationId?: string;
}) {
    const deployer = process.env.SAFE_DEPLOYER_PRIVATE_KEY;
    if (!deployer) throw new Error("SAFE_DEPLOYER_PRIVATE_KEY is not set");

    const deployerKey = deployer as Hex;

    const predicted = await predictSafeAddress({
        owners,
        threshold,
        signerPrivateKey: deployerKey,
    });

    const result = await broadcastSafeDeployment({
        owners,
        threshold,
        deployerPrivateKey: deployerKey,
    });

    // Update organization with Safe address if provided
    if (organizationId) {
        await updateOrganizationSafeWallet(organizationId, {
            safeAddress: result.safeAddress,
            safeOwners: owners,
            safeThreshold: threshold,
        });
    }

    return {
        safeAddress: result.safeAddress,
        txHash: result.txHash,
        receipt: result.receipt,
        predicted,
    };
}

/**
 * payInvoicesWithSafe: server action
 * - companyId: the org/company that has a Safe (safeAddress and owners)
 * - invoiceIds: invoices being paid (assumed all on Celo and same token)
 * - proposerAddress: the signer address from which we propose (must be one of safe owners)
 */

/**
 * Pay invoices using Safe multisig wallet
 * - companyId: organization ID that has a Safe deployed
 * - invoiceIds: array of invoice IDs to pay
 * - proposerAddress: address of the Safe owner proposing the transaction
 * - proposerPrivateKey: private key of the proposer (server-side signing)
 * - chainId: optional chain ID (defaults to CELO)
 */
export async function payInvoicesWithSafe({
    companyId,
    invoiceIds,
    proposerAddress,
    proposerPrivateKey,
    chainId,
}: {
    companyId: string;
    invoiceIds: string[];
    proposerAddress: string;
    proposerPrivateKey: Hex;
    chainId?: string;
}) {
    // 1. Get company and verify Safe is deployed
    const company = await getCompanyById(companyId);
    if (!company) throw new Error("Company not found");
    if (!company.safeAddress) throw new Error("Company has no Safe deployed");

    const safeAddress = company.safeAddress;

    // Verify proposer is a Safe owner
    if (!company.safeOwners?.includes(proposerAddress)) {
        throw new Error("Proposer address is not a Safe owner");
    }

    // 2. Fetch invoices from DB
    const invoices = await getInvoicesByIds(invoiceIds);
    if (!invoices.length) throw new Error("No invoices found");

    // 3. Validate invoices have required blockchain fields
    const firstInvoice = invoices[0];
    if (!firstInvoice.tokenAddress || !firstInvoice.tokenDecimals || !firstInvoice.payeeAddress) {
        throw new Error("Invoices missing required blockchain payment fields (tokenAddress, tokenDecimals, payeeAddress)");
    }

    // Assume all invoices use same token and chain (group by chain+token if needed in future)
    const tokenAddress = firstInvoice.tokenAddress;
    const tokenDecimals = firstInvoice.tokenDecimals;

    // 4. Build transactions array for Safe batch
    const transactionsForSafe = [];
    for (const inv of invoices) {
        const invoiceAmount = inv.total || inv.totalAmount || 0;
        if (!inv.payeeAddress || invoiceAmount <= 0) {
            throw new Error(`Invoice ${inv._id} missing payeeAddress or has invalid amount`);
        }

        const data = encodeERC20Transfer(
            tokenAddress,
            inv.payeeAddress,
            invoiceAmount,
            tokenDecimals
        );

        transactionsForSafe.push({
            to: tokenAddress,
            value: "0",
            data: data,
        });
    }

    // 5. Init protocolKit connected to the deployed safe
    const protocolKit = await initProtocolKitForDeployedSafe({
        safeAddress,
        signerPrivateKey: proposerPrivateKey,
        chainId: chainId || firstInvoice.chainId?.toString(),
    });

    // 6. Create the Safe transaction (batch)
    const safeTx = await createSafeTx({
        protocolKit,
        transactions: transactionsForSafe,
    });

    // 7. Propose transaction to Safe Tx Service so other owners see it
    await proposeSafeTx({
        protocolKit,
        safeAddress,
        signerAddress: proposerAddress,
        safeTx,
    });

    // 8. Get transaction hash and mark invoices as 'proposed' in DB
    const txHash = await protocolKit.getTransactionHash(safeTx);
    await markInvoicesPaid(invoiceIds, {
        status: "proposed" as const,
        safeTxHash: txHash,
    });

    return {
        success: true,
        txHash,
        safeAddress,
        invoiceCount: invoices.length,
    };
}

/**
 * Connect an existing Safe wallet to an organization
 * - organizationId: organization to link Safe to
 * - safeAddress: existing Safe wallet address
 * - safeOwners: array of owner addresses (for verification)
 * - safeThreshold: number of signatures required
 */
export async function connectExistingSafe({
    organizationId,
    safeAddress,
    safeOwners,
    safeThreshold,
}: {
    organizationId: string;
    safeAddress: string;
    safeOwners: string[];
    safeThreshold: number;
}) {
    // Verify organization exists
    const company = await getCompanyById(organizationId);
    if (!company) throw new Error("Organization not found");

    // Update organization with Safe wallet info
    const updated = await updateOrganizationSafeWallet(organizationId, {
        safeAddress,
        safeOwners,
        safeThreshold,
    });

    if (!updated) {
        throw new Error("Failed to update organization with Safe wallet");
    }

    return {
        success: true,
        safeAddress,
        message: "Existing Safe wallet connected successfully",
    };
}