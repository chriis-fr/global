/**
 * Utility functions for locking exchange rates when transactions are recorded
 * 
 * This should be called whenever a blockchain transaction is saved to the database
 * to ensure accurate accounting and reporting.
 */

import { lockExchangeRates, LockedExchangeRates } from '@/lib/services/exchangeRateService';

/**
 * Lock exchange rates for a transaction and return the data to store
 * 
 * Usage:
 * ```typescript
 * const exchangeRates = await lockTransactionExchangeRates({
 *   amount: 0.3,
 *   cryptoCurrency: 'CELO',
 *   fiatCurrency: 'USD' // or user's preferred currency
 * });
 * 
 * // Store in transaction document
 * await db.collection('invoices').updateOne(
 *   { _id: invoiceId },
 *   { 
 *     $set: { 
 *       txHash: txHash,
 *       exchangeRates: exchangeRates 
 *     } 
 *   }
 * );
 * ```
 */
export async function lockTransactionExchangeRates(params: {
  amount: number;
  cryptoCurrency: string;
  fiatCurrency?: string;
}): Promise<LockedExchangeRates> {
  return await lockExchangeRates(params);
}

/**
 * Get USD amount from a transaction with locked exchange rates
 * Falls back to current rate if not locked
 */
export async function getUsdAmountFromTransaction(
  amount: number,
  currency: string,
  lockedRates?: LockedExchangeRates
): Promise<number> {
  // If we have locked rates, use them
  if (lockedRates && lockedRates.amountUsd) {
    return lockedRates.amountUsd;
  }

  // Otherwise, convert using current rate
  if (currency.toUpperCase() === 'USD') {
    return amount;
  }

  const { convertCryptoToUsd } = await import('@/lib/services/exchangeRateService');
  return await convertCryptoToUsd(amount, currency);
}

