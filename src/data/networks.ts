export interface Network {
  id: string;
  name: string;
  chainId: string;
  type: 'mainnet' | 'testnet';
  logo?: string;
  rpcUrl?: string;
  explorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const networks: Network[] = [
  {
    id: 'celo',
    name: 'Celo',
    chainId: '42220',
    type: 'mainnet',
    logo: '/networks/celo.png',
    rpcUrl: 'https://forno.celo.org',
    explorerUrl: 'https://explorer.celo.org',
    nativeCurrency: {
      name: 'CELO',
      symbol: 'CELO',
      decimals: 18
    }
  },
  {
    id: 'scroll',
    name: 'Scroll',
    chainId: '534352',
    type: 'mainnet',
    logo: '/networks/scroll.png',
    rpcUrl: 'https://rpc.scroll.io',
    explorerUrl: 'https://scrollscan.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: '1',
    type: 'mainnet',
    logo: '/networks/ethereum.png',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: '137',
    type: 'mainnet',
    logo: '/networks/polygon.png',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: '56',
    type: 'mainnet',
    logo: '/networks/bsc.png',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    }
  },
  {
    id: 'solana',
    name: 'Solana',
    chainId: '101',
    type: 'mainnet',
    logo: '/networks/solana.png',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: {
      name: 'SOL',
      symbol: 'SOL',
      decimals: 9
    }
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    chainId: '43114',
    type: 'mainnet',
    logo: '/networks/avalanche.png',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  {
    id: 'fantom',
    name: 'Fantom',
    chainId: '250',
    type: 'mainnet',
    logo: '/networks/fantom.png',
    rpcUrl: 'https://rpc.ftm.tools',
    explorerUrl: 'https://ftmscan.com',
    nativeCurrency: {
      name: 'FTM',
      symbol: 'FTM',
      decimals: 18
    }
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: '42161',
    type: 'mainnet',
    logo: '/networks/arbitrum.png',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'optimism',
    name: 'Optimism',
    chainId: '10',
    type: 'mainnet',
    logo: '/networks/optimism.png',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'base',
    name: 'Base',
    chainId: '8453',
    type: 'mainnet',
    logo: '/networks/base.png',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'cardano',
    name: 'Cardano',
    chainId: 'cardano',
    type: 'mainnet',
    logo: '/networks/cardano.png',
    rpcUrl: 'https://cardano-mainnet.blockfrost.io/api/v0',
    explorerUrl: 'https://explorer.cardano.org',
    nativeCurrency: {
      name: 'ADA',
      symbol: 'ADA',
      decimals: 6
    }
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    chainId: 'polkadot',
    type: 'mainnet',
    logo: '/networks/polkadot.png',
    rpcUrl: 'wss://rpc.polkadot.io',
    explorerUrl: 'https://polkascan.io/polkadot',
    nativeCurrency: {
      name: 'DOT',
      symbol: 'DOT',
      decimals: 10
    }
  },
  {
    id: 'cosmos',
    name: 'Cosmos Hub',
    chainId: 'cosmoshub-4',
    type: 'mainnet',
    logo: '/networks/cosmos.png',
    rpcUrl: 'https://rpc.cosmos.network:26657',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    nativeCurrency: {
      name: 'ATOM',
      symbol: 'ATOM',
      decimals: 6
    }
  },
  {
    id: 'near',
    name: 'NEAR Protocol',
    chainId: 'near',
    type: 'mainnet',
    logo: '/networks/near.png',
    rpcUrl: 'https://rpc.mainnet.near.org',
    explorerUrl: 'https://explorer.near.org',
    nativeCurrency: {
      name: 'NEAR',
      symbol: 'NEAR',
      decimals: 24
    }
  },
  {
    id: 'algorand',
    name: 'Algorand',
    chainId: 'algorand',
    type: 'mainnet',
    logo: '/networks/algorand.png',
    rpcUrl: 'https://mainnet-api.algonode.cloud',
    explorerUrl: 'https://algoexplorer.io',
    nativeCurrency: {
      name: 'ALGO',
      symbol: 'ALGO',
      decimals: 6
    }
  },
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    chainId: 'bitcoin',
    type: 'mainnet',
    logo: '/networks/bitcoin.png',
    rpcUrl: 'https://bitcoin.getblock.io/mainnet',
    explorerUrl: 'https://blockstream.info',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8
    }
  },
  {
    id: 'litecoin',
    name: 'Litecoin',
    chainId: 'litecoin',
    type: 'mainnet',
    logo: '/networks/litecoin.png',
    rpcUrl: 'https://litecoin.getblock.io/mainnet',
    explorerUrl: 'https://blockchair.com/litecoin',
    nativeCurrency: {
      name: 'Litecoin',
      symbol: 'LTC',
      decimals: 8
    }
  },
  {
    id: 'ripple',
    name: 'Ripple',
    chainId: 'ripple',
    type: 'mainnet',
    logo: '/networks/ripple.png',
    rpcUrl: 'https://s1.ripple.com:51234',
    explorerUrl: 'https://xrpscan.com',
    nativeCurrency: {
      name: 'XRP',
      symbol: 'XRP',
      decimals: 6
    }
  }
];

export function getNetworkById(id: string): Network | undefined {
  return networks.find(network => network.id === id);
}

export function getNetworkByChainId(chainId: string): Network | undefined {
  return networks.find(network => network.chainId === chainId);
}

export function getMainnetNetworks(): Network[] {
  return networks.filter(network => network.type === 'mainnet');
}

export function getTestnetNetworks(): Network[] {
  return networks.filter(network => network.type === 'testnet');
} 