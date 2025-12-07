"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { 
    Wallet, 
    Shield, 
    Loader2, 
    AlertCircle, 
    X, 
    CheckCircle2,
    ExternalLink
} from "lucide-react";
import { 
    connectMetaMask, 
    connectSafeWallet, 
    detectAvailableWallets, 
    type ConnectedWallet 
} from "@/lib/wallet/connectWallet";
import { getChainByNumericId, getTokenBySymbol } from "@/lib/chains";
import { generatePayableSafeAppUrl } from "@/lib/safe/safeAppUrl";

interface PayablePaymentModalProps {
    isOpen: boolean;
    onCloseAction: () => void;
    payable: {
        _id: string;
        payableNumber: string;
        total: number;
        currency: string;
        paymentMethod: string;
        paymentNetwork?: string;
        paymentAddress?: string;
        chainId?: number; // Top-level chainId
        tokenAddress?: string; // Top-level tokenAddress
        paymentMethodDetails?: {
            method?: string;
            network?: string;
            address?: string;
            cryptoDetails?: {
                chainId?: number;
                tokenAddress?: string;
                tokenSymbol?: string;
                tokenDecimals?: number;
            };
        };
    };
    onPaymentSuccess?: () => void;
}

type WalletOption = {
    id: "safe" | "metamask" | "walletconnect";
    name: string;
    icon: React.ReactNode;
    description: string;
    available: boolean;
};

