import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConversionCache {
  [key: string]: {
    originalAmount: number;
    convertedAmount: number;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    converted: boolean;
    timestamp: number;
  };
}

interface ExchangeRateCache {
  [key: string]: {
    rate: number;
    timestamp: number;
  };
}

interface CurrencyStore {
  preferredCurrency: string;
  conversionCache: ConversionCache;
  exchangeRateCache: ExchangeRateCache; // NEW: Cache exchange rates (currency pair only, not per-amount)
  cacheExpiry: number; // Cache expiry in milliseconds (default: 1 hour)
  rateCacheExpiry: number; // Exchange rate cache expiry (5 minutes for crypto, 1 hour for fiat)
  
  setPreferredCurrency: (currency: string) => void;
  getCachedConversion: (key: string) => ConversionCache[string] | null;
  setCachedConversion: (key: string, conversion: ConversionCache[string]) => void;
  getCachedRate: (fromCurrency: string, toCurrency: string) => number | null;
  setCachedRate: (fromCurrency: string, toCurrency: string, rate: number, isCrypto?: boolean) => void;
  clearExpiredCache: () => void;
  getCacheKey: (amount: number, fromCurrency: string, toCurrency: string) => string;
  getRateCacheKey: (fromCurrency: string, toCurrency: string) => string;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      preferredCurrency: 'USD',
      conversionCache: {},
      exchangeRateCache: {}, // NEW: Global exchange rate cache
      cacheExpiry: 3600000, // 1 hour for conversions
      rateCacheExpiry: 300000, // 5 minutes for exchange rates (crypto rates change frequently)

      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),

      getCacheKey: (amount, fromCurrency, toCurrency) => {
        // Round amount to 2 decimal places for cache key
        const roundedAmount = Math.round(amount * 100) / 100;
        return `${roundedAmount}_${fromCurrency}_${toCurrency}`;
      },

      getRateCacheKey: (fromCurrency, toCurrency) => {
        // Rate cache key is just currency pair (no amount)
        return `${fromCurrency}_${toCurrency}`;
      },

      getCachedConversion: (key) => {
        const { conversionCache, cacheExpiry } = get();
        const cached = conversionCache[key];
        
        if (!cached) return null;
        
        // Check if cache is expired
        const now = Date.now();
        if (now - cached.timestamp > cacheExpiry) {
          // Remove expired entry
          set((state) => {
            const newCache = { ...state.conversionCache };
            delete newCache[key];
            return { conversionCache: newCache };
          });
          return null;
        }
        
        return cached;
      },

      setCachedConversion: (key, conversion) => {
        set((state) => ({
          conversionCache: {
            ...state.conversionCache,
            [key]: {
              ...conversion,
              timestamp: Date.now(),
            },
          },
        }));
      },

      // NEW: Get cached exchange rate (currency pair only, works for any amount)
      getCachedRate: (fromCurrency, toCurrency) => {
        const { exchangeRateCache, rateCacheExpiry } = get();
        const rateKey = get().getRateCacheKey(fromCurrency, toCurrency);
        const cached = exchangeRateCache[rateKey];
        
        if (!cached) return null;
        
        // Check if cache is expired
        const now = Date.now();
        if (now - cached.timestamp > rateCacheExpiry) {
          // Remove expired entry
          set((state) => {
            const newRateCache = { ...state.exchangeRateCache };
            delete newRateCache[rateKey];
            return { exchangeRateCache: newRateCache };
          });
          return null;
        }
        
        return cached.rate;
      },

      // NEW: Set cached exchange rate (currency pair only)
      setCachedRate: (fromCurrency, toCurrency, rate, isCrypto = false) => {
        const rateKey = get().getRateCacheKey(fromCurrency, toCurrency);
        set((state) => ({
          exchangeRateCache: {
            ...state.exchangeRateCache,
            [rateKey]: {
              rate,
              timestamp: Date.now(),
            },
          },
          // Update rate cache expiry based on currency type
          rateCacheExpiry: isCrypto ? 300000 : 3600000, // 5 min for crypto, 1 hour for fiat
        }));
      },

      clearExpiredCache: () => {
        const { conversionCache, exchangeRateCache, cacheExpiry, rateCacheExpiry } = get();
        const now = Date.now();
        const newCache: ConversionCache = {};
        const newRateCache: ExchangeRateCache = {};
        
        // Clear expired conversions
        Object.entries(conversionCache).forEach(([key, value]) => {
          if (now - value.timestamp <= cacheExpiry) {
            newCache[key] = value;
          }
        });
        
        // Clear expired rates
        Object.entries(exchangeRateCache).forEach(([key, value]) => {
          if (now - value.timestamp <= rateCacheExpiry) {
            newRateCache[key] = value;
          }
        });
        
        set({ 
          conversionCache: newCache,
          exchangeRateCache: newRateCache
        });
      },
    }),
    {
      name: 'currency-store',
      partialize: (state) => ({
        preferredCurrency: state.preferredCurrency,
        conversionCache: state.conversionCache,
        exchangeRateCache: state.exchangeRateCache, // Persist rate cache too
      }),
    }
  )
);

