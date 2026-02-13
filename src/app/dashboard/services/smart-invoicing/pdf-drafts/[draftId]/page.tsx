'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getInvoiceDraft, convertDraftToInvoice } from '@/lib/actions/pdf-invoice';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle, FileText, Plus, Trash2 } from 'lucide-react';

type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
};

function toItems(invoiceData: { items?: Array<{ description?: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number }> }): InvoiceItemRow[] {
  const raw = invoiceData.items ?? [];
  if (raw.length === 0) return [{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }];
  return raw.map((item, i) => {
    const qty = Number(item.quantity) || 1;
    const up = Number(item.unitPrice) ?? 0;
    const total = item.total ?? qty * up;
    return {
      id: String(i + 1),
      description: String(item.description ?? ''),
      quantity: qty,
      unitPrice: up,
      total,
      taxRate: item.taxRate,
    };
  });
}

function recalcFromItems(items: InvoiceItemRow[]): { subtotal: number; totalAmount: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  return { subtotal, totalAmount: subtotal };
}

export default function DraftEditorPage() {
  const router = useRouter();
  const params = useParams();
  const draftIdRaw = (params as unknown as { draftId?: string | string[] } | null)?.draftId;
  const draftId =
    typeof draftIdRaw === 'string'
      ? draftIdRaw
      : Array.isArray(draftIdRaw)
        ? draftIdRaw[0] ?? ''
        : '';

  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ invoiceData?: Record<string, unknown>; sourcePdfUrl?: string | null; extractedFields?: unknown[] } | null>(null);
  const [invoiceData, setInvoiceData] = useState<Record<string, unknown>>({});
  const [items, setItems] = useState<InvoiceItemRow[]>([]);

  const loadDraft = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getInvoiceDraft(draftId);
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load draft');
        return;
      }
      setDraft(result.data);
      const data = result.data.invoiceData || {};
      setInvoiceData(data);
      setItems(toItems(data as { items?: Array<{ description?: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number }> }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (!draftId) {
      setError('Missing draft ID');
      setLoading(false);
      return;
    }
    loadDraft();
  }, [loadDraft, draftId]);

  const handleFieldChange = (field: string, value: unknown) => {
    setInvoiceData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItemsAndTotals = (nextItems: InvoiceItemRow[]) => {
    setItems(nextItems);
    const { subtotal, totalAmount } = recalcFromItems(nextItems);
    setInvoiceData((prev) => ({ ...prev, subtotal, totalAmount }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = item.quantity * item.unitPrice;
      }
      next[index] = item;
      const { subtotal, totalAmount } = recalcFromItems(next);
      setInvoiceData((p) => ({ ...p, subtotal, totalAmount }));
      return next;
    });
  };

  const addItem = () => {
    const next = [...items, { id: String(Date.now()), description: '', quantity: 1, unitPrice: 0, total: 0 }];
    updateItemsAndTotals(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, i) => i !== index);
    updateItemsAndTotals(next);
  };

  const handleConvert = async () => {
    const payload = {
      ...invoiceData,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
        taxRate: i.taxRate ?? 0,
      })),
      subtotal: invoiceData.subtotal ?? recalcFromItems(items).subtotal,
      totalAmount: invoiceData.totalAmount ?? recalcFromItems(items).totalAmount,
    };
    try {
      setConverting(true);
      setError(null);
      setSuccess(null);
      const result = await convertDraftToInvoice(draftId, payload as Parameters<typeof convertDraftToInvoice>[1]);
      if (!result.success) {
        setError(result.error || 'Failed to convert draft');
        return;
      }
      setSuccess(`Invoice created: ${result.data!.invoiceNumber}`);
      setTimeout(() => router.push(`/dashboard/services/smart-invoicing/invoices/${result.data!.invoiceId}`), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setConverting(false);
    }
  };

  const clientDetails = (invoiceData.clientDetails as Record<string, string> | undefined) ?? {};
  const companyDetails = (invoiceData.companyDetails as Record<string, string> | undefined) ?? {};
  const subtotal = (invoiceData.subtotal as number) ?? recalcFromItems(items).subtotal;
  const totalAmount = (invoiceData.totalAmount as number) ?? recalcFromItems(items).totalAmount;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white text-lg">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg">Draft not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center space-x-2 text-white hover:text-blue-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">Edit Invoice Draft</h1>
          <p className="text-blue-200">Same as Create: edit summary, client, company, currency and invoice number, then convert.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-200 text-sm">{success}</p>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-lg space-y-6">
          {/* Invoice number, currency, dates - same as create */}
          <div>
            <h3 className="text-white font-semibold mb-4">Invoice &amp; dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Invoice Number</label>
                <input
                  type="text"
                  value={(invoiceData.invoiceNumber as string) || ''}
                  onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Currency</label>
                <input
                  type="text"
                  value={(invoiceData.currency as string) || 'USD'}
                  onChange={(e) => handleFieldChange('currency', e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="USD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Issue Date</label>
                <input
                  type="date"
                  value={
                    invoiceData.issueDate
                      ? new Date(invoiceData.issueDate as string).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]
                  }
                  onChange={(e) => handleFieldChange('issueDate', new Date(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Due Date</label>
                <input
                  type="date"
                  value={
                    invoiceData.dueDate
                      ? new Date(invoiceData.dueDate as string).toISOString().split('T')[0]
                      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                  }
                  onChange={(e) => handleFieldChange('dueDate', new Date(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Company details - same as create */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Company name</label>
                <input
                  type="text"
                  value={companyDetails.name ?? ''}
                  onChange={(e) => handleFieldChange('companyDetails', { ...companyDetails, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Company email</label>
                <input
                  type="email"
                  value={companyDetails.email ?? ''}
                  onChange={(e) => handleFieldChange('companyDetails', { ...companyDetails, email: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="billing@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Company phone</label>
                <input
                  type="text"
                  value={companyDetails.phone ?? ''}
                  onChange={(e) => handleFieldChange('companyDetails', { ...companyDetails, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </div>

          {/* Client details - same as create */}
          <div>
            <h3 className="text-white font-semibold mb-4">Client details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Client name</label>
                <input
                  type="text"
                  value={clientDetails.name ?? ''}
                  onChange={(e) => handleFieldChange('clientDetails', { ...clientDetails, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Client email</label>
                <input
                  type="email"
                  value={clientDetails.email ?? ''}
                  onChange={(e) => handleFieldChange('clientDetails', { ...clientDetails, email: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Client phone</label>
                <input
                  type="text"
                  value={clientDetails.phone ?? ''}
                  onChange={(e) => handleFieldChange('clientDetails', { ...clientDetails, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </div>

          {/* Line items - summary and editable (same as create) */}
          <div>
            <h3 className="text-white font-semibold mb-4">Line items</h3>
            <div className="overflow-x-auto rounded-lg border border-white/20">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20 bg-white/5">
                    <th className="text-left py-3 px-4 font-medium text-blue-200">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-blue-200 w-20">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-blue-200 w-28">Unit price</th>
                    <th className="text-left py-3 px-4 font-medium text-blue-200 w-24">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-white/10">
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Description"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-4 text-blue-200 tabular-nums">
                        {(item.quantity * item.unitPrice).toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1}
                          className="p-1.5 text-red-300 hover:text-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-blue-200 text-sm font-medium border border-white/20"
            >
              <Plus className="w-4 h-4" />
              Add line item
            </button>
          </div>

          {/* Totals summary */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-blue-200">
                <span>Subtotal</span>
                <span className="tabular-nums">{Number(subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-semibold text-lg border-t border-white/20 pt-2">
                <span>Total</span>
                <span className="tabular-nums">{Number(totalAmount).toFixed(2)} {(invoiceData.currency as string) || 'USD'}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Notes / memo</label>
            <textarea
              value={(invoiceData.notes as string) || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          {/* Source PDF */}
          <div className="p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <FileText className="w-4 h-4 shrink-0" />
              <span>Source PDF: {draft.sourcePdfUrl ?? '—'}</span>
            </div>
            <div className="mt-2 text-xs text-blue-300">
              {draft.extractedFields?.length ?? 0} fields extracted from PDF
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-white/10">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-white hover:text-blue-200 transition-colors"
              disabled={converting}
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={converting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {converting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Convert to invoice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
