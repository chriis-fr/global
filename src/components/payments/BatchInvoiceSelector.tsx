"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";

interface Invoice {
    _id: string;
    invoiceNumber: string;
    clientName?: string;
    'clientDetails.name'?: string;
    total: number;
    totalAmount?: number;
    currency: string;
    status: string;
    dueDate: string;
    tokenAddress?: string;
    tokenDecimals?: number;
    payeeAddress?: string;
    chainId?: number;
}

interface BatchInvoiceSelectorProps {
    invoices: Invoice[];
    selectedInvoiceIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    onSelectAll?: () => void;
    onDeselectAll?: () => void;
}

export default function BatchInvoiceSelector({
    invoices,
    selectedInvoiceIds,
    onSelectionChange,
    onSelectAll,
    onDeselectAll,
}: BatchInvoiceSelectorProps) {
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        setSelectAll(selectedInvoiceIds.length === invoices.length && invoices.length > 0);
    }, [selectedInvoiceIds, invoices]);

    const handleSelectAll = () => {
        if (selectAll) {
            onSelectionChange([]);
            onDeselectAll?.();
        } else {
            const allIds = invoices
                .filter((inv) => inv.status === 'sent' || inv.status === 'pending')
                .map((inv) => inv._id);
            onSelectionChange(allIds);
            onSelectAll?.();
        }
    };

    const toggleInvoice = (invoiceId: string) => {
        if (selectedInvoiceIds.includes(invoiceId)) {
            onSelectionChange(selectedInvoiceIds.filter((id) => id !== invoiceId));
        } else {
            onSelectionChange([...selectedInvoiceIds, invoiceId]);
        }
    };

    // Group invoices by chain/token compatibility
    const groupInvoicesByCompatibility = () => {
        const groups: Record<string, Invoice[]> = {};
        
        invoices.forEach((inv) => {
            const key = `${inv.chainId || 'unknown'}-${inv.tokenAddress || 'unknown'}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(inv);
        });

        return groups;
    };

    const groups = groupInvoicesByCompatibility();
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(inv._id));
    const totalAmount = selectedInvoices.reduce((sum, inv) => sum + (inv.total || inv.totalAmount || 0), 0);
    const firstSelected = selectedInvoices[0];
    const allSameChain = selectedInvoices.every(
        (inv) => inv.chainId === firstSelected?.chainId && inv.tokenAddress === firstSelected?.tokenAddress
    );

    return (
        <div className="space-y-4">
            {/* Selection Summary */}
            {selectedInvoiceIds.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                            {selectedInvoiceIds.length} invoice{selectedInvoiceIds.length !== 1 ? 's' : ''} selected
                        </span>
                        <button
                            onClick={() => onSelectionChange([])}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Clear selection
                        </button>
                    </div>
                    <div className="text-sm text-gray-600">
                        Total: {firstSelected?.currency || 'USD'} {totalAmount.toLocaleString()}
                    </div>
                    {!allSameChain && selectedInvoiceIds.length > 1 && (
                        <div className="mt-2 text-sm text-amber-600">
                            ⚠️ Selected invoices use different chains/tokens. They will be grouped separately.
                        </div>
                    )}
                </div>
            )}

            {/* Select All */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900">Select All</span>
                </label>
                <span className="text-sm text-gray-600">
                    {invoices.filter((inv) => inv.status === 'sent' || inv.status === 'pending').length} payable invoices
                </span>
            </div>

            {/* Invoice List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(groups).map(([key, groupInvoices]) => (
                    <div key={key} className="space-y-2">
                        {Object.keys(groups).length > 1 && (
                            <div className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                {groupInvoices[0].chainId ? `Chain ${groupInvoices[0].chainId}` : 'Unknown Chain'} • {groupInvoices.length} invoices
                            </div>
                        )}
                        {groupInvoices.map((invoice) => {
                            const isSelected = selectedInvoiceIds.includes(invoice._id);
                            const canSelect = invoice.status === 'sent' || invoice.status === 'pending';

                            return (
                                <div
                                    key={invoice._id}
                                    className={`p-3 border-2 rounded-lg transition-all ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : canSelect
                                                ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                                                : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                    }`}
                                    onClick={() => canSelect && toggleInvoice(invoice._id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-500'
                                                : 'border-gray-300'
                                        }`}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-gray-900">
                                                    {invoice.invoiceNumber}
                                                </span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {invoice.currency} {(invoice.total || invoice.totalAmount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {invoice.clientName || invoice['clientDetails.name'] || 'Unknown Client'}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    invoice.status === 'paid'
                                                        ? 'bg-green-100 text-green-700'
                                                        : invoice.status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {invoice.status}
                                                </span>
                                                {invoice.chainId && (
                                                    <span className="text-xs text-gray-500">
                                                        Chain {invoice.chainId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!canSelect && (
                                            <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