export default function PayablePaymentModal({
    isOpen,
    onCloseAction,
    payable,
    onPaymentSuccess,
}: PayablePaymentModalProps) {
    const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableWallets, setAvailableWallets] = useState({
        hasSafe: false,
        hasMetaMask: false,
        hasWalletConnect: false,
    });
    const [processing, setProcessing] = useState(false);
    
    // WalletConnect specific state
    // EIP-1193 Provider interface
    interface EIP1193Provider {
        request(args: { method: string; params?: unknown[] }): Promise<unknown>;
        on?(event: string, handler: (...args: unknown[]) => void): void;
        removeListener?(event: string, handler: (...args: unknown[]) => void): void;
    }
    const [wcProvider, setWcProvider] = useState<EIP1193Provider | null>(null);
    const [wcWalletClient, setWcWalletClient] = useState<ReturnType<typeof import("viem").createWalletClient> | null>(null);
    const [wcAddress, setWcAddress] = useState<string | null>(null);
    const [selectedWalletType, setSelectedWalletType] = useState<"safe" | "metamask" | "walletconnect" | null>(null);

    // Extract payment details from payable - check multiple possible locations
    // Priority: top-level > cryptoDetails > paymentMethodDetails
    const chainId = payable.chainId || 
                    payable.paymentMethodDetails?.cryptoDetails?.chainId;
    const tokenAddress = payable.tokenAddress ||
                        payable.paymentMethodDetails?.cryptoDetails?.tokenAddress;
    const tokenSymbol = payable.paymentMethodDetails?.cryptoDetails?.tokenSymbol || 
                       payable.currency;
    
    // Get token decimals - try to look up from chain config if not provided
    let tokenDecimals = payable.paymentMethodDetails?.cryptoDetails?.tokenDecimals;
    if (!tokenDecimals && chainId && tokenAddress) {
        // Look up token decimals from chain configuration by token address
        const chain = getChainByNumericId(chainId);
        if (chain && chain.tokens) {
            // Find token by address (case-insensitive)
            const tokenLower = tokenAddress.toLowerCase();
            const tokenEntry = Object.values(chain.tokens).find(
                token => token.address.toLowerCase() === tokenLower
            );
            if (tokenEntry) {
                tokenDecimals = tokenEntry.decimals;
                console.log("Found token decimals from chain config:", {
                    tokenAddress,
                    symbol: tokenEntry.symbol,
                    decimals: tokenDecimals,
                });
            }
        }
    }
    // If still not found, try by symbol
    if (!tokenDecimals && chainId && tokenSymbol) {
        const chain = getChainByNumericId(chainId);
        if (chain) {
            const tokenInfo = getTokenBySymbol(chain.id, tokenSymbol);
            if (tokenInfo) {
                tokenDecimals = tokenInfo.decimals;
                console.log("Found token decimals by symbol:", {
                    symbol: tokenSymbol,
                    decimals: tokenDecimals,
                });
            }
        }
    }
    // Default to 18 only if we couldn't determine it (most ERC20 tokens use 18)
    if (!tokenDecimals) {
        tokenDecimals = 18;
        console.warn("Using default 18 decimals. Token decimals not found for:", {
            tokenAddress,
            tokenSymbol,
            chainId,
        });
    }
    const network = payable.paymentNetwork || 
                   payable.paymentMethodDetails?.network;
    // Get payee address - this should be the RECIPIENT (invoice creator's receiving address)
    // NOT the payer's address. Check multiple possible locations.
    const payeeAddress = payable.paymentAddress || 
                        payable.paymentMethodDetails?.address;
    
    // Log payment address extraction for debugging
    console.log("Payment address extraction:", {
        paymentAddress: payable.paymentAddress,
        paymentMethodDetailsAddress: payable.paymentMethodDetails?.address,
        // cryptoDetails doesn't have address property
        finalPayeeAddress: payeeAddress,
        connectedWalletAddress: connectedWallet?.address,
        isSame: payeeAddress && connectedWallet?.address && 
                payeeAddress.toLowerCase() === connectedWallet.address.toLowerCase(),
    });
    
    // Validate that payeeAddress is not the same as the connected wallet
    // If they match, it means the address is wrong (should be recipient, not payer)
    if (payeeAddress && connectedWallet?.address && 
        payeeAddress.toLowerCase() === connectedWallet.address.toLowerCase()) {
        console.error("ERROR: Payee address matches payer address! This is incorrect.", {
            payeeAddress,
            payerAddress: connectedWallet.address,
            payable: payable,
        });
        // Don't throw here, but log the issue - the actual payment will fail validation
    }

    useEffect(() => {
        if (isOpen) {
            // Detect available wallets when modal opens
            const wallets = detectAvailableWallets();
            setAvailableWallets(wallets);
            setError(null);
            setConnectedWallet(null);
            // Reset WalletConnect state
            setWcProvider(null);
            setWcWalletClient(null);
            setWcAddress(null);
            setSelectedWalletType(null);
        }
    }, [isOpen]);

    const walletOptions: WalletOption[] = [
        {
            id: "safe",
            name: "Safe Wallet",
            icon: <Shield className="h-5 w-5" />,
            description: availableWallets.hasSafe ? "Multi-signature wallet" : "Open in Safe App",
            available: true, // Always available - can redirect to Safe App
        },
        {
            id: "metamask",
            name: "MetaMask",
            icon: <Wallet className="h-5 w-5" />,
            description: availableWallets.hasMetaMask ? "Browser extension wallet" : "Install MetaMask extension",
            available: true, // Always available - let connection handle errors
        },
        {
            id: "walletconnect",
            name: "WalletConnect",
            icon: <Wallet className="h-5 w-5" />,
            description: "Connect via QR code",
            available: true, // Always available
        },
    ];

    const handleConnectWallet = async (walletType: "safe" | "metamask" | "walletconnect") => {
        setConnecting(true);
        setError(null);
        setSelectedWalletType(walletType);

        try {
            let wallet: ConnectedWallet;

            if (walletType === "safe") {
                // If Safe is not available in current environment, redirect to Safe App
                if (!availableWallets.hasSafe) {
                    // Build Safe App URL with payment details
                    const safeAppUrl = buildSafeAppUrl();
                    window.open(safeAppUrl, '_blank');
                    setError("Opening Safe App in new tab. Please complete payment there.");
                    setConnecting(false);
                    return;
                }
                wallet = await connectSafeWallet();
                setConnectedWallet(wallet);
            } else if (walletType === "metamask") {
                wallet = await connectMetaMask();
                setConnectedWallet(wallet);
            } else if (walletType === "walletconnect") {
                // Directly open WalletConnect modal
                const { appKit } = await import("@/lib/reown/appkit");
                await appKit.open();
                
                // Poll for connection (check every 500ms for up to 30 seconds)
                let attempts = 0;
                const maxAttempts = 60;
                
                const checkConnection = async (): Promise<boolean> => {
                    try {
                        const provider = appKit.getWalletProvider() as EIP1193Provider | null;
                        if (provider && provider.request) {
                            const accounts = await provider.request({ method: "eth_accounts" }) as string[];
                            if (accounts && accounts.length > 0) {
                                const addr = accounts[0];
                                
                                // Switch to correct chain if needed
                                try {
                                    await provider.request({
                                        method: "wallet_switchEthereumChain",
                                        params: [{ chainId: `0x${(chainId || 42220).toString(16)}` }],
                                    });
                                } catch (switchError: unknown) {
                                    const error = switchError as { code?: number };
                                    if (error.code === 4902) {
                                        await provider.request({
                                            method: "wallet_addEthereumChain",
                                            params: [{
                                                chainId: `0x${(chainId || 42220).toString(16)}`,
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
                                
                                // Create wallet client
                                const { createWalletClient, custom } = await import("viem");
                                const { DEFAULT_CHAIN } = await import("@/lib/chains");
                                const walletClient = createWalletClient({
                                    transport: custom(provider),
                                    chain: DEFAULT_CHAIN.chain,
                                });
                                
                                // Set connected state
                                setWcProvider(provider);
                                setWcAddress(addr);
                                setWcWalletClient(walletClient);
                                
                                const connectedWallet: ConnectedWallet = {
                                    address: addr,
                                    type: "walletconnect",
                                };
                                setConnectedWallet(connectedWallet);
                                setSelectedWalletType("walletconnect");
                                setConnecting(false);
                                return true;
                            }
                        }
                    } catch (err) {
                        console.error("Connection check error:", err);
                    }
                    return false;
                };
                
                // Start polling
                const pollInterval = setInterval(async () => {
                    attempts++;
                    const connected = await checkConnection();
                    
                    if (connected || attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        if (!connected && attempts >= maxAttempts) {
                            setError("Connection timeout. Please try again.");
                            setConnecting(false);
                        }
                    }
                }, 500);
                
                // Also check immediately
                const connected = await checkConnection();
                if (connected) {
                    clearInterval(pollInterval);
                }
                return;
            } else {
                throw new Error("Unknown wallet type");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
            setError(errorMessage);
            
            // If MetaMask not found, provide helpful message
            if (walletType === "metamask" && errorMessage.includes("MetaMask not found")) {
                setError("MetaMask not found. Please install MetaMask extension or use Safe App.");
            }
        } finally {
            setConnecting(false);
        }
    };


    // Build Safe App URL for redirect (like Request Finance)
    // Uses the /share/safe-app format which works 100% without Safe approval
    const buildSafeAppUrl = (): string => {
        // Get public URL - prioritize environment variable (ngrok/production) over localhost
        // This ensures Safe can access the manifest and load the app
        const getPublicUrl = (): string => {
            // Check for public URL in environment (for ngrok/production)
            if (typeof window !== "undefined") {
                // Try to get from meta tag or use environment variable
                const metaUrl = document.querySelector('meta[name="public-url"]')?.getAttribute('content');
                if (metaUrl) return metaUrl;
            }
            
            // Fallback: use NEXT_PUBLIC_BASE_URL, NEXTAUTH_URL, or window.location.origin
            // Note: NEXTAUTH_URL is server-side only, so we use NEXT_PUBLIC_BASE_URL for client
            const envUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                          process.env.NEXT_PUBLIC_NEXTAUTH_URL ||
                          (typeof window !== "undefined" ? window.location.origin : "");
            
            return envUrl;
        };
        
        const publicUrl = getPublicUrl();
        
        // Use the utility function to generate the proper Safe App URL
        // This uses the /share/safe-app format that works immediately
        return generatePayableSafeAppUrl(
            payable._id,
            publicUrl,
            undefined, // No specific Safe address - user will select
            chainId
        );
    };

    const handleDisconnect = async () => {
        // If WalletConnect, disconnect from AppKit
        if (selectedWalletType === "walletconnect") {
            try {
                const { appKit } = await import("@/lib/reown/appkit");
                await appKit.disconnect();
            } catch (e) {
                console.error("Disconnect error:", e);
            }
        }
        
        // Reset all wallet state
        setWcProvider(null);
        setWcAddress(null);
        setWcWalletClient(null);
        setConnectedWallet(null);
        setSelectedWalletType(null);
        setError(null);
    };

    const getNetworkDisplay = () => {
        if (network) return network;
        if (chainId) {
            const chain = getChainByNumericId(chainId);
            return chain?.chain.name || `Chain ID: ${chainId}`;
        }
        return "Not specified";
    };

    const handlePay = async () => {
        if (!connectedWallet) {
            setError("Please connect a wallet first");
            return;
        }

        if (!payeeAddress) {
            setError("Payment address is missing. Please contact the vendor.");
            return;
        }
        
        // TODO: Re-enable this validation after testing
        // Validate that payeeAddress is different from the payer's address
        // if (payeeAddress.toLowerCase() === connectedWallet.address.toLowerCase()) {
        //     setError("Payment address cannot be the same as your wallet address. The payment address should be the invoice creator's receiving address. Please contact the vendor to update the payment details.");
        //     return;
        // }

        if (!chainId) {
            setError("Chain ID is missing. Please contact the vendor to update payment details.");
            return;
        }

        if (!tokenAddress) {
            setError("Token address is missing. Please contact the vendor to update payment details.");
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const isSafe = connectedWallet.type === "safe";
            const isWalletConnect = connectedWallet.type === "walletconnect";
            
            if (isSafe) {
                // Safe payment - requires proposer private key
                // For now, we'll need the user to provide it or use Safe App
                setError("Safe wallet payments require proposer private key. Please use Safe App or connect as proposer.");
                setProcessing(false);
                return;
            } else if (isWalletConnect && wcProvider && wcWalletClient) {
                // WalletConnect payment - use WalletConnect provider
                const { payWithWalletConnect } = await import("@/lib/wallet/payWithWalletConnect");
                
                // Sign and send transaction client-side using WalletConnect
                const txHash = await payWithWalletConnect({
                    provider: wcProvider,
                    walletAddress: wcAddress!,
                    tokenAddress: tokenAddress as string,
                    toAddress: payeeAddress as string,
                    amount: payable.total,
                    decimals: tokenDecimals,
                    chainId: chainId!,
                });

                // Send txHash to server to update payable status
                const { payPayableWithEOAHash } = await import("@/app/actions/payable-payment-actions");
                
                const result = await payPayableWithEOAHash({
                    payableId: payable._id,
                    txHash: txHash,
                    fromAddress: wcAddress!,
                    chainId: chainId.toString(),
                });

                if (result.success) {
                    // Success - close modal and refresh
                    if (onPaymentSuccess) {
                        onPaymentSuccess();
                    }
                    onCloseAction();
                } else {
                    setError(result.error || "Payment failed");
                }
            } else {
                // EOA payment (MetaMask) - client-side signing
                const { payWithEOAWallet } = await import("@/lib/wallet/payWithWallet");
                
                // Sign and send transaction client-side
                const txHash = await payWithEOAWallet({
                    walletAddress: connectedWallet.address,
                    tokenAddress: tokenAddress as string,
                    toAddress: payeeAddress as string,
                    amount: payable.total,
                    decimals: tokenDecimals,
                    chainId: chainId?.toString() || '',
                });

                // Send txHash to server to update payable status
                const { payPayableWithEOAHash } = await import("@/app/actions/payable-payment-actions");
                
                const result = await payPayableWithEOAHash({
                    payableId: payable._id,
                    txHash: txHash,
                    fromAddress: connectedWallet.address,
                    chainId: chainId.toString(),
                });

                if (result.success) {
                    // Success - close modal and refresh
                    if (onPaymentSuccess) {
                        onPaymentSuccess();
                    }
                    onCloseAction();
                } else {
                    setError(result.error || "Payment failed");
                }
            }
        } catch (err: any) {
            // Check if user cancelled/rejected
            const isUserCancellation = 
                err?.message?.toLowerCase().includes('cancelled') ||
                err?.message?.toLowerCase().includes('rejected') ||
                err?.message?.toLowerCase().includes('denied') ||
                err?.code === 4001 ||
                err?.code === 'ACTION_REJECTED';
            
            if (isUserCancellation) {
                // User cancelled - don't show error, just close or reset
                setError(null);
                setProcessing(false);
                return;
            }
            
            console.error("Payment error:", err);
            
            // Extract error message from various possible locations
            let errorMessage = "Failed to process payment";
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (err?.message) {
                errorMessage = err.message;
            } else if (err?.reason) {
                errorMessage = err.reason;
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else if (err && typeof err === 'object') {
                // Try to extract message from error object
                try {
                    const errorStr = JSON.stringify(err, Object.getOwnPropertyNames(err));
                    if (errorStr !== '{}') {
                        errorMessage = `Payment failed: ${errorStr}`;
                    }
                } catch {
                    errorMessage = String(err);
                }
            }
            
            console.error("Error details:", {
                error: err,
                errorType: typeof err,
                errorConstructor: err?.constructor?.name,
                message: errorMessage,
                originalError: err?.originalError,
                code: err?.code,
                reason: err?.reason,
                connectedWallet,
                chainId,
                tokenAddress,
                payeeAddress,
                stringified: err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'null',
            });
            
            setError(errorMessage);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    const isCrypto = payable.paymentMethod === "crypto" || payable.paymentMethodDetails?.method === "crypto";

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Pay Payable</h3>
                    <button
                        type="button"
                        onClick={onCloseAction}
                        disabled={processing}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Payment Details */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                    <div className="font-medium text-gray-900 mb-2">Payment Details</div>
                    <div className="text-xs text-gray-600 space-y-1">
                        <div>
                            Amount: <span className="font-medium">{payable.total} {tokenSymbol}</span>
                        </div>
                        <div>
                            Network: <span className="font-medium">{getNetworkDisplay()}</span>
                        </div>
                        <div>
                            Chain ID: <span className="font-medium">{chainId || 'Not set'}</span>
                        </div>
                        <div>
                            Token: <span className="font-medium font-mono text-xs">
                                {tokenAddress ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}` : 'Not set'}
                            </span>
                        </div>
                        <div>
                            To: <span className="font-medium font-mono text-xs">
                                {payeeAddress ? `${payeeAddress.slice(0, 6)}...${payeeAddress.slice(-4)}` : 'Not set'}
                            </span>
                        </div>
                        {payable.payableNumber && (
                            <div className="mt-2 pt-2 border-t border-blue-200">
                                Payable ID: <span className="font-medium">{payable.payableNumber}</span>
                            </div>
                        )}
                    </div>
                </div>

                {!isCrypto && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800">
                                This payable is not configured for crypto payment. Please use &quot;Mark as Paid&quot; instead.
                            </p>
                        </div>
                    </div>
                )}

                {/* Wallet Selection */}
                {isCrypto && (
                    <div className="space-y-3">
                        {!connectedWallet ? (
                            <>
                                <div className="text-sm font-medium text-gray-900 mb-2">
                                    Connect Wallet
                                </div>
                                <div className="space-y-2">
                                    {walletOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => handleConnectWallet(option.id)}
                                            disabled={connecting}
                                            className="w-full p-3 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-blue-600">
                                                    {option.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">{option.name}</div>
                                                    <div className="text-xs text-gray-600">{option.description}</div>
                                                </div>
                                                {option.id === "safe" && !availableWallets.hasSafe && (
                                                    <ExternalLink className="h-4 w-4 text-gray-400" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {connecting && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Connecting...</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {connectedWallet.type === "safe" ? "Safe Wallet" : 
                                                 connectedWallet.type === "metamask" ? "MetaMask" : 
                                                 connectedWallet.type === "walletconnect" ? "WalletConnect" :
                                                 "Connected Wallet"}
                                            </div>
                                            <div className="text-xs text-gray-600 font-mono">
                                                {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        className="text-xs text-red-600 hover:text-red-700"
                                        disabled={processing}
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Pay Button */}
                        {connectedWallet && (
                            <button
                                onClick={handlePay}
                                disabled={processing || !payeeAddress}
                                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Processing Payment...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wallet className="h-4 w-4" />
                                        <span>Pay {payable.total} {tokenSymbol}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

