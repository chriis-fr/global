"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CurrencyService } from '@/lib/services/currencyService';

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
        } catch (error) {
          console.error(`Error converting ${amount} ${fromCurrency} to ${toCurrency}:`, error);
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

