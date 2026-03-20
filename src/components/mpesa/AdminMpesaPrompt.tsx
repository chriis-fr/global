'use client';

import { useState, useTransition, useEffect } from 'react';
import { sendAdminMpesaStkPush } from '@/app/actions/mpesa-stk';

const MESSAGE_DISMISS_MS = 5000;

interface AdminMpesaPromptProps {
  organizations: Array<{ id: string; name: string }>;
}

export function AdminMpesaPrompt({ organizations }: AdminMpesaPromptProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizations[0]?.id ?? ''
  );
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!errorMessage && !statusMessage) return;
    const id = setTimeout(() => {
      setErrorMessage(null);
      setStatusMessage(null);
    }, MESSAGE_DISMISS_MS);
    return () => clearTimeout(id);
  }, [errorMessage, statusMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    if (!selectedOrgId) {
      setErrorMessage('Select an organization.');
      return;
    }

    const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
    if (!numericAmount || numericAmount <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setErrorMessage('Enter a customer phone number.');
      return;
    }

    startTransition(async () => {
      const result = await sendAdminMpesaStkPush({
        organizationId: selectedOrgId,
        phoneNumber: trimmedPhone,
        amount: numericAmount,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to send M-Pesa STK prompt.');
        return;
      }

      setStatusMessage(
        result.message ||
          'STK push sent. Ask the customer to check their phone and complete the prompt.'
      );
      setPhone('');
      setAmount('');
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Admin M-Pesa Prompt (simulate for organization)
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-blue-200 mb-1">
              Organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isPending}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-blue-200 mb-1">
              Customer Phone Number
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isPending}
              placeholder="e.g. 2547XXXXXXXX"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-blue-200 mb-1">
              Amount (KES)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isPending}
              required
            />
          </div>
          {statusMessage && (
            <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-700/60 rounded-lg px-3 py-2">
              {statusMessage}
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-700/60 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || organizations.length === 0}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-white transition-colors"
          >
            {isPending ? 'Sending...' : 'Send prompt'}
          </button>
        </form>
      </div>
    </div>
  );
}

