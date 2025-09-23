'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Crown, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionData {
  plan: {
    name: string;
    type: string;
    tier: string;
  } | null;
  status: string;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  usage: {
    invoicesThisMonth: number;
    monthlyVolume: number;
  };
}

export default function SubscriptionStatus() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubscription();
    }
  }, [session]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/billing/current');
      const data = await response.json();
      
      if (data.success) {
        setSubscription(data.data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const getStatusIcon = () => {
    if (subscription.isTrialActive) {
      return <Clock className="h-5 w-5 text-blue-500" />;
    }
    if (subscription.status === 'active') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (subscription.isTrialActive) {
      return `${subscription.trialDaysRemaining} days left in trial`;
    }
    if (subscription.status === 'active') {
      return 'Active subscription';
    }
    return 'Trial expired - Choose a plan';
  };

  const getStatusColor = () => {
    if (subscription.isTrialActive) {
      return 'text-blue-600 bg-blue-50 border-blue-200';
    }
    if (subscription.status === 'active') {
      return 'text-green-600 bg-green-50 border-green-200';
    }
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Subscription</h3>
        </div>
        {getStatusIcon()}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Plan:</span>
          <span className="font-medium text-gray-900">
            {subscription.plan?.name || 'No Plan'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {subscription.plan && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Invoices this month:</span>
            <span className="font-medium text-gray-900">
              {subscription.usage.invoicesThisMonth}
            </span>
          </div>
        )}

        {(!subscription.isTrialActive && subscription.status === 'trial') && (
          <Link
            href="/pricing"
            className="block w-full mt-3 bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Choose a Plan
          </Link>
        )}
      </div>
    </div>
  );
}
