'use client';

import { useState } from 'react';
import { formatNumber, formatNumberWithoutCurrency, FormattedNumber } from '@/lib/utils/numberFormat';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

interface FormattedNumberDisplayProps {
  value: number;
  currency?: string;
  className?: string;
  showCurrency?: boolean;
  usePreferredCurrency?: boolean;
}

export default function FormattedNumberDisplay({ 
  value, 
  currency = '$', 
  className = '',
  showCurrency = true,
  usePreferredCurrency = true
}: FormattedNumberDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { preferredCurrency, getCurrencySymbol, formatAmount } = useCurrency();
  
  // Use preferred currency if specified, otherwise use the provided currency
  const displayCurrency = usePreferredCurrency ? preferredCurrency : currency;
  const currencySymbol = getCurrencySymbol(displayCurrency);
  
  const formattedNumber: FormattedNumber = showCurrency 
    ? formatNumber(value, currencySymbol)
    : formatNumberWithoutCurrency(value);

  const handleClick = () => {
    if (formattedNumber.isAbbreviated) {
      setIsExpanded(!isExpanded);
    }
  };

  const displayValue = isExpanded ? formattedNumber.full : formattedNumber.display;
  const isClickable = formattedNumber.isAbbreviated;

  return (
    <span
      onClick={handleClick}
      className={`${className} ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      title={isClickable ? 'Click to see full value' : undefined}
    >
      {displayValue}
    </span>
  );
} 