"use client";

import { useState } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface SavePaymentMethodButtonProps {
    formData: {
        paymentMethod: 'fiat' | 'crypto';
        fiatPaymentSubtype?: 'bank' | 'mpesa_paybill' | 'mpesa_till' | 'phone';
        currency: string;
        companyAddress: { country: string };
        // Fiat fields
        bankName?: string;
        swiftCode?: string;
        bankCode?: string;
        branchCode?: string;
        accountName?: string;
        accountNumber?: string;
        branchAddress?: string;
        // Custom bank fields
        customBankFields?: Record<string, string>;
        paybillNumber?: string;
        mpesaAccountNumber?: string;
        tillNumber?: string;
        businessName?: string;
        paymentPhoneNumber?: string;
        // Crypto fields
        paymentNetwork?: string;
        paymentAddress?: string;
        chainId?: number;
        tokenAddress?: string;
    };
    onSaveSuccess?: (savedMethodId: string) => void;
    isAlreadySaved?: boolean; // If true, hide the button
}

export default function SavePaymentMethodButton({
    formData,
    onSaveSuccess,
    isAlreadySaved = false,
}: SavePaymentMethodButtonProps) {
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Determine if payment method has enough details to save
    const canSave = () => {
        if (formData.paymentMethod === 'fiat') {
            if (formData.fiatPaymentSubtype === 'bank') {
                return !!(formData.bankName && formData.accountNumber && formData.accountName);
            } else if (formData.fiatPaymentSubtype === 'mpesa_paybill') {
                return !!(formData.paybillNumber && formData.mpesaAccountNumber);
            } else if (formData.fiatPaymentSubtype === 'mpesa_till') {
                return !!formData.tillNumber;
            } else if (formData.fiatPaymentSubtype === 'phone') {
                return !!formData.paymentPhoneNumber;
            }
        } else if (formData.paymentMethod === 'crypto') {
            return !!(formData.paymentNetwork && formData.paymentAddress);
        }
        return false;
    };

    // Get default currency based on payment method
    const getDefaultCurrency = (): string => {
        if (formData.paymentMethod === 'fiat') {
            // M-Pesa methods default to KES
            if (formData.fiatPaymentSubtype === 'mpesa_paybill' || formData.fiatPaymentSubtype === 'mpesa_till') {
                return 'KES';
            }
            // Use current currency or default to USD
            return formData.currency || 'USD';
        } else {
            // Crypto defaults to USDT
            return 'USDT';
        }
    };

    // Generate payment method name
    const generatePaymentMethodName = (): string => {
        if (formData.paymentMethod === 'fiat') {
            if (formData.fiatPaymentSubtype === 'bank') {
                return `${formData.bankName || 'Bank'} Account`;
            } else if (formData.fiatPaymentSubtype === 'mpesa_paybill') {
                return `M-Pesa Paybill ${formData.paybillNumber || ''}`;
            } else if (formData.fiatPaymentSubtype === 'mpesa_till') {
                return `M-Pesa Till ${formData.tillNumber || ''}`;
            } else if (formData.fiatPaymentSubtype === 'phone') {
                return `Phone Payment ${formData.paymentPhoneNumber || ''}`;
            }
        } else if (formData.paymentMethod === 'crypto') {
            return `${formData.paymentNetwork || 'Crypto'} Wallet`;
        }
        return 'Payment Method';
    };

    const handleSave = async () => {
        if (!canSave()) {
            setError('Please fill in all required payment method details');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const currency = getDefaultCurrency();
            const paymentMethodData: Record<string, unknown> = {
                name: generatePaymentMethodName(),
                type: formData.paymentMethod,
                isDefault: false,
            };

            if (formData.paymentMethod === 'fiat') {
                paymentMethodData.fiatDetails = {
                    subtype: formData.fiatPaymentSubtype,
                    currency: currency,
                    country: formData.companyAddress.country || 'US',
                    ...(formData.fiatPaymentSubtype === 'bank' && {
                        bankName: formData.bankName,
                        swiftCode: formData.swiftCode,
                        bankCode: formData.bankCode,
                        branchCode: formData.branchCode,
                        accountName: formData.accountName,
                        accountNumber: formData.accountNumber,
                        branchAddress: formData.branchAddress,
                        // Custom bank fields
                        customFields: formData.customBankFields || {},
                    }),
                    ...(formData.fiatPaymentSubtype === 'mpesa_paybill' && {
                        paybillNumber: formData.paybillNumber,
                        mpesaAccountNumber: formData.mpesaAccountNumber,
                        businessName: formData.businessName,
                    }),
                    ...(formData.fiatPaymentSubtype === 'mpesa_till' && {
                        tillNumber: formData.tillNumber,
                        businessName: formData.businessName,
                    }),
                    ...(formData.fiatPaymentSubtype === 'phone' && {
                        paymentPhoneNumber: formData.paymentPhoneNumber,
                        businessName: formData.businessName,
                    }),
                };
            } else if (formData.paymentMethod === 'crypto') {
                paymentMethodData.cryptoDetails = {
                    address: formData.paymentAddress || '',
                    network: formData.paymentNetwork || '',
                    currency: currency,
                    ...(formData.chainId && { chainId: formData.chainId }),
                    ...(formData.tokenAddress && { tokenAddress: formData.tokenAddress }),
                };
            }

            const response = await fetch('/api/payment-methods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentMethodData),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess(true);
                // The API returns { success: true, data: paymentMethod }
                const savedMethodId = data.data?._id || data.data?.id || data.paymentMethod?._id || data.paymentMethod?.id || '';
                // Call onSaveSuccess immediately with the saved method ID
                onSaveSuccess?.(savedMethodId);
                // Hide button after a brief delay
                setTimeout(() => {
                    setSuccess(false);
                }, 1500);
            } else {
                setError(data.error || 'Failed to save payment method');
            }
        } catch {
            setError('An error occurred while saving the payment method');
        } finally {
            setSaving(false);
        }
    };

    // Hide button if already saved, if can't save, or if saving was successful
    if (!canSave() || isAlreadySaved || success) {
        return null;
    }

    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={handleSave}
                disabled={saving || success}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
            >
                {saving ? (
                    <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                    </>
                ) : success ? (
                    <>
                        <CheckCircle2 className="h-3 w-3" />
                        Saved!
                    </>
                ) : (
                    <>
                        <Save className="h-3 w-3" />
                        Save Payment Method
                    </>
                )}
            </button>
            {error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{error}</p>
                </div>
            )}
            {success && (
                <p className="mt-2 text-xs text-green-600">
                    Payment method saved! You can select it from the dropdown above.
                </p>
            )}
        </div>
    );
}

