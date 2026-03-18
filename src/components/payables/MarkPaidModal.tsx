'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (args: { txHash?: string; chainId?: number; paymentReference?: string; proofUrl?: string }) => Promise<void>;
  isCrypto: boolean;
  payableId: string;
  chainId?: number;
  network?: string;
}

export default function MarkPaidModal({
  isOpen,
  onClose,
  onConfirm,
  isCrypto,
  payableId,
  chainId,
  network,
}: MarkPaidModalProps) {
  const [txHash, setTxHash] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;

    // Save existing styles so we can restore them on close
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;

    // Dashboard has its own scroll container: <main />
    const mainEl = document.querySelector('main') as HTMLElement | null;
    const prevMainOverflow = mainEl?.style.overflow;
    const prevMainTouchAction = mainEl?.style.touchAction;
    const prevMainScrollTop = mainEl?.scrollTop ?? 0;

    // Force user to the top while modal is open
    window.scrollTo(0, 0);

    // Robust scroll lock
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    if (mainEl) {
      mainEl.style.overflow = 'hidden';
      mainEl.style.touchAction = 'none';
      mainEl.scrollTop = 0;
    }

    return () => {
      // Restore
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;

      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow ?? '';
        mainEl.style.touchAction = prevMainTouchAction ?? '';
        mainEl.scrollTop = prevMainScrollTop;
      }

      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const proofLabel = 'Proof (optional)';

  const compressImageIfNeeded = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) return file;

    const sizeThreshold = 900 * 1024; // ~0.9MB
    const shouldCompress = file.size > sizeThreshold;
    if (!shouldCompress) return file;

    const img = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetW, targetH);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.72)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  };

  const uploadProof = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/payables/${payableId}/upload-proof`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.url) {
      throw new Error(data?.error || 'Failed to upload payment proof');
    }
    return data.url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const hasPaymentReference = !!paymentReference.trim();
    const hasProofFile = !!proofFile;

    // For crypto payments, transaction hash is required
    if (isCrypto && !txHash.trim()) {
      setError('Transaction hash is required for crypto payments');
      return;
    }

    // For non-crypto payments, require either a reference text or a proof upload.
    if (!isCrypto && !hasPaymentReference && !hasProofFile) {
      setError('Add a payment reference or upload a payment proof');
      return;
    }

    // Validate transaction hash format (should be 0x followed by 64 hex characters)
    if (txHash && !/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      setError('Invalid transaction hash format. Must be 0x followed by 64 hexadecimal characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      let proofUrl: string | undefined;
      if (proofFile) {
        const maybeCompressed = await compressImageIfNeeded(proofFile);
        proofUrl = await uploadProof(maybeCompressed);
      }

      await onConfirm({
        txHash: txHash.trim() || undefined,
        chainId,
        paymentReference: hasPaymentReference ? paymentReference.trim() : undefined,
        proofUrl,
      });
      // Reset form on success
      setTxHash('');
      setPaymentReference('');
      setProofFile(null);
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
      setPaymentReference('');
      setProofFile(null);
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-0">
      {/* Semi-transparent backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl
        h-[calc(100vh-16px)] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment reference (paste transaction/reference) 
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => {
                setPaymentReference(e.target.value);
                setError(null);
              }}
              placeholder="e.g. MPESA code, bank reference, receipt number"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

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

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {proofLabel}
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setProofFile(f);
                setError(null);
              }}
              className="w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-400">
              If you upload an image, it will be compressed automatically to save space.
            </p>
          </div>

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
              disabled={
                isSubmitting ||
                (isCrypto && !txHash.trim()) ||
                (!isCrypto && !paymentReference.trim() && !proofFile)
              }
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

