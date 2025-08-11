'use client';

import { useState } from 'react';
import { formatNumber, formatNumberWithoutCurrency, FormattedNumber } from '@/lib/utils/numberFormat';

interface FormattedNumberDisplayProps {
  value: number;
  currency?: string;
  className?: string;
  showCurrency?: boolean;
}

export default function FormattedNumberDisplay({ 
  value, 
  currency = '$', 
  className = '',
  showCurrency = true 
}: FormattedNumberDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formattedNumber: FormattedNumber = showCurrency 
    ? formatNumber(value, currency)
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