export interface FormattedNumber {
  display: string;
  full: string;
  isAbbreviated: boolean;
}

export const formatNumber = (value: number, currency: string = '$'): FormattedNumber => {
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000) {
    const millions = value / 1000000;
    return {
      display: `${currency}${millions.toFixed(2)}M`,
      full: `${currency}${value.toLocaleString()}`,
      isAbbreviated: true
    };
  } else if (absValue >= 1000) {
    const thousands = value / 1000;
    return {
      display: `${currency}${thousands.toFixed(1)}K`,
      full: `${currency}${value.toLocaleString()}`,
      isAbbreviated: true
    };
  } else {
    return {
      display: `${currency}${value.toLocaleString()}`,
      full: `${currency}${value.toLocaleString()}`,
      isAbbreviated: false
    };
  }
};

export const formatNumberWithoutCurrency = (value: number): FormattedNumber => {
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000) {
    const millions = value / 1000000;
    return {
      display: `${millions.toFixed(2)}M`,
      full: value.toLocaleString(),
      isAbbreviated: true
    };
  } else if (absValue >= 1000) {
    const thousands = value / 1000;
    return {
      display: `${thousands.toFixed(1)}K`,
      full: value.toLocaleString(),
      isAbbreviated: true
    };
  } else {
    return {
      display: value.toLocaleString(),
      full: value.toLocaleString(),
      isAbbreviated: false
    };
  }
}; 