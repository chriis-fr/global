'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function DebugLedgerPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch('/api/debug/ledger');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Failed to fetch data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl font-semibold">Debug Ledger Data</h1>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-300 mb-3">
              This will show all ledger entries and payables to help debug the dashboard count issue.
            </p>
          </div>

          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <span>Fetch Debug Data</span>
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

          {data && (
            <div className="mt-6 space-y-6">
              <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <h3 className="text-green-300 font-semibold mb-2">User Info</h3>
                <div className="text-sm text-green-200 space-y-1">
                  <p>ID: {data.user.id}</p>
                  <p>Email: {data.user.email}</p>
                  <p>Organization ID: {data.user.organizationId || 'None'}</p>
                </div>
              </div>

              {data.organization && (
                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <h3 className="text-blue-300 font-semibold mb-2">Organization Info</h3>
                  <div className="text-sm text-blue-200 space-y-1">
                    <p>ID: {data.organization._id}</p>
                    <p>Name: {data.organization.name}</p>
                    <p>Billing Email: {data.organization.billingEmail}</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <h3 className="text-purple-300 font-semibold mb-2">Ledger Entries ({data.ledgerEntries.length})</h3>
                <div className="text-sm text-purple-200 space-y-1 max-h-60 overflow-y-auto">
                  {data.ledgerEntries.map((entry: { type: string; status: string; amount: number; organizationId?: string; ownerId?: string; relatedPayableId?: string }, index: number) => (
                    <div key={index} className="border-b border-purple-700/30 pb-2 mb-2">
                      <p>Type: {entry.type} | Status: {entry.status} | Amount: {entry.amount}</p>
                      <p>Org ID: {entry.organizationId || 'None'} | Owner ID: {entry.ownerId || 'None'}</p>
                      <p>Related Payable: {entry.relatedPayableId || 'None'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <h3 className="text-yellow-300 font-semibold mb-2">Payables ({data.payables.length})</h3>
                <div className="text-sm text-yellow-200 space-y-1 max-h-60 overflow-y-auto">
                  {data.payables.map((payable: { payableNumber?: string; status: string; amount: number; organizationId?: string; ledgerEntryId?: string; relatedInvoiceId?: string }, index: number) => (
                    <div key={index} className="border-b border-yellow-700/30 pb-2 mb-2">
                      <p>Number: {payable.payableNumber || 'N/A'} | Status: {payable.status} | Amount: {payable.amount}</p>
                      <p>Org ID: {payable.organizationId || 'None'} | Ledger Entry: {payable.ledgerEntryId || 'None'}</p>
                      <p>Related Invoice: {payable.relatedInvoiceId || 'None'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
