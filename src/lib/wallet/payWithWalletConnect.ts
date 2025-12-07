"use client";

import { createWalletClient, custom, parseUnits, type Address } from "viem";
import { getChainByNumericId } from "@/lib/chains";

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

// EIP-1193 Provider interface
interface EIP1193Provider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    on?(event: string, handler: (...args: unknown[]) => void): void;
    removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Pay with WalletConnect provider (Reown AppKit)
 * Client-side transaction signing and sending
 */
export async function payWithWalletConnect({
    provider,
    walletAddress,
    tokenAddress,
    toAddress,
    amount,
    decimals,
    chainId,
}: {
    provider: EIP1193Provider; // EIP-1193 provider from AppKit
    walletAddress: string;
    tokenAddress: string;
    toAddress: string;
    amount: number | string;
    decimals: number;
    chainId: number;
}): Promise<string> {
    if (!provider) {
        throw new Error("WalletConnect provider not available");
    }

    // Get chain config
    const chainConfig = getChainByNumericId(chainId);
    if (!chainConfig) {
        throw new Error(`Chain not found: ${chainId}`);
    }

    // Create wallet client with WalletConnect provider
    const walletClient = createWalletClient({
        chain: chainConfig.chain,
        transport: custom(provider),
    });

    // Get accounts
    const accounts = await provider.request({ method: "eth_accounts" }) as string[];
    if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please connect your wallet.");
    }

    const account = accounts[0] as Address;
    if (account.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Connected wallet address does not match");
    }

    // Check if we're on the correct network
    const currentChainId = await provider.request({ method: "eth_chainId" }) as string;
    const expectedChainId = `0x${chainId.toString(16)}`;
    
    if (currentChainId !== expectedChainId) {
        // Request to switch network
        try {
            await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: expectedChainId }],
            });
        } catch (switchError: unknown) {
            // If chain doesn't exist, add it
            const error = switchError as { code?: number; message?: string };
            if (error.code === 4902) {
                await provider.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: expectedChainId,
                        chainName: chainConfig.chain.name,
                        nativeCurrency: chainConfig.chain.nativeCurrency,
                        rpcUrls: chainConfig.chain.rpcUrls.default.http,
                        blockExplorers: chainConfig.chain.blockExplorers ? {
                            default: {
                                name: chainConfig.chain.blockExplorers.default.name,
                                url: chainConfig.chain.blockExplorers.default.url,
                            }
                        } : undefined,
                    }],
                });
            } else {
                throw switchError;
            }
        }
    }

    // Format amount
    const formattedAmount = parseUnits(amount.toString(), decimals);

    // Send transaction
    const hash = await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [toAddress as Address, formattedAmount],
        account: account,
    });

    return hash;
}

