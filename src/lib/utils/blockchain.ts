import { getChainByNumericId } from '@/lib/chains';

/**
 * Get blockchain explorer URL for a transaction hash
 */
export function getExplorerUrl(txHash: string, chainId?: number): string | null {
  if (!txHash) {
    return null;
  }

  // If chainId is provided, use it
  if (chainId) {
    const chain = getChainByNumericId(chainId);
    
    if (chain?.chain.blockExplorers?.default?.url) {
      const explorerBase = chain.chain.blockExplorers.default.url;
      return `${explorerBase}/tx/${txHash}`;
    }
    
    // Fallback: try to determine explorer from chain ID
    // Common explorers by chain ID
    const explorerMap: Record<number, string> = {
      1: 'https://etherscan.io', // Ethereum Mainnet
      42220: 'https://celoscan.io', // Celo Mainnet
      137: 'https://polygonscan.com', // Polygon
      56: 'https://bscscan.com', // BSC
      43114: 'https://snowtrace.io', // Avalanche
    };

    const explorerBase = explorerMap[chainId];
    if (explorerBase) {
      return `${explorerBase}/tx/${txHash}`;
    }
  }

  // If no chainId but we have a txHash, default to Celo (most common for this app)
  // This handles cases where chainId might not be stored but we know it's Celo
  return `https://celoscan.io/tx/${txHash}`;
}

