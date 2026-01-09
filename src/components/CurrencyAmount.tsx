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
  
  // Call hook unconditionally at the top (before any early returns)
  // For crypto, ALWAYS use the hook to convert (even if we have pre-converted amount, we want real-time rates)
  // Only use hook if we don't have pre-converted amount OR if it's crypto
  const shouldUseHook = isCryptoCurrency || !(convertedAmount !== undefined && 
                          convertedCurrency === preferredCurrency &&
                          currency !== preferredCurrency);
  
  const conversion = useCurrencyConversion(
    shouldUseHook ? amount : 0,
    shouldUseHook ? currency : preferredCurrency,
    shouldUseHook ? preferredCurrency : preferredCurrency
  );
  
  // For crypto currencies, ALWAYS convert to preferred currency (usually USD)
  // Format: $X.XX(0.4 CELO) where $X.XX is converted USD amount, 0.4 CELO is original crypto amount
  // We never skip conversion for crypto, even if currency matches preferredCurrency
  
  // If currencies are the same and NOT crypto, just show amount (no conversion needed)
  if (currency === preferredCurrency && !isCryptoCurrency) {
    const symbol = getCurrencySymbol(currency);
    const formatted = formatNumber(amount, symbol);
    return (
      <span className={className}>
        {formatted.display}
      </span>
    );
  }
  
  // For crypto, always proceed to conversion logic below (don't return early)

  // If we have a pre-converted amount and it matches preferred currency, use it directly
  const usePreConverted = convertedAmount !== undefined && 
                          convertedCurrency === preferredCurrency &&
                          currency !== preferredCurrency;
  
  // Use pre-converted amount if available (before calling hook)
  if (usePreConverted && convertedAmount !== undefined) {
    const convertedSymbol = getCurrencySymbol(preferredCurrency);
    const convertedFormatted = formatNumber(convertedAmount, convertedSymbol);

    // For crypto: show converted amount first, then original amount and currency in brackets (gray)
    // Format: $0.04 (0.3 CELO) where $0.04 is converted USD and 0.3 CELO is original crypto
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

  // If conversion is loading, handle differently for crypto vs fiat
  if (conversion.isLoading) {
    if (isCryptoCurrency) {
      // For crypto: show loading with crypto format, use hook's initial convertedAmount if available
      const convertedSymbol = getCurrencySymbol(preferredCurrency);
      const displayAmount = conversion.convertedAmount || amount; // Use converted if available, otherwise original
      const convertedFormatted = formatNumber(displayAmount, convertedSymbol);
      return (
        <span className={className}>
          {convertedFormatted.display}
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
      // For crypto: still show format with converted amount (estimate)
      const convertedSymbol = getCurrencySymbol(preferredCurrency);
      const convertedFormatted = formatNumber(conversion.convertedAmount || amount, convertedSymbol);
      return (
        <span className={className} title={conversion.error}>
          {convertedFormatted.display}
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

  // Display converted amount - always use convertedAmount from hook
  // The hook should have the correct converted value after conversion completes
  const convertedSymbol = getCurrencySymbol(preferredCurrency);
  // Use convertedAmount if available (should always be set after conversion)
  // For crypto, convertedAmount should be different from amount (e.g., 0.3 CELO -> 0.04 USD)
  // If conversion hasn't happened yet or failed, use the original amount as fallback
  const displayConvertedAmount = conversion.convertedAmount;
  
  // For crypto, if convertedAmount equals original amount and conversion says it converted,
  // something went wrong - log it
  if (isCryptoCurrency && displayConvertedAmount === amount && conversion.converted) {
    console.warn(`Crypto conversion may have failed: ${amount} ${currency} converted to ${displayConvertedAmount} ${preferredCurrency}`);
  }
  
  // For crypto, if we're still loading or haven't converted yet, show a placeholder
  // but don't show the original amount as if it's USD
  if (isCryptoCurrency && (conversion.isLoading || !conversion.converted) && displayConvertedAmount === amount) {
    // Still calculating, show loading or use a very small placeholder
    // The conversion should complete soon
  }
  
  const convertedFormatted = formatNumber(displayConvertedAmount, convertedSymbol);

  // For crypto: show converted amount first, then currency name in brackets (gray)
  // Format: $0.04 (CELO) where $0.04 is converted USD
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