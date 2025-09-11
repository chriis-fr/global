import { allCurrencies } from '@/data/currencies';

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: Date;
}

export interface UserCurrencyPreferences {
  preferredCurrency: string;
  displayCurrency: string;
  autoConvert: boolean;
}

export class CurrencyService {
  private static conversionRates: Map<string, CurrencyConversion> = new Map();
  private static readonly API_KEY = process.env.EXCHANGE_RATE_API_KEY;
  private static readonly BASE_URL = 'https://api.exchangerate-api.com/v4/latest';

  // Get user's preferred currency
  static async getUserPreferredCurrency(userId: string): Promise<UserCurrencyPreferences> {
    // Default preferences
    const defaultPreferences: UserCurrencyPreferences = {
      preferredCurrency: 'USD',
      displayCurrency: 'USD',
      autoConvert: true
    };

    try {
      // Fetch user preferences from database
      const { UserService } = await import('./userService');
      const user = await UserService.getUserByEmail(userId);
      
      if (user?.settings?.currencyPreference) {
        return {
          preferredCurrency: user.settings.currencyPreference,
          displayCurrency: user.settings.currencyPreference,
          autoConvert: true
        };
      }
      
      return defaultPreferences;
    } catch (error) {
      console.error('Error fetching user currency preferences:', error);
      return defaultPreferences;
    }
  }

