'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface DatabaseTest {
  status: string;
  database: string;
  collections: string[];
  timestamp: string;
}

interface UserDataTest {
  success: boolean;
  data?: {
    profile: {
      name: string;
      email: string;
      phone: string;
    };
    organization: {
      industry: string;
      address: Record<string, unknown>;
    };
    settings: Record<string, unknown>;
  };
  message?: string;
  timestamp?: string;
}

interface EmailTest {
  success: boolean;
  message?: string;
  messageId?: string;
  timestamp?: string;
  error?: string;
}

export default function TestDatabasePage() {
  const { data: session, status } = useSession();
  const [dbTest, setDbTest] = useState<DatabaseTest | null>(null);
  const [userData, setUserData] = useState<UserDataTest | null>(null);
  const [emailTest, setEmailTest] = useState<EmailTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  const testDatabaseConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setDbTest(data);
    } catch (err) {
      setError(`Database test failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testUserData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/user/settings');
      const data = await response.json();
      setUserData(data);
    } catch (err) {
      setError(`User data test failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-session');
      const data = await response.json();
      setUserData(data);
    } catch (err) {
      setError(`Session test failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testEmailService = async () => {
    if (!testEmail) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await response.json();
      setEmailTest(data);
    } catch (err) {
      setError(`Email test failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Database & User Data Test</h1>
        
        {/* Session Status */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Session Status</h2>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Email:</strong> {session?.user?.email || 'Not logged in'}</p>
          <p><strong>Name:</strong> {session?.user?.name || 'Not available'}</p>
          <p><strong>User ID:</strong> {session?.user?.id || 'Not available'}</p>
          <p><strong>Services:</strong> {JSON.stringify(session?.user?.services, null, 2)}</p>
        </div>

        {/* Database Test */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Database Connection Test</h2>
          <button
            onClick={testDatabaseConnection}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4"
          >
            {loading ? 'Testing...' : 'Test Database Connection'}
          </button>
          
          {dbTest && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Database Test Results:</h3>
              <pre className="text-sm overflow-auto">{JSON.stringify(dbTest, null, 2)}</pre>
            </div>
          )}
        </div>

                 {/* User Data Test */}
         <div className="bg-gray-800 p-6 rounded-lg mb-6">
           <h2 className="text-xl font-semibold mb-4">User Data Test</h2>
           <div className="flex gap-4 mb-4">
             <button
               onClick={testUserData}
               disabled={loading}
               className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
             >
               {loading ? 'Loading...' : 'Test User Data Loading'}
             </button>
             <button
               onClick={testSession}
               disabled={loading}
               className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
             >
               {loading ? 'Testing...' : 'Test Session Data'}
             </button>
           </div>
          
          {userData && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">User Data Results:</h3>
              <pre className="text-sm overflow-auto">{JSON.stringify(userData, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Error:</h3>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Email Test */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Email Service Test</h2>
          <div className="flex gap-4 mb-4">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email address to test"
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
            />
            <button
              onClick={testEmailService}
              disabled={loading}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
          
          {emailTest && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Email Test Results:</h3>
              <pre className="text-sm overflow-auto">{JSON.stringify(emailTest, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Environment Check */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <p><strong>MONGODB_URI:</strong> {process.env.NEXT_PUBLIC_MONGODB_URI ? 'Set (hidden)' : 'Not set'}</p>
          <p><strong>DB_NAME:</strong> {process.env.NEXT_PUBLIC_DB_NAME || 'Not set'}</p>
          <p><strong>NEXTAUTH_SECRET:</strong> {process.env.NEXT_PUBLIC_NEXTAUTH_SECRET ? 'Set (hidden)' : 'Not set'}</p>
          <p><strong>NEXTAUTH_URL:</strong> {process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set'}</p>
        </div>
      </div>
    </div>
  );
} 