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
  // CoinGecko API for crypto prices (free tier: 10-50 calls/minute)
  private static readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  
  // Crypto currency IDs mapping (CoinGecko uses different IDs)
  private static readonly CRYPTO_IDS: Record<string, string> = {
    'CELO': 'celo',
    'CUSD': 'celo-dollar',
    'CEUR': 'celo-euro',
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'XRP': 'ripple',
    'AVAX': 'avalanche-2',
    'ATOM': 'cosmos',
    'FTM': 'fantom',
    'NEAR': 'near',
    'ALGO': 'algorand',
  };

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
      
      if (user?.preferences?.currency) {
        return {
          preferredCurrency: user.preferences.currency,
          displayCurrency: user.preferences.currency,
          autoConvert: true
        };
      }
      
      return defaultPreferences;
    } catch {
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
      const finalAmount = Math.round(convertedAmount * 100) / 100;

      return finalAmount;
    } catch (error) {
      console.error('❌ [CurrencyService] Conversion failed:', error);
      return amount; // Return original amount if conversion fails
    }
  }

  // Check if currency is crypto
  private static isCryptoCurrency(currency: string): boolean {
    return this.CRYPTO_IDS.hasOwnProperty(currency.toUpperCase());
  }

  // Get crypto price in USD from CoinGecko
  private static async getCryptoPriceInUSD(cryptoCode: string): Promise<number> {
    const cryptoId = this.CRYPTO_IDS[cryptoCode.toUpperCase()];
    if (!cryptoId) {
      throw new Error(`Crypto currency ${cryptoCode} not supported`);
    }

    try {
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=${cryptoId}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const price = data[cryptoId]?.usd;
      
      if (!price || typeof price !== 'number') {
        throw new Error(`Price not found for ${cryptoCode}`);
      }

      return price;
    } catch (error) {
      console.error(`❌ [CurrencyService] Failed to fetch crypto price for ${cryptoCode}:`, error);
      throw error;
    }
  }

  // Get exchange rate between two currencies (supports both fiat and crypto)
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const key = `${fromCurrency}_${toCurrency}`;
    
    // Determine cache duration: shorter for crypto (5 minutes) vs fiat (1 hour)
    const fromIsCrypto = this.isCryptoCurrency(fromCurrency);
    const toIsCrypto = this.isCryptoCurrency(toCurrency);
    const isCryptoConversion = fromIsCrypto || toIsCrypto;
    const cacheDuration = isCryptoConversion ? 300000 : 3600000; // 5 min for crypto, 1 hour for fiat
    
    // Check if we have a cached rate
    const cached = this.conversionRates.get(key);
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < cacheDuration) {
      return cached.rate;
    }

    try {
      // Handle crypto conversions
      if (fromIsCrypto && toIsCrypto) {
        // Crypto to crypto: convert via USD
        const fromPriceUSD = await this.getCryptoPriceInUSD(fromCurrency);
        const toPriceUSD = await this.getCryptoPriceInUSD(toCurrency);
        const rate = fromPriceUSD / toPriceUSD;
        
        this.conversionRates.set(key, {
          fromCurrency,
          toCurrency,
          rate,
          lastUpdated: new Date()
        });
        
        return rate;
      } else if (fromIsCrypto) {
        // Crypto to fiat: get crypto price in USD, then convert USD to fiat
        const cryptoPriceUSD = await this.getCryptoPriceInUSD(fromCurrency);
        const usdToFiatRate = await this.getFiatExchangeRate('USD', toCurrency);
        const rate = cryptoPriceUSD * usdToFiatRate;
        
        this.conversionRates.set(key, {
          fromCurrency,
          toCurrency,
          rate,
          lastUpdated: new Date()
        });
        
        return rate;
      } else if (toIsCrypto) {
        // Fiat to crypto: convert fiat to USD, then get crypto price
        const fiatToUSDRate = await this.getFiatExchangeRate(fromCurrency, 'USD');
        const cryptoPriceUSD = await this.getCryptoPriceInUSD(toCurrency);
        const rate = fiatToUSDRate / cryptoPriceUSD;
        
        this.conversionRates.set(key, {
          fromCurrency,
          toCurrency,
          rate,
          lastUpdated: new Date()
        });
        
        return rate;
      } else {
        // Fiat to fiat: use existing API
        return await this.getFiatExchangeRate(fromCurrency, toCurrency);
      }
    } catch {
      
      // Fallback to hardcoded rates for common currencies (CORRECTED RATES)
      const fallbackRates: Record<string, Record<string, number>> = {
        'USD': {
          'EUR': 0.86,  // 1 USD = 0.86 EUR
          'GBP': 0.78,  // 1 USD = 0.78 GBP
          'KES': 129.0, // 1 USD = 129 KES (CORRECTED)
          'GHS': 12.0,
          'NGN': 1500.0
        },
        'EUR': {
          'USD': 1.16,  // 1 EUR = 1.16 USD
          'GBP': 0.85,  // 1 EUR = 0.85 GBP
          'KES': 150.0, // 1 EUR = 150 KES (CORRECTED)
          'GHS': 14.0,
          'NGN': 1750.0
        },
        'GBP': {
          'USD': 1.28,  // 1 GBP = 1.28 USD
          'EUR': 1.18,  // 1 GBP = 1.18 EUR
          'KES': 165.0, // 1 GBP = 165 KES
          'GHS': 15.0,
          'NGN': 1920.0
        },
        'KES': {
          'USD': 0.0078,  // 1 KES = 0.0078 USD (1/129)
          'EUR': 0.0067,  // 1 KES = 0.0067 EUR (1/150)
          'GBP': 0.0061,  // 1 KES = 0.0061 GBP (1/165)
          'GHS': 0.093,   // 1 KES = 0.093 GHS
          'NGN': 11.6     // 1 KES = 11.6 NGN
        },
        'GHS': {
          'USD': 0.083,
          'EUR': 0.071,
          'GBP': 0.067,
          'KES': 10.7,   // 1 GHS = 10.7 KES
          'NGN': 125.0
        },
        'NGN': {
          'USD': 0.00067, // 1 NGN = 0.00067 USD
          'EUR': 0.00057, // 1 NGN = 0.00057 EUR
          'GBP': 0.00052, // 1 NGN = 0.00052 GBP
          'KES': 0.086,   // 1 NGN = 0.086 KES
          'GHS': 0.008
        }
      };

      const fallbackRate = fallbackRates[fromCurrency]?.[toCurrency];
      if (fallbackRate) {
        return fallbackRate;
      }

      // For crypto, try fallback rates if API fails
      if (fromIsCrypto || toIsCrypto) {
        const fallbackCryptoRates: Record<string, number> = {
          'CELO': 0.175, // Approximate: 0.4 CELO = 0.07 USD, so 1 CELO ≈ 0.175 USD
          'CUSD': 1.0,    // Stablecoin, pegged to USD
          'CEUR': 1.08,   // Stablecoin, pegged to EUR (≈1.08 USD)
          'BTC': 43000.0,
          'ETH': 2500.0,
          'USDT': 1.0,
          'USDC': 1.0,
        };
        
        if (fromIsCrypto && toCurrency === 'USD') {
          const fallbackRate = fallbackCryptoRates[fromCurrency.toUpperCase()];
          if (fallbackRate) {
            console.warn(`⚠️ [CurrencyService] Using fallback rate for ${fromCurrency}: ${fallbackRate}`);
            return fallbackRate;
          }
        } else if (fromCurrency === 'USD' && toIsCrypto) {
          const fallbackRate = 1 / (fallbackCryptoRates[toCurrency.toUpperCase()] || 1);
          if (fallbackRate !== 1) {
            console.warn(`⚠️ [CurrencyService] Using fallback rate for ${toCurrency}: ${fallbackRate}`);
            return fallbackRate;
          }
        }
      }
      
      return 1; // Return 1:1 if no conversion available
    }
  }

  // Get fiat exchange rate (internal method)
  private static async getFiatExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const key = `${fromCurrency}_${toCurrency}`;
    
    // Check cache
    const cached = this.conversionRates.get(key);
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < 3600000) {
      return cached.rate;
    }

    try {
      // Fetch from API
      const response = await fetch(`${this.BASE_URL}/${fromCurrency}`);
      const data = await response.json();
      
      if (data.rates && data.rates[toCurrency]) {
        const rate = data.rates[toCurrency];
        
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
      console.error(`❌ [CurrencyService] Failed to fetch fiat rate ${fromCurrency} to ${toCurrency}:`, error);
      throw error;
    }
  }

  // Convert invoice amounts to preferred currency for reporting
  static async convertInvoiceForReporting(
    invoice: { [key: string]: unknown },
    preferredCurrency: string
  ): Promise<{ [key: string]: unknown }> {
    // Type guard to check if invoice has required properties
    if (!invoice || typeof invoice !== 'object' || !('currency' in invoice)) {
      return invoice;
    }

    // Use consistent field names - prefer 'total' over 'totalAmount'
    const totalAmount = (invoice.total as number) || (invoice.totalAmount as number) || 0;
    const subtotalAmount = (invoice.subtotal as number) || 0;
    const taxAmount = (invoice.totalTax as number) || (invoice.taxAmount as number) || 0;

    if (invoice.currency === preferredCurrency) {
      return invoice;
    }

    try {
      const convertedAmount = await this.convertCurrency(
        totalAmount,
        invoice.currency as string,
        preferredCurrency
      );

      const convertedSubtotal = await this.convertCurrency(
        subtotalAmount,
        invoice.currency as string,
        preferredCurrency
      );

      const convertedTax = await this.convertCurrency(
        taxAmount,
        invoice.currency as string,
        preferredCurrency
      );

      return {
        ...invoice,
        originalCurrency: invoice.currency,
        originalTotalAmount: totalAmount,
        originalSubtotal: subtotalAmount,
        originalTaxAmount: taxAmount,
        currency: preferredCurrency,
        total: convertedAmount, // Use consistent field name
        totalAmount: convertedAmount, // Keep for backward compatibility
        subtotal: convertedSubtotal,
        totalTax: convertedTax, // Use consistent field name
        taxAmount: convertedTax, // Keep for backward compatibility
        conversionRate: convertedAmount / totalAmount
      };
    } catch {
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
    } catch {
      return payable;
    }
  }

  // Get currency symbol
  static getCurrencySymbol(currencyCode: string): string {
    const currency = allCurrencies.find(c => c.code === currencyCode);
    return currency?.symbol || currencyCode;
  }

  // Format amount with currency (handles crypto/non-ISO codes like USDT)
  static formatAmount(amount: number, currency: string, locale: string = 'en-US'): string {
    const code = (currency || 'USD').trim().toUpperCase();
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${code} ${Number(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // Calculate total revenue in preferred currency
  static async calculateTotalRevenue(
    invoices: { [key: string]: unknown }[],
    preferredCurrency: string
  ): Promise<number> {
    let total = 0;

    for (const invoice of invoices) {
      // Type guard to check if invoice has required properties
      if (!invoice || typeof invoice !== 'object' || !('currency' in invoice)) {
        continue;
      }

      // Get the total amount - could be totalAmount or total
      const amount = (invoice.totalAmount || invoice.total) as number;
      if (!amount) {
        continue;
      }

      if (invoice.currency === preferredCurrency) {
        total += amount;
      } else {
        const converted = await this.convertCurrency(
          amount,
          invoice.currency as string,
          preferredCurrency
        );
        total += converted;
      }
    }

    // Round to 2 decimal places to avoid floating point precision issues
    return Math.round(total * 100) / 100;
  }
} 