"use client";

/**
 * Wallet connection utility - supports multiple wallet types
 * Similar to Request Finance's wallet connection flow
 */

export type WalletType = "safe" | "metamask" | "walletconnect" | "celo" | null;

export interface ConnectedWallet {
    type: WalletType;
    address: string;
    chainId?: number;
}

/**
 * Connect to Safe wallet (Safe App environment)
 */
export async function connectSafeWallet(): Promise<ConnectedWallet> {
    // Check if running in Safe App environment
    interface WindowWithSafe extends Window {
        safe?: {
            getSafeInfo: () => Promise<{ safeAddress: string; chainId: number }>;
        };
    }
    const windowWithSafe = window as unknown as WindowWithSafe;
    if (typeof window !== "undefined" && windowWithSafe.safe) {
        try {
            const safe = windowWithSafe.safe;
            const safeInfo = await safe.getSafeInfo();
            return {
                type: "safe",
                address: safeInfo.safeAddress,
                chainId: safeInfo.chainId,
            };
        } catch (error) {
            console.error("Error connecting to Safe wallet:", error);
            throw new Error("Failed to connect to Safe wallet");
        }
    }
    throw new Error("Safe wallet not available. Please use Safe App environment.");
}

/**
 * Connect to MetaMask
 */
export async function connectMetaMask(): Promise<ConnectedWallet> {
    interface WindowWithEthereum extends Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            isMetaMask?: boolean;
        };
    }
    const windowWithEthereum = window as unknown as WindowWithEthereum;
    if (typeof window === "undefined" || !windowWithEthereum.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
    }

    try {
        const ethereum = windowWithEthereum.ethereum;
        const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found");
        }

        const chainId = (await ethereum.request({ method: "eth_chainId" })) as string;
        
        return {
            type: "metamask",
            address: accounts[0] as string,
            chainId: parseInt(chainId, 16),
        };
    } catch (error) {
        console.error("Error connecting to MetaMask:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to connect to MetaMask");
    }
}

/**
 * Connect to WalletConnect (placeholder - requires WalletConnect setup)
 */
export async function connectWalletConnect(): Promise<ConnectedWallet> {
    // This would require WalletConnect SDK setup
    // For now, return an error
    throw new Error("WalletConnect integration coming soon");
}

/**
 * Connect to any available wallet (tries Safe first, then MetaMask)
 */
export async function connectAnyWallet(): Promise<ConnectedWallet> {
    // Try Safe first
    try {
        return await connectSafeWallet();
    } catch {
        // Safe not available, try MetaMask
        try {
            return await connectMetaMask();
        } catch (error) {
            throw new Error(
                error instanceof Error 
                    ? error.message 
                    : "No wallet available. Please install MetaMask or use Safe App."
            );
        }
    }
}

/**
 * Detect available wallets
 */
export function detectAvailableWallets(): {
    hasSafe: boolean;
    hasMetaMask: boolean;
    hasWalletConnect: boolean;
} {
    if (typeof window === "undefined") {
        return {
            hasSafe: false,
            hasMetaMask: false,
            hasWalletConnect: false,
        };
    }

    interface WindowWithWallets extends Window {
        safe?: unknown;
        ethereum?: {
            isMetaMask?: boolean;
        };
    }
    const windowWithWallets = window as unknown as WindowWithWallets;
    return {
        hasSafe: !!windowWithWallets.safe,
        hasMetaMask: !!windowWithWallets.ethereum && !!windowWithWallets.ethereum.isMetaMask,
        hasWalletConnect: false, // Would need WalletConnect SDK check
    };
}