  // Convert amount from one currency to another
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    try {
      const rate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = amount * rate;
      console.log('🔍 [CurrencyService] Conversion:', {
        amount,
        fromCurrency,
        toCurrency,
        rate,
        convertedAmount
      });
      return convertedAmount;
    } catch (error) {
      console.error('Error converting currency:', error);
      return amount; // Return original amount if conversion fails
    }
  }

  // Get exchange rate between two currencies
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const key = `${fromCurrency}_${toCurrency}`;
    
    console.log('🔍 [CurrencyService] Getting exchange rate:', { fromCurrency, toCurrency, key });
    
    // Check if we have a cached rate
    const cached = this.conversionRates.get(key);
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < 3600000) { // 1 hour cache
      console.log('🔍 [CurrencyService] Using cached rate:', cached.rate);
      return cached.rate;
    }

    try {
      // Fetch from API
      console.log('🔍 [CurrencyService] Fetching from API:', `${this.BASE_URL}/${fromCurrency}`);
      const response = await fetch(`${this.BASE_URL}/${fromCurrency}`);
      const data = await response.json();
      
      if (data.rates && data.rates[toCurrency]) {
        const rate = data.rates[toCurrency];
        console.log('🔍 [CurrencyService] API rate found:', rate);
        
        // Cache the rate
        this.conversionRates.set(key, {
          fromCurrency,
          toCurrency,
          rate,
          lastUpdated: new Date()
        });
        
        return rate;
      } else {
        throw new Error('Exchange rate not found');
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      
      // Fallback to hardcoded rates for common currencies
      const fallbackRates: Record<string, Record<string, number>> = {
        'USD': {
          'EUR': 0.85,
          'GBP': 0.73,
          'KES': 150.0,
          'GHS': 12.0
        },
        'EUR': {
          'USD': 1.18,
          'GBP': 0.86,
          'KES': 177.0,
          'GHS': 14.0
        },
        'GBP': {
          'USD': 1.37,
          'EUR': 1.16,
          'KES': 205.0,
          'GHS': 16.0
        },
        'KES': {
          'USD': 0.0067,
          'EUR': 0.0056,
          'GBP': 0.0049,
          'GHS': 0.08
        },
        'GHS': {
          'USD': 0.083,
          'EUR': 0.071,
          'GBP': 0.0625,
          'KES': 12.5
        }
      };

      const fallbackRate = fallbackRates[fromCurrency]?.[toCurrency];
      if (fallbackRate) {
        console.log('🔍 [CurrencyService] Using fallback rate:', fallbackRate);
        return fallbackRate;
      }

      console.log('🔍 [CurrencyService] No rate found, returning 1:1');
      return 1; // Return 1:1 if no conversion available
    }
  }

  // Convert invoice amounts to preferred currency for reporting
  static async convertInvoiceForReporting(
    invoice: { [key: string]: unknown },
    preferredCurrency: string
  ): Promise<{ [key: string]: unknown }> {
    // Type guard to check if invoice has required properties
    if (!invoice || typeof invoice !== 'object' || !('currency' in invoice) || !('totalAmount' in invoice)) {
      return invoice;
    }

    if (invoice.currency === preferredCurrency) {
      return invoice;
    }

    try {
      const convertedAmount = await this.convertCurrency(
        invoice.totalAmount as number,
        invoice.currency as string,
        preferredCurrency
      );

      const convertedSubtotal = await this.convertCurrency(
        invoice.subtotal as number,
        invoice.currency as string,
        preferredCurrency
      );

      const convertedTax = await this.convertCurrency(
        invoice.taxAmount as number,
        invoice.currency as string,
        preferredCurrency
      );

      return {
        ...invoice,
        originalCurrency: invoice.currency,
        originalTotalAmount: invoice.totalAmount as number,
        originalSubtotal: invoice.subtotal as number,
        originalTaxAmount: invoice.taxAmount as number,
        currency: preferredCurrency,
        totalAmount: convertedAmount,
        subtotal: convertedSubtotal,
        taxAmount: convertedTax,
        conversionRate: convertedAmount / (invoice.totalAmount as number)
      };
    } catch (error) {
      console.error('Error converting invoice for reporting:', error);
      return invoice;
    }
  }

  // Convert payable amounts to preferred currency for reporting
  static async convertPayableForReporting(
    payable: { [key: string]: unknown },
    preferredCurrency: string
  ): Promise<{ [key: string]: unknown }> {
    // Type guard to check if payable has required properties
    if (!payable || typeof payable !== 'object' || !('currency' in payable) || !('total' in payable)) {
      return payable;
    }

    if (payable.currency === preferredCurrency) {
      return payable;
    }

    try {
      const convertedAmount = await this.convertCurrency(
        payable.total as number,
        payable.currency as string,
        preferredCurrency
      );

      const convertedSubtotal = await this.convertCurrency(
        payable.subtotal as number,
        payable.currency as string,
        preferredCurrency
      );

      const convertedTax = await this.convertCurrency(
        payable.totalTax as number,
        payable.currency as string,
        preferredCurrency
      );

      return {
        ...payable,
        originalCurrency: payable.currency,
        originalTotal: payable.total as number,
        originalSubtotal: payable.subtotal as number,
        originalTotalTax: payable.totalTax as number,
        currency: preferredCurrency,
        total: convertedAmount,
        subtotal: convertedSubtotal,
        totalTax: convertedTax,
        conversionRate: convertedAmount / (payable.total as number)
      };
    } catch (error) {
      console.error('Error converting payable for reporting:', error);
      return payable;
    }
  }

  // Get currency symbol
  static getCurrencySymbol(currencyCode: string): string {
    const currency = allCurrencies.find(c => c.code === currencyCode);
    return currency?.symbol || currencyCode;
  }

  // Format amount with currency
  static formatAmount(amount: number, currency: string, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Calculate total revenue in preferred currency
  static async calculateTotalRevenue(
    invoices: { [key: string]: unknown }[],
    preferredCurrency: string
  ): Promise<number> {
    let total = 0;

    for (const invoice of invoices) {
      // Type guard to check if invoice has required properties
      if (!invoice || typeof invoice !== 'object' || !('currency' in invoice) || !('totalAmount' in invoice)) {
        continue;
      }

      if (invoice.currency === preferredCurrency) {
        total += invoice.totalAmount as number;
      } else {
        const converted = await this.convertCurrency(
          invoice.totalAmount as number,
          invoice.currency as string,
          preferredCurrency
        );
        total += converted;
      }
    }

    return total;
  }
} 