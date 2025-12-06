"use client";

import { createWalletClient, custom, parseUnits, type Address } from "viem";
import { getChainById } from "@/lib/chains";

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
 * Pay with EOA wallet (MetaMask, WalletConnect, etc.)
 * Client-side transaction signing and sending
 */
export async function payWithEOAWallet({
    walletAddress,
    tokenAddress,
    toAddress,
    amount,
    decimals,
    chainId,
}: {
    walletAddress: string;
    tokenAddress: string;
    toAddress: string;
    amount: number | string;
    decimals: number;
    chainId: string;
}): Promise<string> {
    if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
    }

    const ethereum = (window as any).ethereum;
    
    // Get chain config
    const chainConfig = getChainById(chainId);
    if (!chainConfig) {
        throw new Error(`Chain not found: ${chainId}`);
    }

    // Create wallet client with MetaMask provider
    const walletClient = createWalletClient({
        chain: chainConfig.chain,
        transport: custom(ethereum),
    });

    // Get accounts
    const [account] = await walletClient.getAddresses();
    if (!account || account.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Connected wallet address does not match");
    }

    // Check if we're on the correct network
    const currentChainId = await ethereum.request({ method: "eth_chainId" });
    const expectedChainId = `0x${parseInt(chainId).toString(16)}`;
    
    if (currentChainId !== expectedChainId) {
        // Request to switch network
        try {
            await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: expectedChainId }],
            });
        } catch (switchError: any) {
            // If chain doesn't exist, add it
            if (switchError.code === 4902) {
                await ethereum.request({
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
        account: account as Address,
    });

    return hash;
}

