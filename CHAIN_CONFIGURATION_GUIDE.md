# Chain Configuration Guide

## Overview

The application now uses a **centralized chain configuration system** located in `src/lib/chains/index.ts`. This makes it easy to add new blockchain networks without modifying code throughout the application.

## Current Configuration

- **Default Chain**: CELO (chain ID: 42220)
- **Location**: `src/lib/chains/index.ts`
- **CELO Definition**: `src/lib/chains/celo.ts`

## How It Works

### 1. Centralized Chain Registry

All supported chains are defined in the `SUPPORTED_CHAINS` array in `src/lib/chains/index.ts`:

```typescript
export const SUPPORTED_CHAINS: ChainConfig[] = [
    {
        id: 'celo',
        chain: CELO, // Viem chain definition
        tokens: {
            USDT: { ... },
            cUSD: { ... },
        },
        safeTransactionService: "https://safe-transaction-celo.safe.global/api/v1",
        enabled: true,
    },
    // Add more chains here
];
```

### 2. Default Chain Behavior

- **CELO is the first chain** in the array, making it the default
- All functions that don't specify a `chainId` parameter will use CELO
- This maintains backward compatibility with existing code

### 3. Helper Functions

```typescript
// Get default chain (CELO)
getDefaultChain()

// Get chain by ID
getChainById('celo')

// Get chain by numeric ID
getChainByNumericId(42220)

// Get all enabled chains
getEnabledChains()

// Get token by symbol
getTokenBySymbol('celo', 'USDT')

// Get Safe Transaction Service URL
getSafeTransactionServiceUrl('celo')
```

## Adding a New Chain

### Step 1: Create Chain Definition

Create a new file `src/lib/chains/[chain-name].ts`:

```typescript
import { defineChain } from "viem";

export const ETHEREUM = defineChain({
  id: 1,
  name: "Ethereum",
  network: "mainnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://eth.llamarpc.com"] },
    public: { http: ["https://eth.llamarpc.com"] },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://etherscan.io"
    }
  }
});
```

### Step 2: Add to SUPPORTED_CHAINS

In `src/lib/chains/index.ts`, add your chain to the array:

```typescript
import { ETHEREUM } from "./ethereum";

export const SUPPORTED_CHAINS: ChainConfig[] = [
    {
        id: 'celo',
        // ... existing CELO config (keep it first!)
    },
    {
        id: 'ethereum',
        chain: ETHEREUM,
        tokens: {
            USDT: {
                symbol: "USDT",
                decimals: 6,
                address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            },
            DAI: {
                symbol: "DAI",
                decimals: 18,
                address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            },
        },
        safeTransactionService: "https://safe-transaction-mainnet.safe.global/api/v1",
        enabled: true,
    },
];
```

### Step 3: Use the Chain

All payment functions now accept an optional `chainId` parameter:

```typescript
// Uses default chain (CELO)
await payInvoiceDirectEOA({
    payerPrivateKey: "...",
    invoiceId: "123",
});

// Uses Ethereum
await payInvoiceDirectEOA({
    payerPrivateKey: "...",
    invoiceId: "123",
    chainId: "ethereum",
});
```

## Updated Files

The following files now use the centralized chain configuration:

1. **`src/lib/payments/safe.ts`**
   - `getPublicClient(chainId?)` - defaults to CELO
   - `getWalletClient(privateKey, chainId?)` - defaults to CELO
   - `initProtocolKit({ chainId? })` - defaults to CELO
   - `initProtocolKitForDeployedSafe({ chainId? })` - defaults to CELO

2. **`src/lib/payments/celo.ts`**
   - `celoPublicClient(chainId?)` - defaults to CELO
   - `celoWalletClient(signer, chainId?)` - defaults to CELO
   - `sendCeloToken({ chainId? })` - defaults to CELO

3. **`src/app/actions/safe-action.ts`**
   - `payInvoicesWithSafe({ chainId? })` - uses invoice chainId or defaults to CELO

4. **`src/app/actions/eoapay.ts`**
   - `payInvoiceDirectEOA({ chainId? })` - uses invoice chainId or defaults to CELO

## Backward Compatibility

All existing code continues to work because:
- CELO is the default chain (first in array)
- All functions default to CELO when `chainId` is not provided
- Old imports still work (e.g., `CELO_TOKENS` from `@/lib/chains/celo`)

## Benefits

1. **Single Source of Truth**: All chain config in one place
2. **Easy to Add Chains**: Just add to the array
3. **Type Safe**: Full TypeScript support
4. **Flexible**: Can enable/disable chains with `enabled` flag
5. **Backward Compatible**: Existing code works without changes

## Example: Adding Polygon

```typescript
// 1. Create src/lib/chains/polygon.ts
import { polygon } from "viem/chains";
export const POLYGON = polygon;

// 2. Add to SUPPORTED_CHAINS in index.ts
{
    id: 'polygon',
    chain: POLYGON,
    tokens: {
        USDT: { ... },
    },
    safeTransactionService: "https://safe-transaction-polygon.safe.global/api/v1",
    enabled: true,
}

// 3. Use it
await payInvoiceDirectEOA({
    payerPrivateKey: "...",
    invoiceId: "123",
    chainId: "polygon",
});
```

That's it! No other code changes needed.

