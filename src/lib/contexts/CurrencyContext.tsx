'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { fiatCurrencies } from '@/data/currencies';

interface CurrencyContextType {
  preferredCurrency: string;
  setPreferredCurrency: (currency: string) => void;
  getCurrencySymbol: (currencyCode?: string) => string;
  formatAmount: (amount: number, currencyCode?: string) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [preferredCurrency, setPreferredCurrencyState] = useState<string>('USD');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's currency preference on mount and when session changes
  useEffect(() => {
    if (session?.user) {
      fetchUserCurrencyPreference();
    } else {
      setPreferredCurrencyState('USD');
      setIsLoading(false);
    }
  }, [session?.user]);

  const fetchUserCurrencyPreference = async () => {
    try {
      const response = await fetch('/api/user/settings');
      const data = await response.json();
      
      if (data.success && data.data.profile.currencyPreference) {
        setPreferredCurrencyState(data.data.profile.currencyPreference);
      } else {
        setPreferredCurrencyState('USD');
      }
    } catch (error) {
      console.error('Error fetching currency preference:', error);
      setPreferredCurrencyState('USD');
    } finally {
      setIsLoading(false);
    }
  };

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
    const symbol = getCurrencySymbol(code);
    
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