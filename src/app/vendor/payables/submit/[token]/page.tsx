'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface SubmitState {
  loading: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export default function VendorPayableSubmitPage() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ loading: false });

  // Optional vendor name hint via query param
  useEffect(() => {
    const name = search.get('vendor');
    if (name) setVendorName(name);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!params?.token) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      invoiceNumber: formData.get('invoiceNumber') as string,
      description: formData.get('description') as string,
      amount: Number(formData.get('amount') as string),
      currency: (formData.get('currency') as string) || 'KES',
      dueDate: formData.get('dueDate') as string,
      lineItems: [],
      invoiceFileUrl: formData.get('invoiceFileUrl') as string,
      note: formData.get('note') as string,
    };

    setState({ loading: true });

    try {
      const res = await fetch(`/api/vendor-links/${params.token}/payables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setState({
          loading: false,
          errorMessage: json.error || 'Failed to submit invoice. Please try again.',
        });
        return;
      }

      setState({
        loading: false,
        successMessage:
          'Invoice submitted successfully. The accounting team has received it.',
      });
      form.reset();
    } catch {
      setState({
        loading: false,
        errorMessage:
          'Network error submitting invoice. Please check your connection and try again.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 py-8">
      <div className="w-full max-w-xl bg-slate-900/80 border border-white/10 rounded-2xl shadow-xl p-6 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          Submit Invoice
        </h1>
        <p className="text-sm text-blue-200 mb-4">
          {vendorName
            ? `This secure link is for ${vendorName}.`
            : 'This secure link lets you submit invoices directly to your client.'}
        </p>

        {state.successMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            <span>{state.successMessage}</span>
          </div>
        )}

        {state.errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-sm text-red-100">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{state.errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-blue-200 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. INV-2026-001"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Monthly supplies, retainer, services"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-200 mb-1">
                Amount
              </label>
              <input
                type="number"
                name="amount"
                min={1}
                step={0.01}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-200 mb-1">
                Currency
              </label>
              <select
                name="currency"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="KES"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200 mb-1">
              Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200 mb-1">
              Invoice File (URL)
            </label>
            <input
              type="url"
              name="invoiceFileUrl"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Link to PDF or document (optional)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200 mb-1">
              Note to accounting team
            </label>
            <textarea
              name="note"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional details (PO number, contact person, etc.)"
            />
          </div>

          <button
            type="submit"
            disabled={state.loading}
            className="w-full mt-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {state.loading ? 'Submitting…' : 'Submit Invoice'}
          </button>
        </form>
      </div>
    </div>
  );
}

