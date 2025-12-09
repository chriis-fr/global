"use client";

import { useState } from "react";
import { X, Wallet, Shield, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { importExistingSafe } from "@/app/actions/safe-connection";
import { DEFAULT_CHAIN } from "@/lib/chains";

interface ConnectSafeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    organizationId?: string;
}

export default function ConnectSafeModal({
    isOpen,
    onClose,
    onSuccess,
    organizationId,
}: ConnectSafeModalProps) {
    const [step, setStep] = useState<"method" | "import" | "deploy">("method");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    // Import form state
    const [safeAddress, setSafeAddress] = useState("");
    const [safeName, setSafeName] = useState("");
    const [chainId, setChainId] = useState(DEFAULT_CHAIN.id);
    
    // Deploy form state (for future)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setOwners] = useState<string[]>([""]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setThreshold] = useState(1);

    if (!isOpen) return null;

    const handleImport = async () => {
        if (!safeAddress.trim()) {
            setError("Please enter a Safe wallet address");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await importExistingSafe({
                safeAddress: safeAddress.trim(),
                chainId,
                name: safeName.trim() || undefined,
                organizationId,
            });

            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onSuccess?.();
                    onClose();
                    resetForm();
                }, 1500);
            } else {
                setError(result.error || "Failed to import Safe wallet");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setStep("method");
        setSafeAddress("");
        setSafeName("");
        setChainId(DEFAULT_CHAIN.id);
        setError(null);
        setSuccess(false);
        setLoading(false);
    };

    const handleClose = () => {
        if (!loading) {
            resetForm();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Shield className="h-5 w-5 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Connect Safe Wallet
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Safe Wallet Connected!
                            </h3>
                            <p className="text-gray-600">
                                Your Safe wallet has been successfully connected.
                            </p>
                        </div>
                    ) : step === "method" ? (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-6">
                                Choose how you want to connect your Safe wallet:
                            </p>

                            {/* Import Existing Safe */}
                            <button
                                onClick={() => setStep("import")}
                                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Wallet className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            Import Existing Safe
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Connect a Safe wallet that&apos;s already deployed
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* Deploy New Safe (Future) */}
                            <button
                                onClick={() => setStep("deploy")}
                                disabled
                                className="w-full p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        <Shield className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">
                                            Deploy New Safe
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Create a new Safe wallet (Coming soon)
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    ) : step === "import" ? (
                        <div className="space-y-4">
                            <button
                                onClick={() => setStep("method")}
                                className="text-sm text-blue-600 hover:text-blue-700 mb-4"
                            >
                                ← Back
                            </button>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Safe Wallet Address *
                                </label>
                                <input
                                    type="text"
                                    value={safeAddress}
                                    onChange={(e) => setSafeAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={loading}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Enter the address of your existing Safe wallet
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Wallet Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={safeName}
                                    onChange={(e) => setSafeName(e.target.value)}
                                    placeholder="e.g., Main Company Safe"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Network
                                </label>
                                <select
                                    value={chainId}
                                    onChange={(e) => setChainId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={loading}
                                >
                                    <option value="celo">Celo</option>
                                    {/* Add more chains as they're added to SUPPORTED_CHAINS */}
                                </select>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleClose}
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={loading || !safeAddress.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        "Import Safe"
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

