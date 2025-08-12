import { useState, useEffect } from 'react';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

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

export function useCurrencyConversion(
  amount: number,
  fromCurrency: string,
  toCurrency?: string
): ConversionResult {
  const { preferredCurrency } = useCurrency();
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

    // Convert currency
    const convertCurrency = async () => {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const response = await fetch('/api/currency/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            fromCurrency,
            toCurrency: targetCurrency
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setResult({
            originalAmount: data.data.originalAmount,
            convertedAmount: data.data.convertedAmount,
            fromCurrency: data.data.fromCurrency,
            toCurrency: data.data.toCurrency,
            rate: data.data.rate,
            converted: data.data.converted,
            isLoading: false,
            error: null
          });
        } else {
          setResult(prev => ({
            ...prev,
            isLoading: false,
            error: data.message || 'Conversion failed'
          }));
        }
      } catch {
        setResult(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to convert currency'
        }));
      }
    };

    convertCurrency();
  }, [amount, fromCurrency, toCurrency, preferredCurrency]);

  return result;
} 