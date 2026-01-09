'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getOnboardingStatus } from '@/app/actions/payable-actions';

interface OnboardingStatusProps {
  className?: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export default function OnboardingStatus({ className = '' }: OnboardingStatusProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const loadOnboardingStatus = async () => {
      // Check localStorage cache first
      const cacheKey = 'smart_invoicing_onboarding_status';
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          
          // Use cached data if it's less than 5 minutes old
          if ((now - parsed.timestamp) < CACHE_DURATION) {
            setIsCompleted(parsed.data);
            setLoading(false);
            return;
          }
        } catch {
          // If cache is corrupted, remove it and fetch fresh
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        setLoading(true);
        
        const result = await getOnboardingStatus('smartInvoicing');
        
        if (result.success && result.data) {
          setIsCompleted(result.data.isCompleted);
          
          // Cache in localStorage
          const cacheData = {
            data: result.data.isCompleted,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          // Default to null if error
          setIsCompleted(null);
        }
      } catch {
        setIsCompleted(null);
      } finally {
        setLoading(false);
      }
    };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadOnboardingStatus();
    }
  }, []);

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

