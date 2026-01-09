"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CurrencyService } from '@/lib/services/currencyService';
import { convertCryptoToUsd, convertUsdToFiat } from '@/lib/services/exchangeRateService';

/**
 * Batch convert multiple currency amounts at once
 * This reduces API calls significantly
 */
export async function batchConvertCurrency(
  conversions: Array<{ amount: number; fromCurrency: string; toCurrency: string }>
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    // If no conversions needed, return empty
    if (conversions.length === 0) {
      return { success: true, data: [] };
    }

    // Helper to check if currency is crypto
    const isCryptoCurrency = (currency: string): boolean => {
      const cryptoCurrencies = ['CELO', 'ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'cUSD', 'cEUR'];
      const isCrypto = cryptoCurrencies.includes(currency.toUpperCase());
      if (isCrypto) {
        console.log(`[CurrencyActions] Detected crypto currency: ${currency}`);
      }
      return isCrypto;
    };

    // Batch convert all amounts
    const results = await Promise.all(
      conversions.map(async ({ amount, fromCurrency, toCurrency }) => {
        // If currencies are the same, no conversion needed
        if (fromCurrency === toCurrency) {
          return {
            originalAmount: amount,
            convertedAmount: amount,
            fromCurrency,
            toCurrency,
            rate: 1,
            converted: false,
          };
        }

        try {
          const fromIsCrypto = isCryptoCurrency(fromCurrency);
          const toIsCrypto = isCryptoCurrency(toCurrency);
          
          let convertedAmount: number;
          let rate: number;

          // Handle crypto conversions using our exchange rate service
          if (fromIsCrypto && toCurrency.toUpperCase() === 'USD') {
            // Crypto to USD - use our exchange rate service
            console.log(`[CurrencyActions] Converting ${amount} ${fromCurrency} to USD`);
            convertedAmount = await convertCryptoToUsd(amount, fromCurrency);
            rate = convertedAmount / amount;
            console.log(`[CurrencyActions] Converted ${amount} ${fromCurrency} = ${convertedAmount} USD (rate: ${rate})`);
          } else if (fromIsCrypto && !toIsCrypto) {
            // Crypto to fiat - convert crypto to USD, then USD to fiat
            const usdAmount = await convertCryptoToUsd(amount, fromCurrency);
            convertedAmount = await convertUsdToFiat(usdAmount, toCurrency);
            rate = convertedAmount / amount;
          } else if (fromCurrency.toUpperCase() === 'USD' && toIsCrypto) {
            // USD to crypto - get crypto price, then calculate how much crypto = USD amount
            const cryptoPriceUSD = await convertCryptoToUsd(1, toCurrency);
            rate = 1 / cryptoPriceUSD; // 1 USD = X crypto
            convertedAmount = amount * rate;
          } else {
            // Use CurrencyService for fiat-to-fiat or other conversions
            convertedAmount = await CurrencyService.convertCurrency(amount, fromCurrency, toCurrency);
            rate = await CurrencyService.getExchangeRate(fromCurrency, toCurrency);
          }
          
          return {
            originalAmount: amount,
            convertedAmount,
            fromCurrency,
            toCurrency,
            rate,
            converted: true,
          };
        } catch (error) {
          console.error(`Error converting ${amount} ${fromCurrency} to ${toCurrency}:`, error);
          // Try fallback to CurrencyService
          try {
            const convertedAmount = await CurrencyService.convertCurrency(amount, fromCurrency, toCurrency);
            const rate = await CurrencyService.getExchangeRate(fromCurrency, toCurrency);
            return {
              originalAmount: amount,
              convertedAmount,
              fromCurrency,
              toCurrency,
              rate,
              converted: true,
            };
          } catch (fallbackError) {
            console.error(`Fallback conversion also failed:`, fallbackError);
            // Return original amount on error
            return {
              originalAmount: amount,
              convertedAmount: amount,
              fromCurrency,
              toCurrency,
              rate: 1,
              converted: false,
              error: error instanceof Error ? error.message : 'Conversion failed',
            };
          }
        }
      })
    );

    return { success: true, data: results };
  } catch (error) {
    console.error('Error in batch currency conversion:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to convert currencies' 
    };
  }
}

/**
 * Get user's preferred currency
 */
export async function getUserPreferredCurrency() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const preferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    
    return {
      success: true,
      data: {
        preferredCurrency: preferences.preferredCurrency,
      },
    };
  } catch (error) {
    console.error('Error getting user preferred currency:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get preferred currency' 
    };
  }
}

