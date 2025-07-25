'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestOnboardingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const checkOnboardingStatus = async () => {
    if (!session?.user?.id) {
      setMessage('No user session found');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/status');
      const data = await response.json();
      
      if (data.success) {
        setMessage(`Onboarding Status: ${JSON.stringify(data.data.onboarding, null, 2)}`);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!session?.user?.id) {
      setMessage('No user session found');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Onboarding completed successfully! You should now be redirected to dashboard on next login.');
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetOnboarding = async () => {
    if (!session?.user?.id) {
      setMessage('No user session found');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          step: 1,
          completedSteps: []
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Onboarding reset to step 1!');
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">
            Onboarding Test Page
          </h1>
          
          {session?.user ? (
            <div className="space-y-4">
              <div className="text-white text-sm">
                <p><strong>User ID:</strong> {session.user.id}</p>
                <p><strong>Email:</strong> {session.user.email}</p>
                <p><strong>Name:</strong> {session.user.name}</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={checkOnboardingStatus}
                  disabled={loading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Check Onboarding Status'}
                </button>
                
                <button
                  onClick={completeOnboarding}
                  disabled={loading}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Complete Onboarding'}
                </button>
                
                <button
                  onClick={resetOnboarding}
                  disabled={loading}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Reset Onboarding'}
                </button>
              </div>
              
              {message && (
                <div className="mt-4 p-3 bg-white/5 rounded-lg">
                  <pre className="text-white text-xs whitespace-pre-wrap">{message}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-white mb-4">Please log in to test onboarding</p>
              <button
                onClick={() => window.location.href = '/auth'}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 