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

interface CurrencyStore {
  preferredCurrency: string;
  conversionCache: ConversionCache;
  cacheExpiry: number; // Cache expiry in milliseconds (default: 1 hour)
  
  setPreferredCurrency: (currency: string) => void;
  getCachedConversion: (key: string) => ConversionCache[string] | null;
  setCachedConversion: (key: string, conversion: ConversionCache[string]) => void;
  clearExpiredCache: () => void;
  getCacheKey: (amount: number, fromCurrency: string, toCurrency: string) => string;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      preferredCurrency: 'USD',
      conversionCache: {},
      cacheExpiry: 3600000, // 1 hour

      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),

      getCacheKey: (amount, fromCurrency, toCurrency) => {
        // Round amount to 2 decimal places for cache key
        const roundedAmount = Math.round(amount * 100) / 100;
        return `${roundedAmount}_${fromCurrency}_${toCurrency}`;
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

      clearExpiredCache: () => {
        const { conversionCache, cacheExpiry } = get();
        const now = Date.now();
        const newCache: ConversionCache = {};
        
        Object.entries(conversionCache).forEach(([key, value]) => {
          if (now - value.timestamp <= cacheExpiry) {
            newCache[key] = value;
          }
        });
        
        set({ conversionCache: newCache });
      },
    }),
    {
      name: 'currency-store',
      partialize: (state) => ({
        preferredCurrency: state.preferredCurrency,
        conversionCache: state.conversionCache,
      }),
    }
  )
);

