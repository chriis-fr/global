"use client";

import { useState } from "react";
import { Shield, Users, CheckCircle2, X, ExternalLink } from "lucide-react";
import { disconnectSafeWallet } from "@/app/actions/safe-connection";

interface SafeWalletCardProps {
    paymentMethodId: string;
    name: string;
    safeAddress: string;
    owners: string[];
    threshold: number;
    chainId?: number;
    isDefault?: boolean;
    onDisconnect?: () => void;
}

export default function SafeWalletCard({
    paymentMethodId,
    name,
    safeAddress,
    owners,
    threshold,
    chainId,
    isDefault,
    onDisconnect,
}: SafeWalletCardProps) {
    const [disconnecting, setDisconnecting] = useState(false);

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect this Safe wallet?")) {
            return;
        }

        setDisconnecting(true);
        try {
            const result = await disconnectSafeWallet({
                paymentMethodId,
            });

            if (result.success) {
                onDisconnect?.();
            } else {
                alert(result.error || "Failed to disconnect Safe wallet");
            }
        } catch {
            alert("An error occurred while disconnecting the Safe wallet");
        } finally {
            setDisconnecting(false);
        }
    };

    const getChainName = (chainId?: number) => {
        if (!chainId) return "Unknown";
        // Map chain IDs to names
        const chainMap: Record<number, string> = {
            42220: "Celo",
            1: "Ethereum",
            137: "Polygon",
        };
        return chainMap[chainId] || `Chain ${chainId}`;
    };

    const getExplorerUrl = (address: string, chainId?: number) => {
        if (!chainId) return null;
        const explorerMap: Record<number, string> = {
            42220: `https://celoscan.io/address/${address}`,
            1: `https://etherscan.io/address/${address}`,
            137: `https://polygonscan.com/address/${address}`,
        };
        return explorerMap[chainId] || null;
    };

    const explorerUrl = getExplorerUrl(safeAddress, chainId);

    return (
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{name}</h3>
                            {isDefault && (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                    Default
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-mono">{safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}</span>
                            {explorerUrl && (
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Disconnect Safe wallet"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Users className="h-4 w-4" />
                        <span>Owners</span>
                    </div>
                    <div className="font-semibold text-gray-900">{owners.length}</div>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Threshold</span>
                    </div>
                    <div className="font-semibold text-gray-900">
                        {threshold} of {owners.length}
                    </div>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                    Network: <span className="font-medium">{getChainName(chainId)}</span>
                </div>
            </div>
        </div>
    );
}

