'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (txHash?: string, chainId?: number) => Promise<void>;
  isCrypto: boolean;
  chainId?: number;
  network?: string;
}

export default function MarkPaidModal({
  isOpen,
  onClose,
  onConfirm,
  isCrypto,
  chainId,
  network,
}: MarkPaidModalProps) {
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // For crypto payments, transaction hash is required
    if (isCrypto && !txHash.trim()) {
      setError('Transaction hash is required for crypto payments');
      return;
    }

    // Validate transaction hash format (should be 0x followed by 64 hex characters)
    if (txHash && !/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      setError('Invalid transaction hash format. Must be 0x followed by 64 hexadecimal characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(txHash.trim() || undefined, chainId);
      // Reset form on success
      setTxHash('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTxHash('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            Mark as Paid
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isCrypto && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Transaction Hash <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => {
                  setTxHash(e.target.value);
                  setError(null);
                }}
                placeholder="0x..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
                required={isCrypto}
              />
              <p className="mt-1 text-xs text-gray-400">
                Enter the blockchain transaction hash from your wallet
              </p>
              {network && (
                <p className="mt-1 text-xs text-blue-400">
                  Network: {network} {chainId && `(Chain ID: ${chainId})`}
                </p>
              )}
            </div>
          )}

          {!isCrypto && (
            <div className="mb-4">
              <p className="text-sm text-gray-300">
                Mark this payable as paid. No additional confirmation details required.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isCrypto && !txHash.trim())}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Marking...</span>
                </>
              ) : (
                <span>Mark as Paid</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

