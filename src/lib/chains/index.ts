/**
 * Centralized Chain Configuration
 * 
 * This is the single source of truth for all blockchain chains in the application.
 * To add a new chain:
 * 1. Import the chain definition from viem or create it with defineChain
 * 2. Add it to the SUPPORTED_CHAINS array (CELO should remain first as default)
 * 3. Add chain-specific configuration (tokens, Safe service URLs, etc.)
 */

import type { Chain } from "viem";
import { CELO } from "./celo";

// Chain configuration interface
export interface ChainConfig {
    id: string; // Unique identifier (e.g., 'celo', 'ethereum')
    chain: Chain; // Viem chain definition
    tokens?: {
        [symbol: string]: {
            address: string;
            decimals: number;
            symbol: string;
        };
    };
    safeTransactionService?: string; // Safe Transaction Service URL for this chain
    enabled: boolean; // Whether this chain is enabled/active
}

// Supported chains array - CELO is first (default)
// Add new chains here, but keep CELO first to maintain current behavior
export const SUPPORTED_CHAINS: ChainConfig[] = [
    {
        id: 'celo',
        chain: CELO,
        tokens: {
            USDT: {
                symbol: "USDT",
                decimals: 6,
                address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
            },
            cUSD: {
                symbol: "cUSD",
                decimals: 18,
                address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
            },
        },
        safeTransactionService: "https://safe-transaction-celo.safe.global/api/v1",
        enabled: true,
    },
    // Add more chains here as needed
    // Example:
    // {
    //     id: 'ethereum',
    //     chain: mainnet, // from viem/chains
    //     tokens: { ... },
    //     safeTransactionService: "https://safe-transaction-mainnet.safe.global/api/v1",
    //     enabled: true,
    // },
];

/**
 * Get the default chain (first enabled chain, which is CELO)
 */
export function getDefaultChain(): ChainConfig {
    const defaultChain = SUPPORTED_CHAINS.find(chain => chain.enabled);
    if (!defaultChain) {
        throw new Error("No enabled chains found. At least one chain must be enabled.");
    }
    return defaultChain;
}

/**
 * Get chain by ID
 */
export function getChainById(chainId: string): ChainConfig | undefined {
    return SUPPORTED_CHAINS.find(chain => chain.id === chainId && chain.enabled);
}

/**
 * Get chain by numeric chain ID
 */
export function getChainByNumericId(numericId: number): ChainConfig | undefined {
    return SUPPORTED_CHAINS.find(
        chain => chain.chain.id === numericId && chain.enabled
    );
}

/**
 * Get all enabled chains
 */
export function getEnabledChains(): ChainConfig[] {
    return SUPPORTED_CHAINS.filter(chain => chain.enabled);
}

/**
 * Get token by symbol for a specific chain
 */
export function getTokenBySymbol(chainId: string, symbol: string) {
    const chain = getChainById(chainId);
    if (!chain?.tokens) {
        return undefined;
    }
    return chain.tokens[symbol.toUpperCase()];
}

/**
 * Get Safe Transaction Service URL for a chain
 */
export function getSafeTransactionServiceUrl(chainId: string): string | undefined {
    const chain = getChainById(chainId);
    return chain?.safeTransactionService;
}

// Export default chain for backward compatibility
export const DEFAULT_CHAIN = getDefaultChain();
export const DEFAULT_CHAIN_ID = DEFAULT_CHAIN.id;
export const DEFAULT_CHAIN_DEFINITION = DEFAULT_CHAIN.chain;

// Export CELO tokens for backward compatibility
// This will be CELO tokens if CELO is the default chain
export const CELO_TOKENS = DEFAULT_CHAIN.id === 'celo' ? (DEFAULT_CHAIN.tokens || {}) : {};

// Re-export CELO chain definition for backward compatibility
export { CELO } from "./celo";

