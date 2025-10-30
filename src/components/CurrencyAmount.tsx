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
}

export default function CurrencyAmount({
  amount,
  currency,
  className = '',
  showOriginalCurrency = false,
  showConversionRate = false
}: CurrencyAmountProps) {
  const { preferredCurrency, getCurrencySymbol } = useCurrency();
  const conversion = useCurrencyConversion(amount, currency, preferredCurrency);

  // Debug logging

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