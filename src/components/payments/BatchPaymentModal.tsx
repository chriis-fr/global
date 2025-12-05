"use client";

import { useState, useEffect } from "react";
import { X, Shield, Wallet, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { getConnectedSafeWallets } from "@/app/actions/safe-connection";
import { createBatchPayment } from "@/app/actions/batch-payment";
import PaymentMethodSelector from "./PaymentMethodSelector";

interface Invoice {
    _id: string;
    invoiceNumber: string;
    total: number;
    totalAmount?: number;
    currency: string;
    tokenAddress?: string;
    tokenDecimals?: number;
    payeeAddress?: string;
    chainId?: number;
}

interface PaymentMethod {
    _id?: string;
    name: string;
    type: 'fiat' | 'crypto';
    cryptoDetails?: {
        safeDetails?: {
            safeAddress: string;
            owners: string[];
            threshold: number;
        };
    };
}

interface BatchPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
    onSuccess?: () => void;
}

export default function BatchPaymentModal({
    isOpen,
    onClose,
    invoices,
    onSuccess,
}: BatchPaymentModalProps) {
    const [step, setStep] = useState<"select" | "confirm" | "processing" | "success">("select");
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [safeWallets, setSafeWallets] = useState<Array<{
        paymentMethodId: string;
        name: string;
        safeAddress: string;
        owners: string[];
        threshold: number;
    }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadPaymentMethods();
            loadSafeWallets();
        }
    }, [isOpen]);

    const loadPaymentMethods = async () => {
        try {
            const response = await fetch('/api/payment-methods');
            const data = await response.json();
            if (data.success) {
                setPaymentMethods(data.paymentMethods || []);
            }
        } catch (error) {
            console.error('Error loading payment methods:', error);
        }
    };

    const loadSafeWallets = async () => {
        try {
            const result = await getConnectedSafeWallets({});
            if (result.success) {
                setSafeWallets(result.safeWallets);
            }
        } catch (error) {
            console.error('Error loading Safe wallets:', error);
        }
    };

    const selectedPaymentMethod = paymentMethods.find((m) => m._id === selectedPaymentMethodId);
    const isSafeWallet = selectedPaymentMethod?.type === 'crypto' && selectedPaymentMethod?.cryptoDetails?.safeDetails;

    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || inv.totalAmount || 0), 0);
    const firstInvoice = invoices[0];
    const allSameChain = invoices.every(
        (inv) => inv.chainId === firstInvoice?.chainId && inv.tokenAddress === firstInvoice?.tokenAddress
    );

    const handleProceed = () => {
        if (!selectedPaymentMethodId) {
            setError("Please select a payment method");
            return;
        }

        if (!allSameChain && invoices.length > 1) {
            setError("Selected invoices must use the same chain and token");
            return;
        }

        setStep("confirm");
        setError(null);
    };

    const handleConfirm = async () => {
        setStep("processing");
        setError(null);

        try {
            if (!selectedPaymentMethodId) {
                throw new Error("Payment method not selected");
            }

            // For Safe wallets, we need the proposer's private key
            // In production, this should come from a secure wallet connection
            // For now, we'll show an error if it's a Safe wallet
            if (isSafeWallet) {
                // TODO: Integrate with wallet connection to get proposer private key
                // For now, show a message that wallet connection is needed
                throw new Error("Safe wallet payments require wallet connection. This feature is coming soon.");
            }

            const result = await createBatchPayment({
                invoiceIds: invoices.map((inv) => inv._id),
                paymentMethodId: selectedPaymentMethodId,
            });

            if (result.success) {
                setTxHash(result.txHash || result.safeTxHash || null);
                setStep("success");
                
                setTimeout(() => {
                    onSuccess?.();
                    onClose();
                    resetModal();
                }, 2000);
            } else {
                throw new Error(result.error || "Payment failed");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed");
            setStep("select");
        }
    };

    const resetModal = () => {
        setStep("select");
        setSelectedPaymentMethodId("");
        setError(null);
        setTxHash(null);
    };

    const handleClose = () => {
        if (step !== "processing") {
            resetModal();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Wallet className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Batch Payment</h2>
                            <p className="text-sm text-gray-600">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={step === "processing"}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === "select" && (
                        <div className="space-y-6">
                            {/* Invoice Summary */}
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-2">Payment Summary</h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Invoices:</span>
                                        <span className="font-medium">{invoices.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Amount:</span>
                                        <span className="font-semibold">
                                            {firstInvoice?.currency || 'USD'} {totalAmount.toLocaleString()}
                                        </span>
                                    </div>
                                    {firstInvoice?.chainId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Network:</span>
                                            <span className="font-medium">Chain {firstInvoice.chainId}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Payment Method Selection */}
                            <div>
                                <h3 className="font-medium text-gray-900 mb-3">Select Payment Method</h3>
                                <PaymentMethodSelector
                                    methods={paymentMethods}
                                    selectedMethodId={selectedPaymentMethodId}
                                    onSelect={setSelectedPaymentMethodId}
                                    showSafeWallets={true}
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleProceed}
                                    disabled={!selectedPaymentMethodId}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Batch Payment</h3>
                                <p className="text-sm text-gray-600">Review the details before proceeding</p>
                            </div>

                            {/* Payment Details */}
                            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                <div>
                                    <span className="text-sm text-gray-600">Payment Method:</span>
                                    <div className="font-medium text-gray-900 mt-1">
                                        {selectedPaymentMethod?.name}
                                        {isSafeWallet && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                Safe Wallet
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-600">Total Amount:</span>
                                    <div className="font-semibold text-gray-900 mt-1">
                                        {firstInvoice?.currency || 'USD'} {totalAmount.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-600">Invoices:</span>
                                    <div className="text-sm text-gray-900 mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
                                </div>
                            </div>

                            {isSafeWallet && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-blue-800">
                                            <p className="font-medium mb-1">Safe Wallet Payment</p>
                                            <p>This transaction will be proposed to your Safe wallet. Other owners will need to sign before it can be executed.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep("select")}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Confirm & Pay
                                </button>
                            </div>
                        </div>
                    )}

                    {step === "processing" && (
                        <div className="text-center py-12">
                            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment</h3>
                            <p className="text-gray-600">Please wait while we process your batch payment...</p>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="text-center py-12">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Initiated!</h3>
                            <p className="text-gray-600 mb-4">
                                {isSafeWallet
                                    ? "Your Safe transaction has been proposed. Other owners can now sign it."
                                    : "Your payment is being processed."}
                            </p>
                            {txHash && (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                                    <p className="font-mono text-sm text-gray-900">{txHash}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

