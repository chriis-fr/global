'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function FixPayablesPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runFix = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/fix-existing-payables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || 'Failed to fix payables');
      }
    } catch (err) {
      setError('Failed to run fix: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl font-semibold">Fix Existing Payables</h1>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-300 mb-3">
              This will fix all existing payables that are stuck in pending_approval status.
            </p>
            <p className="text-gray-300 mb-2">It will:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Fix workflows with null billId</li>
              <li>Update payable statuses based on workflow status</li>
              <li>Sync invoice statuses for approved/rejected payables</li>
              <li>Sync all payables to financial ledger for dashboard counts</li>
              <li>Mark related invoices as "paid" when payables are paid (two-way sync)</li>
            </ul>
          </div>

          <button 
            onClick={runFix} 
            disabled={isRunning}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Fixing Payables...</span>
              </>
            ) : (
              <span>Run Fix</span>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-300">{error}</span>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-green-300 font-semibold">Fix completed successfully!</span>
              </div>
              <div className="text-sm text-green-200 space-y-1 ml-6">
                <p>• Fixed {result.data.fixedWorkflows} workflows with null billId</p>
                <p>• Updated {result.data.updatedPayables} payable statuses</p>
                <p>• Synced {result.data.syncedInvoices} invoice statuses</p>
                <p>• Synced {result.data.syncedToLedger} payables to financial ledger</p>
                <p>• Synced {result.data.syncedInvoicesToPaid} invoices to paid status</p>
                <p>• Total workflows processed: {result.data.totalWorkflows}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
