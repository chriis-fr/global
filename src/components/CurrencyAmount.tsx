'use client';

import { useCurrencyConversion } from '@/lib/hooks/useCurrencyConversion';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { formatNumber } from '@/lib/utils/numberFormat';

interface CurrencyAmountProps {
  amount: number;
  currency: string;
  className?: string;
  showOriginalCurrency?: boolean;
  showConversionRate?: boolean;
  convertedAmount?: number; // Pre-converted amount from server
  convertedCurrency?: string; // Currency of pre-converted amount
}

export default function CurrencyAmount({
  amount,
  currency,
  className = '',
  showOriginalCurrency = false,
  showConversionRate = false,
  convertedAmount,
  convertedCurrency,
}: CurrencyAmountProps) {
  const { preferredCurrency, getCurrencySymbol } = useCurrency();
  
  // If we have a pre-converted amount and it matches preferred currency, use it directly
  const usePreConverted = convertedAmount !== undefined && 
                          convertedCurrency === preferredCurrency &&
                          currency !== preferredCurrency;
  
  // Only use hook if we don't have pre-converted amount
  const conversion = useCurrencyConversion(
    usePreConverted ? 0 : amount, // Pass 0 to skip conversion if we have pre-converted
    usePreConverted ? preferredCurrency : currency, // Skip conversion
    preferredCurrency
  );

  // If currencies are the same, just display the amount
  if (currency === preferredCurrency) {
    const symbol = getCurrencySymbol(currency);
    const formatted = formatNumber(amount, symbol);
    
    return (
      <span className={className}>
        {formatted.display}
      </span>
    );
  }

  // Use pre-converted amount if available
  if (usePreConverted && convertedAmount !== undefined) {
    const convertedSymbol = getCurrencySymbol(preferredCurrency);
    const convertedFormatted = formatNumber(convertedAmount, convertedSymbol);

    return (
      <span className={className}>
        {convertedFormatted.display}
        {showOriginalCurrency && (
          <span className="text-xs text-gray-400 ml-1">
            ({getCurrencySymbol(currency)}{amount.toLocaleString()})
          </span>
        )}
      </span>
    );
  }

  // If conversion is loading, show loading state
  if (conversion.isLoading) {
    return (
      <span className={`${className} text-gray-400`}>
        Converting...
      </span>
    );
  }

  // If there's an error, show original amount
  if (conversion.error) {
    const symbol = getCurrencySymbol(currency);
    const formatted = formatNumber(amount, symbol);
    
    return (
      <span className={`${className} text-gray-400`} title="Conversion failed">
        {formatted.display}
      </span>
    );
  }

  // Display converted amount
  const convertedSymbol = getCurrencySymbol(preferredCurrency);
  const convertedFormatted = formatNumber(conversion.convertedAmount, convertedSymbol);

  return (
    <span className={className}>
      {convertedFormatted.display}
      {showOriginalCurrency && (
        <span className="text-xs text-gray-400 ml-1">
          ({getCurrencySymbol(currency)}{amount.toLocaleString()})
        </span>
      )}
      {showConversionRate && conversion.converted && (
        <span className="text-xs text-gray-400 ml-1">
          (1 {currency} = {conversion.rate.toFixed(4)} {preferredCurrency})
        </span>
      )}
    </span>
  );
} 