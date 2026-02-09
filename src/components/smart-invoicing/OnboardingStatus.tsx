'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getOnboardingStatus } from '@/app/actions/payable-actions';

interface OnboardingStatusProps {
  className?: string;
}

const CACHE_KEY = 'smart_invoicing_onboarding_status';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function readOnboardingCache(): { isCompleted: boolean | null; valid: boolean } {
  if (typeof window === 'undefined') return { isCompleted: null, valid: false };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { isCompleted: null, valid: false };
    const parsed = JSON.parse(raw);
    const valid = (Date.now() - (parsed?.timestamp ?? 0)) < CACHE_DURATION;
    return { isCompleted: parsed?.data ?? null, valid };
  } catch {
    return { isCompleted: null, valid: false };
  }
}

export default function OnboardingStatus({ className = '' }: OnboardingStatusProps) {
  const router = useRouter();
  const [state, setState] = useState<{ isCompleted: boolean | null; loading: boolean }>(() => {
    const { isCompleted, valid } = readOnboardingCache();
    return { isCompleted, loading: !valid };
  });
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const load = async (background: boolean) => {
      if (!background) setState(prev => ({ ...prev, loading: true }));
      try {
        const result = await getOnboardingStatus('smartInvoicing');
        if (result.success && result.data) {
          setState(prev => ({ ...prev, isCompleted: result.data.isCompleted, loading: false }));
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result.data.isCompleted, timestamp: Date.now() }));
          } catch {}
        } else if (!background) {
          setState(prev => ({ ...prev, isCompleted: null, loading: false }));
        }
      } catch {
        if (!background) setState(prev => ({ ...prev, isCompleted: null, loading: false }));
      }
    };
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const { valid } = readOnboardingCache();
      load(valid);
    }
  }, []);

  const { isCompleted, loading } = state;

  // Don't render anything if loading or if onboarding is completed
  if (loading || isCompleted !== false) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-4 sm:p-6 ${className}`}
    >
      <div className="flex items-start space-x-3 sm:space-x-4">
        <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-yellow-100 mb-2">
            Service Setup Required
          </h3>
          <p className="text-yellow-200 mb-4 text-sm sm:text-base">
            Before you can create invoices, you need to configure your business information and invoice settings. 
            Click &quot;Manage Invoice Info&quot; above or &quot;Complete Setup&quot; below to get started.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard/services/smart-invoicing/onboarding')}
            className="flex items-center justify-center space-x-2 bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 transition-colors min-h-[44px] w-full sm:w-auto"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Complete Setup</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

