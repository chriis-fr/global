"use client";

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
import { getChainByNumericId } from "@/lib/chains";

interface PayablePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payable: {
        _id: string;
        payableNumber: string;
        total: number;
        currency: string;
        paymentMethod: string;
        paymentNetwork?: string;
        paymentAddress?: string;
        paymentMethodDetails?: {
            method?: string;
            network?: string;
            address?: string;
            cryptoDetails?: {
                chainId?: number;
                tokenAddress?: string;
                tokenSymbol?: string;
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
    onClose,
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

    // Extract payment details from payable - check multiple possible locations
    const chainId = payable.paymentMethodDetails?.cryptoDetails?.chainId || 
                    payable.paymentMethodDetails?.chainId ||
                    (payable.paymentMethodDetails as any)?.chainId;
    const tokenAddress = payable.paymentMethodDetails?.cryptoDetails?.tokenAddress || 
                        payable.paymentMethodDetails?.tokenAddress ||
                        (payable.paymentMethodDetails as any)?.tokenAddress;
    const tokenSymbol = payable.paymentMethodDetails?.cryptoDetails?.tokenSymbol || 
                       payable.paymentMethodDetails?.tokenSymbol ||
                       payable.currency;
    const tokenDecimals = payable.paymentMethodDetails?.cryptoDetails?.tokenDecimals || 18;
    const network = payable.paymentNetwork || 
                   payable.paymentMethodDetails?.network ||
                   payable.paymentMethodDetails?.cryptoDetails?.network;
    const payeeAddress = payable.paymentAddress || 
                        payable.paymentMethodDetails?.address ||
                        payable.paymentMethodDetails?.cryptoDetails?.address;

    useEffect(() => {
        if (isOpen) {
            // Detect available wallets when modal opens
            const wallets = detectAvailableWallets();
            setAvailableWallets(wallets);
            setError(null);
            setConnectedWallet(null);
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
            } else if (walletType === "metamask") {
                wallet = await connectMetaMask();
            } else {
                throw new Error("WalletConnect integration coming soon");
            }

            setConnectedWallet(wallet);
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
    const buildSafeAppUrl = (): string => {
        // Get current origin
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        
        // Build our app URL with payment context
        const appUrl = `${origin}/dashboard/services/payables/${payable._id}?pay=true`;
        
        // Build Safe App URL - Request Finance pattern
        // Opens our app within Safe's interface
        // Format: https://app.safe.global/welcome?appUrl={ourAppUrl}
        const safeAppBaseUrl = "https://app.safe.global";
        const safeAppUrl = `${safeAppBaseUrl}/welcome?appUrl=${encodeURIComponent(appUrl)}`;
        
        return safeAppUrl;
    };

    const handleDisconnect = () => {
        setConnectedWallet(null);
        setError(null);
    };

    const getNetworkDisplay = () => {
        if (network) return network;
        if (chainId) {
            const chain = getChainByNumericId(chainId);
            return chain?.name || `Chain ID: ${chainId}`;
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
            
            if (isSafe) {
                // Safe payment - requires proposer private key
                // For now, we'll need the user to provide it or use Safe App
                setError("Safe wallet payments require proposer private key. Please use Safe App or connect as proposer.");
                setProcessing(false);
                return;
            } else {
                // EOA payment - client-side signing
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
                    onClose();
                } else {
                    setError(result.error || "Payment failed");
                }
            }
        } catch (err) {
            console.error("Payment error:", err);
            setError(err instanceof Error ? err.message : "Failed to process payment");
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
                        onClick={onClose}
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
                                This payable is not configured for crypto payment. Please use "Mark as Paid" instead.
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

