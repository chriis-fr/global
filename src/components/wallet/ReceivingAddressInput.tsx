"use client";

import { useState, useEffect, useRef } from "react";
import { Wallet, Copy, CheckCircle2, Loader2, AlertCircle, Shield, ChevronDown, X } from "lucide-react";
import { connectMetaMask, connectSafeWallet, detectAvailableWallets, type ConnectedWallet } from "@/lib/wallet/connectWallet";
import { getChainByNumericId, SUPPORTED_CHAINS } from "@/lib/chains";

interface ReceivingAddressInputProps {
    value: string;
    onChangeAction: (address: string, metadata?: { 
        mode: "manual" | "wallet"; 
        walletType: string | null;
        chainId?: number;
        tokenAddress?: string;
        network?: string;
    }) => void;
    network?: string;
    chainId?: number;
    tokenAddress?: string;
    disabled?: boolean;
}

type WalletOption = {
    id: "safe" | "metamask" | "walletconnect";
    name: string;
    icon: React.ReactNode;
    description: string;
    available: boolean;
};

export default function ReceivingAddressInput({
    value,
    onChangeAction,
    network,
    chainId,
    tokenAddress,
    disabled = false,
}: ReceivingAddressInputProps) {
    const [mode, setMode] = useState<"manual" | "wallet">("manual");
    const [manualAddress, setManualAddress] = useState("");
    const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showWalletSelector, setShowWalletSelector] = useState(false);
    const [availableWallets, setAvailableWallets] = useState({
        hasSafe: false,
        hasMetaMask: false,
        hasWalletConnect: false,
    });

    useEffect(() => {
        // Detect available wallets
        const wallets = detectAvailableWallets();
        setAvailableWallets(wallets);
    }, []);

    // Track if we're updating from parent to prevent loops
    const isUpdatingFromParent = useRef(false);

    useEffect(() => {
        // Only sync with parent value if it's different from our current state
        const currentAddress = mode === "manual" ? manualAddress : connectedWallet?.address || "";
        
        if (value && value !== currentAddress) {
            isUpdatingFromParent.current = true;
            if (mode === "manual") {
                setManualAddress(value);
            } else if (connectedWallet && connectedWallet.address !== value) {
                // If value changed externally and we're in wallet mode, switch to manual
                setMode("manual");
                setManualAddress(value);
                setConnectedWallet(null);
            }
            // Reset flag after a brief delay
            setTimeout(() => {
                isUpdatingFromParent.current = false;
            }, 100);
        } else if (!value && manualAddress && mode === "manual") {
            // Clear if value is cleared and we're in manual mode
            setManualAddress("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]); // Sync when value changes from parent

    useEffect(() => {
        // Don't notify parent if we're currently updating from parent
        if (isUpdatingFromParent.current) {
            return;
        }

        // Notify parent of address change
        const address = mode === "manual" ? manualAddress : connectedWallet?.address || "";
        const metadata = {
            mode,
            walletType: connectedWallet?.type || null,
            chainId: chainId,
            tokenAddress: tokenAddress,
            network: network,
        };
        
        // Only notify if address has actually changed
        if (address !== value) {
            onChangeAction(address, metadata);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, manualAddress, connectedWallet, chainId, tokenAddress, network]); // onChange and value excluded to prevent loops

    const walletOptions: WalletOption[] = [
        {
            id: "safe",
            name: "Safe Wallet",
            icon: <Shield className="h-5 w-5" />,
            description: "Multi-signature wallet",
            available: availableWallets.hasSafe,
        },
        {
            id: "metamask",
            name: "MetaMask",
            icon: <Wallet className="h-5 w-5" />,
            description: "Browser extension wallet",
            available: availableWallets.hasMetaMask,
        },
        {
            id: "walletconnect",
            name: "WalletConnect",
            icon: <Wallet className="h-5 w-5" />,
            description: "Connect via QR code",
            available: availableWallets.hasWalletConnect,
        },
    ];

    const handleConnectWallet = async (walletType: "safe" | "metamask" | "walletconnect") => {
        setConnecting(true);
        setError(null);
        setShowWalletSelector(false);

        try {
            let wallet: ConnectedWallet;

            if (walletType === "safe") {
                wallet = await connectSafeWallet();
            } else if (walletType === "metamask") {
                wallet = await connectMetaMask();
            } else {
                // WalletConnect - placeholder for now
                throw new Error("WalletConnect integration coming soon");
            }

            setConnectedWallet(wallet);
            setMode("wallet");
            setManualAddress(""); // Clear manual address when wallet is connected
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect wallet");
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = () => {
        setConnectedWallet(null);
        setMode("manual");
        setManualAddress("");
        setError(null);
    };

    const copyAddress = () => {
        const address = mode === "manual" ? manualAddress : connectedWallet?.address || "";
        if (address) {
            navigator.clipboard.writeText(address);
            // You could add a toast notification here
        }
    };

    const getNetworkDisplay = () => {
        if (!network) return null;
        return network.charAt(0).toUpperCase() + network.slice(1);
    };

    const getTokenDisplay = () => {
        if (!tokenAddress) return null;
        
        // Try to find token in chain configuration
        if (chainId) {
            const chain = getChainByNumericId(chainId);
            if (chain?.tokens) {
                for (const [symbol, token] of Object.entries(chain.tokens)) {
                    if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
                        return symbol;
                    }
                }
            }
        }
        
        // Fallback: check all chains
        for (const chain of SUPPORTED_CHAINS) {
            if (chain.tokens) {
                for (const [symbol, token] of Object.entries(chain.tokens)) {
                    if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
                        return symbol;
                    }
                }
            }
        }
        
        return "Custom Token";
    };

    return (
        <div className="space-y-3">
            {/* Mode Selection */}
            <div className="space-y-2">
                <label className="flex items-center text-sm text-gray-600">
                    <input
                        type="radio"
                        name="receivingMode"
                        checked={mode === "manual"}
                        onChange={() => {
                            setMode("manual");
                            setConnectedWallet(null);
                            setError(null);
                        }}
                        disabled={disabled}
                        className="mr-2"
                    />
                    Paste address manually
                </label>
                <label className="flex items-center text-sm text-gray-600">
                    <input
                        type="radio"
                        name="receivingMode"
                        checked={mode === "wallet"}
                        onChange={() => {
                            if (!connectedWallet) {
                                setShowWalletSelector(true);
                            } else {
                                setMode("wallet");
                            }
                        }}
                        disabled={disabled}
                        className="mr-2"
                    />
                    Connect wallet
                </label>
            </div>

            {/* Manual Input */}
            {mode === "manual" && (
                <div>
                    <input
                        type="text"
                        value={manualAddress}
                        onChange={(e) => {
                            setManualAddress(e.target.value);
                            setError(null);
                        }}
                        placeholder="Enter wallet address"
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                    />
                </div>
            )}

            {/* Wallet Connection */}
            {mode === "wallet" && (
                <div className="space-y-2">
                    {!connectedWallet ? (
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowWalletSelector(true)}
                                disabled={connecting || disabled}
                                className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4" />
                                    <span>Choose Wallet</span>
                                </div>
                                <ChevronDown className="h-4 w-4" />
                            </button>
                            
                            {/* Chain and Token Info */}
                            {(chainId || network || tokenAddress) && (
                                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">Network:</span>
                                        <span>{getNetworkDisplay() || `Chain ID: ${chainId}` || "Not specified"}</span>
                                    </div>
                                    {tokenAddress && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-medium">Token:</span>
                                            <span>{getTokenDisplay() || "Custom Token"}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {connectedWallet.type === "safe" ? "Safe Wallet" : 
                                                 connectedWallet.type === "metamask" ? "MetaMask" : 
                                                 "Connected Wallet"}
                                            </div>
                                            <div className="text-xs text-gray-600 font-mono">
                                                {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={copyAddress}
                                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Copy address"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDisconnect}
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Chain and Token Info Display */}
                                {(chainId || network || tokenAddress) && (
                                    <div className="pt-2 border-t border-green-200 text-xs text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Network:</span>
                                            <span>{getNetworkDisplay() || `Chain ID: ${chainId}` || "Not specified"}</span>
                                        </div>
                                        {tokenAddress && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-medium">Token:</span>
                                                <span>{getTokenDisplay() || "Custom Token"}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Wallet Selector Modal */}
            {showWalletSelector && (
                <div className="fixed inset-0 border border-gray-600 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Choose Wallet</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowWalletSelector(false);
                                    setError(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Chain and Token Info */}
                        {(chainId || network || tokenAddress) && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                                <div className="font-medium text-gray-900 mb-1">Payment Details</div>
                                <div className="text-xs text-gray-600 space-y-1">
                                    {network && (
                                        <div>Network: <span className="font-medium">{getNetworkDisplay()}</span></div>
                                    )}
                                    {chainId && (
                                        <div>Chain ID: <span className="font-medium">{chainId}</span></div>
                                    )}
                                    {tokenAddress && (
                                        <div>Token: <span className="font-medium">{getTokenDisplay() || "Custom Token"}</span></div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {walletOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleConnectWallet(option.id)}
                                    disabled={!option.available || connecting}
                                    className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                        option.available
                                            ? "border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer"
                                            : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`${option.available ? "text-blue-600" : "text-gray-400"}`}>
                                            {option.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">{option.name}</div>
                                            <div className="text-xs text-gray-600">{option.description}</div>
                                        </div>
                                        {!option.available && (
                                            <span className="text-xs text-gray-400">Not available</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {connecting && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Connecting...</span>
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-800">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && !showWalletSelector && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{error}</p>
                </div>
            )}
        </div>
    );
}
