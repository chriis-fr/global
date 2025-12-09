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
    interface WindowWithEthereum extends Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
    }
    const windowWithEthereum = window as unknown as WindowWithEthereum;
    if (typeof window === "undefined" || !windowWithEthereum.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
    }

    const ethereum = windowWithEthereum.ethereum;
    
    // Get chain config - chainId is a numeric string (e.g., "42220")
    const numericChainId = parseInt(chainId, 10);
    if (isNaN(numericChainId)) {
        throw new Error(`Invalid chain ID: ${chainId}`);
    }
    
    const chainConfig = getChainByNumericId(numericChainId);
    if (!chainConfig) {
        throw new Error(`Chain not found: ${chainId} (numeric: ${numericChainId})`);
    }

    // Request accounts first to ensure we have permission
    const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
    if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please connect your wallet.");
    }
    
    const account = accounts[0] as Address;
    if (account.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`Connected wallet address does not match. Expected: ${walletAddress}, Got: ${account}`);
    }

    // Check if we're on the correct network and switch if needed
    const currentChainId = await ethereum.request({ method: "eth_chainId" });
    const expectedChainId = `0x${numericChainId.toString(16)}`;
    
    if (currentChainId !== expectedChainId) {
        // Request to switch network
        try {
            await ethereum.request({
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
                
                // Use a more descriptive network name for MetaMask compatibility
                // For Celo, use "Celo Mainnet" which matches MetaMask's expected format
                let chainName = chainConfig.chain.name;
                if (numericChainId === 42220) {
                    chainName = "Celo Mainnet";
                } else if (numericChainId === 44787) {
                    chainName = "Celo Alfajores";
                } else {
                    // Use chain name as-is if it's already formatted
                    chainName = chainConfig.chain.name;
                }
                
                // Prepare network params matching MetaMask's expected format
                const networkParams = {
                    chainId: expectedChainId,
                    chainName: chainName,
                    nativeCurrency: {
                        name: chainConfig.chain.nativeCurrency.name,
                        symbol: chainConfig.chain.nativeCurrency.symbol,
                        decimals: chainConfig.chain.nativeCurrency.decimals,
                    },
                    rpcUrls: rpcUrls,
                };
                
                // Add block explorer if available
                interface NetworkParams {
                    chainId: string;
                    chainName: string;
                    nativeCurrency: {
                        name: string;
                        symbol: string;
                        decimals: number;
                    };
                    rpcUrls: string[];
                    blockExplorerUrls?: string[];
                }
                const networkParamsTyped = networkParams as NetworkParams;
                if (chainConfig.chain.blockExplorers?.default?.url) {
                    networkParamsTyped.blockExplorerUrls = [
                        chainConfig.chain.blockExplorers.default.url
                    ];
                }
                
                await ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [networkParamsTyped],
                });
            } else {
                throw new Error(`Failed to switch chain: ${error.message || 'Unknown error'}`);
            }
        }
    }

    // Create wallet and public clients
    const walletClient = createWalletClient({
        chain: chainConfig.chain,
        transport: custom(ethereum),
    });

    const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    });

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
        const error = balanceError as { message?: string };
        if (error.message?.includes("Insufficient")) {
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
            const error = tokenError as { message?: string };
            if (error.message?.includes("Insufficient token balance")) {
                throw tokenError;
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

    console.log("Preparing transaction:", {
        tokenAddress: isNativeToken ? "native" : tokenAddress,
        toAddress,
        amount: formattedAmount.toString(),
        decimals,
        account,
        chainId: numericChainId,
        isNativeToken,
    });

    // Send transaction using sendTransaction - this will ALWAYS trigger MetaMask popup
    try {
        if (isNativeToken) {
            // Native token transfer - direct send with value
            console.log("Sending native token transaction with params:", {
                account,
                to: toAddress,
                value: formattedAmount,
                chainId: numericChainId,
            });
            
            const hash = await walletClient.sendTransaction({
                account,
                to: toAddress as Address,
                value: formattedAmount, // Send native token
            });

            console.log("Native token transaction sent successfully. Hash:", hash);
            return hash;
        } else {
            // ERC20 token transfer - encode function data
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [toAddress as Address, formattedAmount],
            });

            console.log("Sending ERC20 transaction with params:", {
                account,
                to: tokenAddress,
                data,
                value: BigInt(0),
                chainId: numericChainId,
            });
            
            const hash = await walletClient.sendTransaction({
                account,
                to: tokenAddress as Address,
                data,
                value: BigInt(0), // ERC20 transfer doesn't send native token
            });

            console.log("ERC20 transaction sent successfully. Hash:", hash);
            return hash;
        }
    } catch (error: unknown) {
        const err = error as {
            code?: number | string;
            message?: string;
            reason?: string;
            data?: { message?: string };
            constructor?: { name?: string };
            stack?: string;
        };
        
        // Check if user rejected the transaction
        const isUserRejection = 
            err?.code === 4001 || 
            err?.code === 'ACTION_REJECTED' ||
            err?.message?.toLowerCase().includes('user rejected') ||
            err?.message?.toLowerCase().includes('user denied') ||
            err?.reason?.toLowerCase().includes('user rejected') ||
            err?.reason?.toLowerCase().includes('user denied');
        
        if (isUserRejection) {
            // User rejection - don't log as error, just throw a clean message
            throw new Error("Transaction cancelled by user");
        }
        
        console.error("Transaction error details:", {
            error,
            errorType: typeof error,
            errorConstructor: err?.constructor?.name,
            message: err?.message,
            reason: err?.reason,
            code: err?.code,
            data: err?.data,
            stack: err?.stack,
            stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        
        // Extract error message from various possible locations
        let errorMessage = "Unknown error";
        if (err?.message) {
            errorMessage = err.message;
        } else if (err?.reason) {
            errorMessage = err.reason;
        } else if (err?.data?.message) {
            errorMessage = err.data.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            // Try to stringify the error object
            try {
                errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
            } catch {
                errorMessage = String(error);
            }
        }
        
        // Create a proper Error object with all details
        interface EnhancedError extends Error {
            originalError?: unknown;
            code?: number | string;
            reason?: string;
        }
        const enhancedError = new Error(`Transaction failed: ${errorMessage}`) as EnhancedError;
        enhancedError.originalError = error;
        enhancedError.code = err?.code;
        enhancedError.reason = err?.reason;
        throw enhancedError;
    }
}

