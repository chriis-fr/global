import { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { batchConvertCurrency } from '@/app/actions/currency-actions';

// Helper to check if currency is crypto
const CRYPTO_CURRENCIES = ['CELO', 'ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'cUSD', 'cEUR'];
const isCryptoCurrency = (currency: string): boolean => {
  return CRYPTO_CURRENCIES.includes(currency.toUpperCase());
};

interface ConversionResult {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  converted: boolean;
  isLoading: boolean;
  error: string | null;
}

// Batch conversion queue to reduce API calls
const conversionQueue = new Map<string, {
  resolve: (result: ConversionResult) => void;
  reject: (error: Error) => void;
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}>();

let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 100; // Wait 100ms to batch conversions

async function processBatchConversions() {
  if (conversionQueue.size === 0) return;
  
  const store = useCurrencyStore.getState();
  
  const conversions = Array.from(conversionQueue.entries()).map(([key, item]) => ({
    key,
    ...item,
  }));
  
  // Clear queue
  conversionQueue.clear();
  
  // OPTIMIZATION: Check cache first - if we have rates, use them immediately
  const conversionsWithCachedRates: typeof conversions = [];
  const conversionsNeedingFetch: typeof conversions = [];
  
  conversions.forEach(conversion => {
    const cachedRate = store.getCachedRate(conversion.fromCurrency, conversion.toCurrency);
    if (cachedRate !== null) {
      // We have a cached rate - resolve immediately without API call
      conversionsWithCachedRates.push(conversion);
      const convertedAmount = conversion.amount * cachedRate;
      conversion.resolve({
        originalAmount: conversion.amount,
        convertedAmount,
        fromCurrency: conversion.fromCurrency,
        toCurrency: conversion.toCurrency,
        rate: cachedRate,
        converted: true,
        isLoading: false,
        error: null,
      });
    } else {
      conversionsNeedingFetch.push(conversion);
    }
  });
  
  // If all conversions used cached rates, we're done!
  if (conversionsNeedingFetch.length === 0) {
    return;
  }
  
  // OPTIMIZATION: Deduplicate currency pairs - only fetch rate once per pair
  const uniquePairs = new Map<string, { fromCurrency: string; toCurrency: string; conversions: typeof conversions }>();
  
  conversionsNeedingFetch.forEach(conversion => {
    const pairKey = `${conversion.fromCurrency}_${conversion.toCurrency}`;
    if (!uniquePairs.has(pairKey)) {
      uniquePairs.set(pairKey, {
        fromCurrency: conversion.fromCurrency,
        toCurrency: conversion.toCurrency,
        conversions: []
      });
    }
    uniquePairs.get(pairKey)!.conversions.push(conversion);
  });
  
  // Fetch one conversion per unique pair (we'll reuse the rate for all amounts of that pair)
  const fetchConversions = Array.from(uniquePairs.values()).map(pair => ({
    amount: 1, // Amount doesn't matter, we just need the rate
    fromCurrency: pair.fromCurrency,
    toCurrency: pair.toCurrency,
  }));
  
  try {
    const result = await batchConvertCurrency(fetchConversions);
    
    if (result.success && result.data) {
      // Cache rates and resolve all conversions
      Array.from(uniquePairs.entries()).forEach(([, pair], index) => {
        const conversionResult = result.data[index];
        if (conversionResult && conversionResult.converted) {
          const isCrypto = isCryptoCurrency(pair.fromCurrency);
          // Cache the rate for this currency pair (works for any amount!)
          store.setCachedRate(pair.fromCurrency, pair.toCurrency, conversionResult.rate, isCrypto);
          
          // Resolve all conversions for this pair using the cached rate
          pair.conversions.forEach(conversion => {
            const convertedAmount = conversion.amount * conversionResult.rate;
            conversion.resolve({
              originalAmount: conversion.amount,
              convertedAmount,
              fromCurrency: conversion.fromCurrency,
              toCurrency: conversion.toCurrency,
              rate: conversionResult.rate,
              converted: true,
              isLoading: false,
              error: null,
            });
          });
        } else {
          // Conversion failed - reject all for this pair
          pair.conversions.forEach(conversion => {
            conversion.reject(new Error('Conversion failed'));
          });
        }
      });
    } else {
      conversionsNeedingFetch.forEach(conversion => {
        conversion.reject(new Error(result.error || 'Conversion failed'));
      });
    }
  } catch (error) {
    conversionsNeedingFetch.forEach(conversion => {
      conversion.reject(error instanceof Error ? error : new Error('Conversion failed'));
    });
  }
}

export function useCurrencyConversion(
  amount: number,
  fromCurrency: string,
  toCurrency?: string
): ConversionResult {
  const { preferredCurrency } = useCurrency();
  const { 
    getCachedConversion, 
    setCachedConversion, 
    getCachedRate,
    setCachedRate,
    getCacheKey 
  } = useCurrencyStore();
  const [result, setResult] = useState<ConversionResult>({
    originalAmount: amount,
    convertedAmount: amount,
    fromCurrency,
    toCurrency: toCurrency || preferredCurrency,
    rate: 1,
    converted: false,
    isLoading: false,
    error: null
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const targetCurrency = toCurrency || preferredCurrency;
    const fromIsCrypto = isCryptoCurrency(fromCurrency);
    
    // For crypto, always convert to USD (or preferred currency if different)
    // Even if the target currency matches, we want to show the USD equivalent
    const actualTargetCurrency = fromIsCrypto && targetCurrency === fromCurrency 
      ? 'USD' 
      : targetCurrency;
    
    // If currencies are the same AND not crypto, no conversion needed
    // For crypto, ALWAYS convert even if target is same (to show USD equivalent)
    if (fromCurrency === targetCurrency && !fromIsCrypto) {
      setResult({
        originalAmount: amount,
        convertedAmount: amount,
        fromCurrency,
        toCurrency: actualTargetCurrency,
        rate: 1,
        converted: false,
        isLoading: false,
        error: null
      });
      return;
    }

    // CRITICAL: Check for cached exchange rate first (currency pair only, works for any amount)
    const cachedRate = getCachedRate(fromCurrency, actualTargetCurrency);
    if (cachedRate !== null) {
      // Use cached rate to calculate conversion (no API call needed!)
      const convertedAmount = amount * cachedRate;
      setResult({
        originalAmount: amount,
        convertedAmount,
        fromCurrency,
        toCurrency: actualTargetCurrency,
        rate: cachedRate,
        converted: true,
        isLoading: false,
        error: null
      });
      return;
    }

    // Fallback: Check per-amount conversion cache
    const cacheKey = getCacheKey(amount, fromCurrency, actualTargetCurrency);
    const cached = getCachedConversion(cacheKey);
    
    if (cached) {
      // Also cache the rate for future use
      setCachedRate(fromCurrency, actualTargetCurrency, cached.rate, fromIsCrypto);
      setResult({
        originalAmount: cached.originalAmount,
        convertedAmount: cached.convertedAmount,
        fromCurrency: cached.fromCurrency,
        toCurrency: cached.toCurrency,
        rate: cached.rate,
        converted: cached.converted,
        isLoading: false,
        error: null
      });
      return;
    }

    // Set initial state with original amount (non-blocking)
    setResult({
      originalAmount: amount,
      convertedAmount: amount, // Show original while converting
      fromCurrency,
      toCurrency: actualTargetCurrency,
      rate: 1,
      converted: false,
      isLoading: true, // Still loading but showing original amount
      error: null
    });
    
    const queueKey = `${Date.now()}_${Math.random()}`;
    
    // Set a timeout to prevent getting stuck in loading state
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setResult(prev => ({
          ...prev,
          isLoading: false,
          error: 'Conversion timeout - showing original amount'
        }));
      }
      conversionQueue.delete(queueKey);
    }, 10000); // 10 second timeout
    
    new Promise<ConversionResult>((resolve, reject) => {
      conversionQueue.set(queueKey, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          if (mountedRef.current) {
            // CRITICAL: Cache the exchange rate (currency pair only) for future use
            // This allows any amount to use the same rate without API calls
            if (result.converted && result.rate !== 1) {
              setCachedRate(fromCurrency, actualTargetCurrency, result.rate, fromIsCrypto);
            }
            
            // Also cache the per-amount conversion (for backward compatibility)
            setCachedConversion(cacheKey, {
              originalAmount: result.originalAmount,
              convertedAmount: result.convertedAmount,
              fromCurrency: result.fromCurrency,
              toCurrency: result.toCurrency,
              rate: result.rate,
              converted: result.converted,
              timestamp: Date.now(),
            });
            setResult(result);
          }
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          if (mountedRef.current) {
            setResult(prev => ({
              ...prev,
              isLoading: false,
              error: error.message || 'Conversion failed'
            }));
          }
          reject(error);
        },
        amount,
        fromCurrency,
        toCurrency: actualTargetCurrency,
      });
    });

    // Process batch after delay
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(() => {
      processBatchConversions();
    }, BATCH_DELAY);

    return () => {
      clearTimeout(timeoutId);
      conversionQueue.delete(queueKey);
    };
  }, [amount, fromCurrency, toCurrency, preferredCurrency, getCachedConversion, setCachedConversion, getCachedRate, setCachedRate, getCacheKey]);

  return result;
} 