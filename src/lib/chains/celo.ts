import { defineChain } from "viem";

export const CELO = defineChain({
  id: 42220,
  name: "Celo",
  network: "celo-mainnet",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://forno.celo.org"] },
    public: { http: ["https://forno.celo.org"] },
  },
  blockExplorers: {
    default: {
      name: "CeloScan",
      url: "https://celoscan.io"
    }
  }
});

export const CELO_TOKENS = {
  USDT: {
    symbol: "USDT",
    decimals: 6,
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  },
  cUSD: {
    symbol: "cUSD",
    decimals: 18,
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  }
};

export const CELO_SAFE = {
  transactionService: "https://safe-transaction-celo.safe.global/api/v1",
};
