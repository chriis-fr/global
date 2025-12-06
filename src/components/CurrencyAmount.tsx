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
  isCrypto?: boolean; // Whether this is a crypto currency invoice
}

// Common crypto currencies
const CRYPTO_CURRENCIES = ['USDT', 'USDC', 'BTC', 'ETH', 'CELO', 'cUSD', 'cEUR', 'DAI', 'MATIC', 'BNB'];

export default function CurrencyAmount({
  amount,
  currency,
  className = '',
  showOriginalCurrency = false,
  showConversionRate = false,
  convertedAmount,
  convertedCurrency,
  isCrypto,
}: CurrencyAmountProps) {
  const { preferredCurrency, getCurrencySymbol } = useCurrency();
  
  // Detect if this is crypto (check prop or currency code) - do this early
  const isCryptoCurrency = isCrypto || CRYPTO_CURRENCIES.includes(currency.toUpperCase());
  
  // If currencies are the same, handle crypto differently
  if (currency === preferredCurrency) {
    // For crypto, always show format even if same currency (with gray brackets)
    if (isCryptoCurrency) {
      const symbol = getCurrencySymbol(currency);
      const formatted = formatNumber(amount, symbol);
      return (
        <span className={className}>
          {formatted.display}
          <span className="text-xs text-gray-400 ml-1">
            ({currency.toUpperCase()})
          </span>
        </span>
      );
    }
    // For fiat, just show amount
    const symbol = getCurrencySymbol(currency);
    const formatted = formatNumber(amount, symbol);
    return (
      <span className={className}>
        {formatted.display}
      </span>
    );
  }

  // If we have a pre-converted amount and it matches preferred currency, use it directly
  const usePreConverted = convertedAmount !== undefined && 
                          convertedCurrency === preferredCurrency &&
                          currency !== preferredCurrency;
  
  // Use pre-converted amount if available (before calling hook)
  if (usePreConverted && convertedAmount !== undefined) {
    const convertedSymbol = getCurrencySymbol(preferredCurrency);
    const convertedFormatted = formatNumber(convertedAmount, convertedSymbol);

    // For crypto: show converted amount first, then crypto currency in brackets (gray)
    if (isCryptoCurrency) {
      return (
        <span className={className}>
          {convertedFormatted.display}
          <span className="text-xs text-gray-400 ml-1">
            ({currency.toUpperCase()})
          </span>
        </span>
      );
    }

    // For fiat: show converted amount with original in brackets (gray)
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

  // Only use hook if we don't have pre-converted amount
  const conversion = useCurrencyConversion(
    amount,
    currency,
    preferredCurrency
  );

  // If conversion is loading, handle differently for crypto vs fiat
  if (conversion.isLoading) {
    if (isCryptoCurrency) {
      // For crypto: show loading with crypto format, use hook's initial convertedAmount if available
      const convertedSymbol = getCurrencySymbol(preferredCurrency);
      const displayAmount = conversion.convertedAmount || amount; // Use converted if available, otherwise original
      const formatted = formatNumber(displayAmount, convertedSymbol);
      return (
        <span className={className}>
          {formatted.display}
          <span className="text-xs text-gray-400 ml-1">
            ({currency.toUpperCase()})
          </span>
        </span>
      );
    } else {
      // For fiat: show original amount
      const symbol = getCurrencySymbol(currency);
      const formatted = formatNumber(amount, symbol);
      return (
        <span className={className}>
          {formatted.display}
        </span>
      );
    }
  }

  // If there's an error or timeout, handle differently for crypto vs fiat
  if (conversion.error) {
    if (isCryptoCurrency) {
      // For crypto: still show format with original amount converted (estimate)
      const convertedSymbol = getCurrencySymbol(preferredCurrency);
      const formatted = formatNumber(conversion.convertedAmount || amount, convertedSymbol);
      return (
        <span className={className} title={conversion.error}>
          {formatted.display}
          <span className="text-xs text-gray-400 ml-1">
            ({currency.toUpperCase()})
          </span>
        </span>
      );
    } else {
      // For fiat: show original amount
      const symbol = getCurrencySymbol(currency);
      const formatted = formatNumber(amount, symbol);
      return (
        <span className={className} title={conversion.error}>
          {formatted.display}
        </span>
      );
    }
  }

  // Display converted amount
  const convertedSymbol = getCurrencySymbol(preferredCurrency);
  const convertedFormatted = formatNumber(conversion.convertedAmount, convertedSymbol);

  // For crypto: show converted amount first, then crypto currency in brackets (gray)
  if (isCryptoCurrency) {
    return (
      <span className={className}>
        {convertedFormatted.display}
        <span className="text-xs text-gray-400 ml-1">
          ({currency.toUpperCase()})
        </span>
      </span>
    );
  }

  // For fiat: show converted amount with original in brackets
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