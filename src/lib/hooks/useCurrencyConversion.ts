import { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { batchConvertCurrency } from '@/app/actions/currency-actions';

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
  
  const conversions = Array.from(conversionQueue.entries()).map(([key, item]) => ({
    key,
    ...item,
  }));
  
  // Clear queue
  conversionQueue.clear();
  
  try {
    const result = await batchConvertCurrency(
      conversions.map(c => ({
        amount: c.amount,
        fromCurrency: c.fromCurrency,
        toCurrency: c.toCurrency,
      }))
    );
    
    if (result.success && result.data) {
      conversions.forEach((conversion, index) => {
        const conversionResult = result.data[index];
        if (conversionResult) {
          conversion.resolve({
            originalAmount: conversionResult.originalAmount,
            convertedAmount: conversionResult.convertedAmount,
            fromCurrency: conversionResult.fromCurrency,
            toCurrency: conversionResult.toCurrency,
            rate: conversionResult.rate,
            converted: conversionResult.converted,
            isLoading: false,
            error: null,
          });
        } else {
          conversion.reject(new Error('Conversion failed'));
        }
      });
    } else {
      conversions.forEach(conversion => {
        conversion.reject(new Error(result.error || 'Conversion failed'));
      });
    }
  } catch (error) {
    conversions.forEach(conversion => {
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
  const { getCachedConversion, setCachedConversion, getCacheKey } = useCurrencyStore();
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
    
    // If currencies are the same, no conversion needed
    if (fromCurrency === targetCurrency) {
      setResult({
        originalAmount: amount,
        convertedAmount: amount,
        fromCurrency,
        toCurrency: targetCurrency,
        rate: 1,
        converted: false,
        isLoading: false,
        error: null
      });
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(amount, fromCurrency, targetCurrency);
    const cached = getCachedConversion(cacheKey);
    
    if (cached) {
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

    // Add to batch queue
    setResult(prev => ({ ...prev, isLoading: true, error: null }));
    
    const queueKey = `${Date.now()}_${Math.random()}`;
    const promise = new Promise<ConversionResult>((resolve, reject) => {
      conversionQueue.set(queueKey, {
        resolve: (result) => {
          if (mountedRef.current) {
            // Cache the result
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
        toCurrency: targetCurrency,
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
      conversionQueue.delete(queueKey);
    };
  }, [amount, fromCurrency, toCurrency, preferredCurrency, getCachedConversion, setCachedConversion, getCacheKey]);

  return result;
} 