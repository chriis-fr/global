"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SafeAppsSDK from "@safe-global/safe-apps-sdk";
import { parseUnits } from "viem";
import { Loader2, AlertCircle, CheckCircle2, Shield } from "lucide-react";

// ERC20 Transfer ABI
const ERC20_ABI = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    }
] as const;

interface SafeInfo {
    safeAddress: string;
    chainId: number;
    owners: string[];
    threshold: number;
    isReadOnly: boolean;
}

export default function SafePayPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const payableId = searchParams.get("payableId");
    const invoiceId = searchParams.get("invoiceId");
    
    const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
    const [appsSdk, setAppsSdk] = useState<SafeAppsSDK | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [safeTxHash, setSafeTxHash] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState<{
        amount: number;
        tokenAddress: string;
        toAddress: string;
        chainId: number;
        tokenDecimals: number;
        tokenSymbol: string;
    } | null>(null);
    const [isSafe, setIsSafe] = useState(false);

    const fetchPaymentData = async () => {
        try {
            if (payableId) {
                const { getPayableWithInvoice } = await import("@/app/actions/payable-actions");
                const result = await getPayableWithInvoice(payableId);
                
                if (result.success && result.data) {
                    const payable = result.data;
                    const chainId = payable.chainId || 
                                   payable.paymentMethodDetails?.cryptoDetails?.chainId || 
                                   42220; // Default to Celo
                    const tokenAddress = payable.tokenAddress ||
                                       payable.paymentMethodDetails?.cryptoDetails?.tokenAddress;
                    const tokenSymbol = payable.currency || "USDT";
                    const tokenDecimals = payable.paymentMethodDetails?.cryptoDetails?.tokenDecimals || 18;
                    const toAddress = payable.paymentAddress || 
                                    payable.paymentMethodDetails?.address ||
                                    payable.paymentMethodDetails?.cryptoDetails?.address;

                    if (!tokenAddress || !toAddress) {
                        setError("Payment details are incomplete. Missing token address or recipient address.");
                        return;
                    }

                    setPaymentData({
                        amount: payable.total,
                        tokenAddress,
                        toAddress,
                        chainId,
                        tokenDecimals,
                        tokenSymbol,
                    });
                } else {
                    setError(result.error || "Failed to fetch payable details");
                }
            } else if (invoiceId) {
                // Fetch invoice data (similar pattern)
                const { getInvoiceById } = await import("@/app/actions/invoice-actions");
                const invoice = await getInvoiceById(invoiceId);
                
                if (invoice) {
                    const invoiceTyped = invoice as {
                        chainId?: number;
                        tokenAddress?: string;
                        currency?: string;
                        payeeAddress?: string;
                        totalAmount?: number;
                        total?: number;
                        paymentSettings?: {
                            chainId?: number;
                            tokenAddress?: string;
                            tokenDecimals?: number;
                            walletAddress?: string;
                        };
                    };
                    const chainId = invoiceTyped.chainId ||
                                   invoiceTyped.paymentSettings?.chainId ||   
                                   42220;
                    const tokenAddress = invoiceTyped.tokenAddress ||
                                       invoiceTyped.paymentSettings?.tokenAddress;
                    const tokenSymbol = invoiceTyped.currency || "USDT";
                    const tokenDecimals = invoiceTyped.paymentSettings?.tokenDecimals || 18;
                    const toAddress = invoiceTyped.paymentSettings?.walletAddress || 
                                    invoiceTyped.payeeAddress;

                    if (!tokenAddress || !toAddress) {
                        setError("Payment details are incomplete. Missing token address or recipient address.");
                        return;
                    }

                    setPaymentData({
                        amount: invoiceTyped.totalAmount || invoiceTyped.total || 0,
                        tokenAddress,
                        toAddress,
                        chainId,
                        tokenDecimals,
                        tokenSymbol,
                    });
                } else {
                    setError("Invoice not found");
                }
            } else {
                setError("No payable or invoice ID provided");
            }
        } catch (err) {
            console.error("Error fetching payment data:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch payment details");
        }
    };

    useEffect(() => {
        const checkSafe = async () => {
            // Give Safe a moment to initialize if we're in an iframe
            const isInIframe = typeof window !== "undefined" && window.parent !== window;
            
            if (isInIframe) {
                // Wait longer for Safe to be ready - Safe needs time to establish communication
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Try multiple times to connect to Safe (with retries)
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    attempts++;
                    console.log(`Attempting to connect to Safe (attempt ${attempts}/${maxAttempts})...`);
                    
                    // Initialize Safe Apps SDK and check if we're in Safe
                    const sdk = new SafeAppsSDK();
                    
                    // Try to get Safe info - this will only work if we're in Safe
                    // Add a timeout to prevent hanging
                    const safePromise = sdk.safe.getInfo();
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Safe connection timeout")), 5000)
                    );
                    
                    const safe = await Promise.race([safePromise, timeoutPromise]) as { 
                        safeAddress: string; 
                        chainId: number;
                        owners: string[];
                        threshold: number;
                    };
                    
                    console.log("✅ Safe detected:", {
                        safeAddress: safe.safeAddress,
                        chainId: safe.chainId,
                        owners: safe.owners.length,
                        threshold: safe.threshold,
                    });
                    
                    // If we get here, we're in Safe
                    setIsSafe(true);
                    setAppsSdk(sdk);
                    
                    setSafeInfo({
                        safeAddress: safe.safeAddress,
                        chainId: safe.chainId,
                        owners: safe.owners,
                        threshold: safe.threshold,
                        isReadOnly: (safe as { isReadOnly?: boolean }).isReadOnly || false,
                    });

                    // Fetch payment data from server
                    await fetchPaymentData();
                    
                    // Success - break out of retry loop
                    break;

                } catch (err) {
                    console.error(`❌ Safe initialization error (attempt ${attempts}/${maxAttempts}):`, err);
                    
                    // If this was the last attempt, show error
                    if (attempts >= maxAttempts) {
                        setIsSafe(false);
                        
                        // Only show error if we're not in an iframe (might be direct access)
                        // If we're in an iframe but SDK fails, it might be a different issue
                        if (!isInIframe) {
                            setError("This page must be opened from Safe App. Please use the 'Pay with Safe' button.");
                        } else {
                            setError("Failed to connect to Safe after multiple attempts. Please try refreshing the page or ensure you're using the Safe App interface.");
                        }
                        setLoading(false);
                    } else {
                        // Wait before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (attempts < maxAttempts) {
                setLoading(false);
            }
        };

        checkSafe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payableId, invoiceId]);

    const handlePayWithSafe = async () => {
        if (!appsSdk || !paymentData || !safeInfo) {
            setError("Safe SDK or payment data not initialized");
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            // Format amount
            const amount = parseUnits(paymentData.amount.toString(), paymentData.tokenDecimals);

            // Encode ERC20 transfer function
            const { encodeFunctionData } = await import("viem");
            const transferData = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [paymentData.toAddress as `0x${string}`, amount],
            });

            // Send transaction via Safe SDK
            // Note: safeTxHash is the hash of the proposed transaction
            // The transaction will need to be signed by required owners before execution
            const { safeTxHash } = await appsSdk.txs.send({
                txs: [
                    {
                        to: paymentData.tokenAddress as `0x${string}`,
                        value: "0",
                        data: transferData,
                    },
                ],
            });

            console.log("Safe transaction proposed:", safeTxHash);

            // Transaction proposed successfully
            // Store the safeTxHash
            setSafeTxHash(safeTxHash);
            
            // Now update the payable/invoice status on the backend
            if (payableId) {
                const { payPayableWithEOAHash } = await import("@/app/actions/payable-payment-actions");
                const result = await payPayableWithEOAHash({
                    payableId,
                    txHash: safeTxHash,
                    fromAddress: safeInfo.safeAddress,
                    chainId: safeInfo.chainId.toString(),
                });
                
                if (!result.success) {
                    setError(result.error || "Failed to update payable status");
                    return;
                }
            } else if (invoiceId) {
                // Update invoice status (you may need to create this server action)
                // For now, we'll just show success
            }

            // Show success message
            setError(null);
            setSuccess(true);
            // The transaction is now proposed in Safe and waiting for signatures

        } catch (err) {
            console.error("Safe payment error:", err);
            setError(err instanceof Error ? err.message : "Failed to process payment");
        } finally {
            setProcessing(false);
        }
    };

    if (!isSafe && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <h2 className="text-xl font-semibold text-gray-900">Not in Safe Environment</h2>
                    </div>
                    <p className="text-gray-600 mb-4">
                        This page must be opened from Safe App. Please use the &quot;Pay with Safe&quot; button from the payment modal.
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Initializing Safe...</p>
                </div>
            </div>
        );
    }

    if (error && !paymentData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <h2 className="text-xl font-semibold text-gray-900">Error</h2>
                    </div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <Shield className="h-8 w-8 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">Pay with Safe</h1>
                            <p className="text-sm text-gray-600">Multi-signature wallet payment</p>
                        </div>
                    </div>

                    {/* Safe Info */}
                    {safeInfo && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-sm space-y-2">
                                <div>
                                    <span className="font-medium text-gray-700">Safe Address:</span>{" "}
                                    <span className="font-mono text-xs">{safeInfo.safeAddress.slice(0, 6)}...{safeInfo.safeAddress.slice(-4)}</span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Chain ID:</span> {safeInfo.chainId}
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Threshold:</span> {safeInfo.threshold} of {safeInfo.owners.length} owners
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Details */}
                    {paymentData && (
                        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h2 className="font-semibold text-gray-900 mb-3">Payment Details</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Amount:</span>
                                    <span className="font-medium">{paymentData.amount} {paymentData.tokenSymbol}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Recipient:</span>
                                    <span className="font-mono text-xs">{paymentData.toAddress.slice(0, 6)}...{paymentData.toAddress.slice(-4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Token:</span>
                                    <span className="font-mono text-xs">{paymentData.tokenAddress.slice(0, 6)}...{paymentData.tokenAddress.slice(-4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Chain ID:</span>
                                    <span className="font-medium">{paymentData.chainId}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && safeTxHash && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800 mb-2">
                                        Transaction Proposed Successfully!
                                    </p>
                                    <p className="text-xs text-green-700 mb-2">
                                        The transaction has been proposed in your Safe. It requires {safeInfo?.threshold} of {safeInfo?.owners.length} owner signatures before it can be executed.
                                    </p>
                                    <p className="text-xs text-green-600 font-mono break-all">
                                        Safe Tx Hash: {safeTxHash}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Pay Button */}
                    {paymentData && safeInfo && !success && (
                        <button
                            onClick={handlePayWithSafe}
                            disabled={processing || safeInfo.isReadOnly}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Shield className="h-5 w-5" />
                                    <span>Confirm Payment with Safe</span>
                                </>
                            )}
                        </button>
                    )}

                    {safeInfo?.isReadOnly && (
                        <p className="mt-3 text-sm text-yellow-600 text-center">
                            This Safe is in read-only mode. Please connect with a signer account.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

