"use client";

import { useEffect, useState } from "react";
import { appKit } from "@/lib/reown/appkit";
import { createWalletClient, custom, type Address } from "viem";
import { DEFAULT_CHAIN } from "@/lib/chains";
import { Loader2, Wallet } from "lucide-react";

// EIP-1193 Provider interface
interface EIP1193Provider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    on?(event: string, handler: (...args: unknown[]) => void): void;
    removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

interface WalletConnectButtonProps {
  onConnect: (provider: EIP1193Provider, address: string, walletClient: ReturnType<typeof createWalletClient>) => void;
  onDisconnect?: () => void;
  chainId?: number;
  disabled?: boolean;
}

export default function WalletConnectButton({ 
  onConnect, 
  onDisconnect,
  chainId = 42220, // Default to Celo
  disabled = false 
}: WalletConnectButtonProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected on mount
    const checkConnection = async () => {
      try {
        const provider = appKit.getWalletProvider();
        if (provider) {
          const accounts = await provider.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            const addr = accounts[0];
            setAddress(addr);
            setConnected(true);
            
            // Create wallet client
            const walletClient = createWalletClient({
              transport: custom(provider),
              chain: DEFAULT_CHAIN.chain,
            });
            
            onConnect(provider, addr, walletClient);
          }
        }
      } catch (err) {
        // Not connected, ignore
        console.log('No existing WalletConnect session');
      }
    };

    checkConnection();
  }, [onConnect]);

  async function handleConnect() {
    try {
      setConnecting(true);
      setError(null);

      // Show modal (QR / deep link)
      await appKit.open();

      // Wait for connection
      // Note: AppKit's API may vary - adjust based on actual @reown/appkit API
      const provider = appKit.getWalletProvider();
      
      if (!provider) {
        throw new Error("Failed to get wallet provider");
      }

      // Request accounts
      const accounts = await provider.request({ 
        method: "eth_requestAccounts" 
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned");
      }

      const addr = accounts[0];

      // Switch to correct chain if needed
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${chainId.toString(16)}`,
              chainName: "Celo",
              nativeCurrency: {
                name: "CELO",
                symbol: "CELO",
                decimals: 18,
              },
              rpcUrls: ["https://forno.celo.org"],
              blockExplorerUrls: ["https://celoscan.io"],
            }],
          });
        }
      }

      // Create viem wallet client
      const walletClient = createWalletClient({
        transport: custom(provider),
        chain: DEFAULT_CHAIN.chain,
      });

      setConnected(true);
      setAddress(addr);
      onConnect(provider, addr, walletClient);
    } catch (err) {
      console.error("WalletConnect error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setConnecting(false);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await appKit.disconnect();
    } catch (e) {
      console.error("Disconnect error:", e);
    }
    
    setConnected(false);
    setAddress(null);
    
    if (onDisconnect) {
      onDisconnect();
    }
  }

  if (connected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-green-500" />
          <div className="text-sm text-gray-300">
            Connected: <strong className="text-white">{address.slice(0, 6)}...{address.slice(-4)}</strong>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disabled}
          className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={connecting || disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            <span>Connect Wallet (WalletConnect)</span>
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

