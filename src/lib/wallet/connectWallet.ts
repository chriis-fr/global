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
    if (typeof window !== "undefined" && (window as any).safe) {
        try {
            const safe = (window as any).safe;
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
    if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
    }

    try {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found");
        }

        const chainId = await ethereum.request({ method: "eth_chainId" });
        
        return {
            type: "metamask",
            address: accounts[0],
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

    return {
        hasSafe: !!(window as any).safe,
        hasMetaMask: !!(window as any).ethereum && !!(window as any).ethereum.isMetaMask,
        hasWalletConnect: false, // Would need WalletConnect SDK check
    };
}

