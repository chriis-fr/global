'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';
import { fiatCurrencies } from '@/data/currencies';
import { getPreferredCurrency, type PreferredCurrencyResult } from '@/lib/actions/currency';

interface CurrencyContextType {
  preferredCurrency: string;
  setPreferredCurrency: (currency: string) => void;
  getCurrencySymbol: (currencyCode?: string) => string;
  formatAmount: (amount: number, currencyCode?: string) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_CACHE_KEY = 'currency_pref';
const CURRENCY_USER_KEY = 'currency_user_id';
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

function getCachedCurrency(userId?: string): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const cached = localStorage.getItem(CURRENCY_CACHE_KEY);
    const cachedUserId = localStorage.getItem(CURRENCY_USER_KEY);
    if (cached && cachedUserId === userId) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return data.preferredCurrency;
    }
  } catch {
    // ignore
  }
  return null;
}

function setCachedCurrency(data: PreferredCurrencyResult, userId?: string) {
  if (typeof window === 'undefined' || !data || !userId) return;
  try {
    localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    localStorage.setItem(CURRENCY_USER_KEY, userId);
  } catch {
    // ignore
  }
}

export function CurrencyProvider({
  children,
  initialCurrency,
}: { children: ReactNode; initialCurrency?: PreferredCurrencyResult | null }) {
  const { data: session } = useSession();
  const [preferredCurrency, setPreferredCurrencyState] = useState<string>(() => {
    if (initialCurrency?.preferredCurrency) return initialCurrency.preferredCurrency;
    return 'USD';
  });
  const [isLoading, setIsLoading] = useState(() => !initialCurrency);
  const hadInitial = useRef(!!initialCurrency);

  const fetchUserCurrencyPreference = useCallback(async (showLoading = true) => {
    if (!session?.user?.id) return;
    if (showLoading) setIsLoading(true);
    try {
      const result = await getPreferredCurrency();
      if (result?.preferredCurrency) {
        setPreferredCurrencyState(result.preferredCurrency);
        setCachedCurrency(result, session.user.id);
      } else {
        setPreferredCurrencyState('USD');
      }
    } catch (error) {
      console.error('❌ [CurrencyContext] Error fetching currency preference:', error);
      setPreferredCurrencyState('USD');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) {
      setPreferredCurrencyState('USD');
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(CURRENCY_CACHE_KEY);
          localStorage.removeItem(CURRENCY_USER_KEY);
        } catch {
          // ignore
        }
      }
      return;
    }
    if (initialCurrency?.preferredCurrency && hadInitial.current) {
      hadInitial.current = false;
      setPreferredCurrencyState(initialCurrency.preferredCurrency);
      setCachedCurrency(initialCurrency, session.user.id);
      setIsLoading(false);
      // Optional: refresh in background
      getPreferredCurrency().then((result) => {
        if (result?.preferredCurrency) {
          setPreferredCurrencyState(result.preferredCurrency);
          setCachedCurrency(result, session.user!.id);
        }
      });
      return;
    }
    const cached = getCachedCurrency(session.user.id);
    if (cached) {
      setPreferredCurrencyState(cached);
      setIsLoading(false);
      return;
    }
    fetchUserCurrencyPreference(true);
  // Intentionally limited deps to avoid redundant fetches when initialCurrency/session refs change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, initialCurrency?.preferredCurrency, fetchUserCurrencyPreference]);

  const setPreferredCurrency = (currency: string) => {
    setPreferredCurrencyState(currency);
  };

  const getCurrencySymbol = (currencyCode?: string): string => {
    const code = currencyCode || preferredCurrency;
    const currency = fiatCurrencies.find(c => c.code === code);
    return currency?.symbol || code;
  };

  const formatAmount = (amount: number, currencyCode?: string): string => {
    const code = currencyCode || preferredCurrency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const value: CurrencyContextType = {
    preferredCurrency,
    setPreferredCurrency,
    getCurrencySymbol,
    formatAmount,
    isLoading
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
