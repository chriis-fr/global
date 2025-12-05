"use client";

import { useState, useRef, useEffect } from "react";
import { CreditCard, Wallet, Shield, Smartphone, ChevronDown, Settings } from "lucide-react";
import Link from "next/link";

interface PaymentMethod {
    _id?: string;
    name: string;
    type: 'fiat' | 'crypto';
    isDefault?: boolean;
    fiatDetails?: {
        subtype?: 'bank' | 'mpesa_paybill' | 'mpesa_till';
        bankName?: string;
        currency?: string;
    };
    cryptoDetails?: {
        address: string;
        network: string;
        currency: string;
        safeDetails?: {
            safeAddress: string;
            owners: string[];
            threshold: number;
            chainId?: number;
        };
    };
}

interface PaymentMethodSelectorProps {
    methods: PaymentMethod[];
    selectedMethodId?: string;
    onSelect: (methodId: string) => void;
    showSafeWallets?: boolean;
}

export default function PaymentMethodSelector({
    methods,
    selectedMethodId,
    onSelect,
    showSafeWallets = true,
}: PaymentMethodSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedMethod = methods.find(m => m._id === selectedMethodId);
    const allMethods = [...methods];

    const getMethodIcon = (method: PaymentMethod) => {
        if (method.type === 'crypto' && method.cryptoDetails?.safeDetails) {
            return <Shield className="h-4 w-4 text-blue-600" />;
        }
        if (method.type === 'crypto') {
            return <Wallet className="h-4 w-4 text-purple-600" />;
        }
        if (method.fiatDetails?.subtype === 'mpesa_paybill' || method.fiatDetails?.subtype === 'mpesa_till') {
            return <Smartphone className="h-4 w-4 text-orange-600" />;
        }
        return <CreditCard className="h-4 w-4 text-green-600" />;
    };

    const getMethodDescription = (method: PaymentMethod) => {
        if (method.type === 'crypto' && method.cryptoDetails?.safeDetails) {
            const safe = method.cryptoDetails.safeDetails;
            return `${safe.threshold} of ${safe.owners.length} signatures`;
        }
        if (method.type === 'crypto') {
            return `${method.cryptoDetails?.network} • ${method.cryptoDetails?.currency}`;
        }
        if (method.fiatDetails?.subtype === 'mpesa_paybill' || method.fiatDetails?.subtype === 'mpesa_till') {
            return `M-Pesa • ${method.fiatDetails?.currency}`;
        }
        return `${method.fiatDetails?.bankName || 'Bank'} • ${method.fiatDetails?.currency}`;
    };

    if (methods.length === 0) {
        return (
            <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-1">No payment methods available</h4>
                <Link
                    href="/dashboard/settings/payment-methods"
                    className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:underline transition-colors text-xs font-medium"
                >
                    Add in Settings
                    <Settings className="h-3 w-3" />
                </Link>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Dropdown Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white flex items-center justify-between text-sm"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedMethod ? (
                        <>
                            {getMethodIcon(selectedMethod)}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{selectedMethod.name}</div>
                                <div className="text-xs text-gray-500 truncate">{getMethodDescription(selectedMethod)}</div>
                            </div>
                            {selectedMethod.isDefault && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex-shrink-0">
                                    Default
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-gray-500">Select payment method</span>
                    )}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="py-1">
                        {allMethods.map((method) => (
                            <button
                                key={method._id}
                                type="button"
                                onClick={() => {
                                    onSelect(method._id || '');
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                                    selectedMethodId === method._id ? 'bg-blue-50' : ''
                                }`}
                            >
                                {getMethodIcon(method)}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 text-sm truncate">{method.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{getMethodDescription(method)}</div>
                                </div>
                                {method.isDefault && (
                                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex-shrink-0">
                                        Default
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
