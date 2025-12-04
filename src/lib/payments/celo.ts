"use server";

import { createWalletClient, http, createPublicClient, parseUnits, type Account, type Address } from "viem";
import { DEFAULT_CHAIN, getChainById } from "../chains";

// ERC20 Transfer ABI
const ERC20_ABI = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    }
] as const;

/**
 * Get public client for a chain
 * Defaults to CELO (default chain) if no chainId provided
 * @deprecated Use getPublicClient from safe.ts instead
 */
export async function celoPublicClient(chainId?: string) {
    const chainConfig = chainId ? getChainById(chainId) : DEFAULT_CHAIN;
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${chainId}`);
    }
    
    return createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.chain.rpcUrls.default.http[0])
    });
}

/**
 * Get wallet client for a chain
 * Defaults to CELO (default chain) if no chainId provided
 * @deprecated Use getWalletClient from safe.ts instead
 */
export async function celoWalletClient(signer: Account, chainId?: string) {
    const chainConfig = chainId ? getChainById(chainId) : DEFAULT_CHAIN;
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${chainId}`);
    }
    
    return createWalletClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.chain.rpcUrls.default.http[0]),
        account: signer
    });
}

/**
 * Send ERC20 token on any supported chain
 * Defaults to CELO (default chain) if no chainId provided
 */
export async function sendCeloToken({
    signer,
    tokenAddress,
    amount,
    to,
    decimals,
    chainId,
}: {
    signer: Account;
    tokenAddress: Address;
    amount: number | string;
    to: Address;
    decimals: number;
    chainId?: string;
}) {
    const client = await celoWalletClient(signer, chainId);
    const formattedAmount = parseUnits(amount.toString(), decimals);

    return client.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, formattedAmount],
        account: signer
    });
}