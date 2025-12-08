"use client";

import { 
    createWalletClient, 
    createPublicClient, 
    custom, 
    parseUnits, 
    encodeFunctionData,
    http,
    type Address 
} from "viem";
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
        outputs: [],
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
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

    // Create wallet and public clients
    const walletClient = createWalletClient({
        chain: chainConfig.chain,
        transport: custom(provider),
    });

    // Get RPC URL - prefer array format
    const rpcUrl = Array.isArray(chainConfig.chain.rpcUrls.default.http)
        ? chainConfig.chain.rpcUrls.default.http[0]
        : chainConfig.chain.rpcUrls.default.http;

    const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(rpcUrl),
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
                const rpcUrls = Array.isArray(chainConfig.chain.rpcUrls.default.http)
                    ? chainConfig.chain.rpcUrls.default.http
                    : [chainConfig.chain.rpcUrls.default.http];
                
                await provider.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: expectedChainId,
                        chainName: chainConfig.chain.name,
                        nativeCurrency: chainConfig.chain.nativeCurrency,
                        rpcUrls: rpcUrls,
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
    
    // Check if this is a native token payment
    const isNativeToken = tokenAddress.toLowerCase() === 'native' || tokenAddress === '0x0000000000000000000000000000000000000000';

    // Check native token balance
    try {
        const nativeBalance = await publicClient.getBalance({ address: account });
        
        if (isNativeToken) {
            // For native token payments, check if balance is sufficient for payment + gas
            const minBalance = formattedAmount + parseUnits("0.01", chainConfig.chain.nativeCurrency.decimals); // Payment + gas
            
            if (nativeBalance < minBalance) {
                const balanceInNative = Number(nativeBalance) / Number(BigInt(10) ** BigInt(chainConfig.chain.nativeCurrency.decimals));
                const requiredInNative = Number(minBalance) / Number(BigInt(10) ** BigInt(chainConfig.chain.nativeCurrency.decimals));
                throw new Error(
                    `Insufficient ${chainConfig.chain.nativeCurrency.symbol} balance. ` +
                    `Required: ${requiredInNative.toFixed(4)} ${chainConfig.chain.nativeCurrency.symbol} (payment + gas), ` +
                    `Available: ${balanceInNative.toFixed(4)} ${chainConfig.chain.nativeCurrency.symbol}`
                );
            }
        } else {
            // For ERC20 payments, check if balance is sufficient for gas only
            const minBalance = parseUnits("0.01", chainConfig.chain.nativeCurrency.decimals); // Minimum 0.01 native token for gas
            
            if (nativeBalance < minBalance) {
                const balanceInNative = Number(nativeBalance) / Number(BigInt(10) ** BigInt(chainConfig.chain.nativeCurrency.decimals));
                throw new Error(
                    `Insufficient ${chainConfig.chain.nativeCurrency.symbol} for gas. ` +
                    `You need at least 0.01 ${chainConfig.chain.nativeCurrency.symbol} to cover transaction fees. ` +
                    `Current balance: ${balanceInNative.toFixed(4)} ${chainConfig.chain.nativeCurrency.symbol}`
                );
            }
        }
    } catch (balanceError: unknown) {
        const err = balanceError as { message?: string };
        if (err?.message?.includes("Insufficient")) {
            throw balanceError;
        }
        console.warn("Could not check native balance:", balanceError);
        // Continue anyway - wallet will reject if insufficient
    }

    // Check ERC20 token balance (only for ERC20 tokens)
    if (!isNativeToken) {
        try {
            const tokenBalance = await publicClient.readContract({
                address: tokenAddress as Address,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [account],
            });

            if (tokenBalance < formattedAmount) {
                const availableTokens = Number(tokenBalance) / Number(BigInt(10) ** BigInt(decimals));
                throw new Error(
                    `Insufficient token balance. ` +
                    `Required: ${amount} tokens, ` +
                    `Available: ${availableTokens.toFixed(4)} tokens`
                );
            }
        } catch (tokenError: unknown) {
            const err = tokenError as { message?: string };
            if (err?.message?.includes("Insufficient token balance")) {
                throw new Error(err.message);
            }
            console.warn("Could not check token balance:", tokenError);
            // Continue anyway - transaction will revert if insufficient
        }

        // Simulate ERC20 transaction to catch revert reasons before sending
        try {
            await publicClient.simulateContract({
                address: tokenAddress as Address,
                abi: ERC20_ABI,
                functionName: "transfer",
                account,
                args: [toAddress as Address, formattedAmount],
            });
            console.log("Transaction simulation successful");
        } catch (simulateError: unknown) {
            // Extract revert reason if available
            const err = simulateError as { reason?: string; message?: string; data?: { message?: string } };
            let revertReason = "Transaction would revert";
            if (err?.reason) {
                revertReason = err.reason;
            } else if (err?.message) {
                revertReason = err.message;
            } else if (err?.data?.message) {
                revertReason = err.data.message;
            }
            
            throw new Error(`Transaction simulation failed: ${revertReason}`);
        }
    }

    console.log("WalletConnect: Preparing transaction:", {
        tokenAddress: isNativeToken ? "native" : tokenAddress,
        toAddress,
        amount: formattedAmount.toString(),
        decimals,
        account,
        chainId,
        isNativeToken,
    });

    // Send transaction using sendTransaction - this will ALWAYS trigger wallet popup
    try {
        if (isNativeToken) {
            // Native token transfer - direct send with value
            const hash = await walletClient.sendTransaction({
                account,
                to: toAddress as Address,
                value: formattedAmount, // Send native token
            });

            console.log("WalletConnect: Native token transaction sent successfully. Hash:", hash);
            return hash;
        } else {
            // ERC20 token transfer - encode function data
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [toAddress as Address, formattedAmount],
            });

            const hash = await walletClient.sendTransaction({
                account,
                to: tokenAddress as Address,
                data,
                value: BigInt(0), // ERC20 transfer doesn't send native token
            });

            console.log("WalletConnect: ERC20 transaction sent successfully. Hash:", hash);
            return hash;
        }
    } catch (error: unknown) {
        console.error("WalletConnect: Transaction error:", error);
        
        // Check if user rejected the transaction
        const err = error as { code?: number | string; message?: string; reason?: string };
        const isUserRejection = 
            err?.code === 4001 || 
            err?.code === 'ACTION_REJECTED' ||
            err?.message?.toLowerCase().includes('user rejected') ||
            err?.message?.toLowerCase().includes('user denied') ||
            err?.reason?.toLowerCase().includes('user rejected') ||
            err?.reason?.toLowerCase().includes('user denied');
        
        if (isUserRejection) {
            throw new Error("Transaction cancelled by user");
        }
        
        // Extract error message
        const errorMessage = err?.message || err?.reason || "Unknown error";
        throw new Error(`Transaction failed: ${errorMessage}`);
    }
}

