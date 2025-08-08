'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestEnableServicePage() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const enableSmartInvoicing = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/services/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceKey: 'smartInvoicing' }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ${data.message}`);
        // Update the session to reflect the new services
        await update();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Enable Smart Invoicing Service</h1>
        
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">Current User:</h2>
          <p><strong>Email:</strong> {session?.user?.email}</p>
          <p><strong>Name:</strong> {session?.user?.name}</p>
          <p><strong>Services:</strong> {JSON.stringify(session?.user?.services, null, 2)}</p>
        </div>

        <button
          onClick={enableSmartInvoicing}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enabling...' : 'Enable Smart Invoicing'}
        </button>

        {message && (
          <div className={`mt-4 p-3 rounded-lg ${
            message.includes('✅') ? 'bg-green-800' : 'bg-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-400">
          <p>After enabling the service:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Refresh the page</li>
            <li>Go back to the dashboard</li>
            <li>You should see &quot;Smart Invoicing&quot; in the sidebar</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 