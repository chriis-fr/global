/**
 * Exchange Rate Service
 * 
 * Handles fetching and caching exchange rates for:
 * - Crypto currencies (via CoinGecko)
 * - Fiat currencies (via ExchangeRate.host)
 * 
 * All rates are locked at transaction time and stored permanently.
 */

interface CachedRate {
  rate: number;
  timestamp: number;
  expiresAt: number;
}

// Cache for exchange rates (in-memory, 60 second TTL)
const rateCache = new Map<string, CachedRate>();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Crypto currency IDs for CoinGecko
const CRYPTO_IDS: Record<string, string> = {
  'CELO': 'celo',
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'AVAX': 'avalanche-2',
};

/**
 * Get crypto to USD exchange rate from CoinGecko
 */
export async function getCryptoToUsdRate(
  cryptoCurrency: string
): Promise<number> {
  const cryptoUpper = cryptoCurrency.toUpperCase();
  const cacheKey = `crypto_${cryptoUpper}_USD`;
  
  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.rate;
  }

  try {
    const coinId = CRYPTO_IDS[cryptoUpper];
    if (!coinId) {
      throw new Error(`Unsupported crypto currency: ${cryptoCurrency}`);
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data[coinId]?.usd;

    if (!rate || typeof rate !== 'number') {
      throw new Error(`Invalid rate data from CoinGecko for ${cryptoCurrency}`);
    }

    // Cache the rate
    rateCache.set(cacheKey, {
      rate,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    });

    return rate;
  } catch (error) {
    console.error(`Error fetching ${cryptoCurrency} rate:`, error);
    
    // Return cached rate even if expired as fallback
    if (cached) {
      console.warn(`Using expired cached rate for ${cryptoCurrency}`);
      return cached.rate;
    }
    
    throw error;
  }
}

/**
 * Get USD to fiat currency exchange rate from ExchangeRate.host
 */
export async function getUsdToFiatRate(
  fiatCurrency: string
): Promise<number> {
  const fiatUpper = fiatCurrency.toUpperCase();
  
  // USD to USD is always 1
  if (fiatUpper === 'USD') {
    return 1;
  }

  const cacheKey = `fiat_USD_${fiatUpper}`;
  
  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.rate;
  }

  try {
    const response = await fetch(
      `https://api.exchangerate.host/convert?from=USD&to=${fiatUpper}&amount=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 } // Cache for 1 hour (fiat rates change less frequently)
      }
    );

    if (!response.ok) {
      throw new Error(`ExchangeRate API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.result;

    if (!rate || typeof rate !== 'number') {
      throw new Error(`Invalid rate data from ExchangeRate for ${fiatCurrency}`);
    }

    // Cache the rate
    rateCache.set(cacheKey, {
      rate,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    });

    return rate;
  } catch (error) {
    console.error(`Error fetching ${fiatCurrency} rate:`, error);
    
    // Return cached rate even if expired as fallback
    if (cached) {
      console.warn(`Using expired cached rate for ${fiatCurrency}`);
      return cached.rate;
    }
    
    throw error;
  }
}

/**
 * Convert crypto amount to USD
 */
export async function convertCryptoToUsd(
  amount: number,
  cryptoCurrency: string
): Promise<number> {
  const rate = await getCryptoToUsdRate(cryptoCurrency);
  return amount * rate;
}

/**
 * Convert USD to fiat currency
 */
export async function convertUsdToFiat(
  amount: number,
  fiatCurrency: string
): Promise<number> {
  const rate = await getUsdToFiatRate(fiatCurrency);
  return amount * rate;
}

/**
 * Convert crypto directly to fiat currency (crypto -> USD -> fiat)
 */
export async function convertCryptoToFiat(
  amount: number,
  cryptoCurrency: string,
  fiatCurrency: string
): Promise<number> {
  const usdAmount = await convertCryptoToUsd(amount, cryptoCurrency);
  return await convertUsdToFiat(usdAmount, fiatCurrency);
}

/**
 * Lock exchange rates for a transaction
 * This should be called when a payment is initiated to store rates permanently
 */
export interface LockedExchangeRates {
  cryptoCurrency: string;
  amountCrypto: number;
  rateCryptoToUsd: number;
  amountUsd: number;
  rateUsdToFiat?: number;
  amountFiat?: number;
  fiatCurrency?: string;
  lockedAt: Date;
}

export async function lockExchangeRates(params: {
  amount: number;
  cryptoCurrency: string;
  fiatCurrency?: string;
}): Promise<LockedExchangeRates> {
  const { amount, cryptoCurrency, fiatCurrency } = params;

  // Fetch rates at this moment
  const rateCryptoToUsd = await getCryptoToUsdRate(cryptoCurrency);
  const amountUsd = amount * rateCryptoToUsd;

  let rateUsdToFiat: number | undefined;
  let amountFiat: number | undefined;

  if (fiatCurrency && fiatCurrency.toUpperCase() !== 'USD') {
    rateUsdToFiat = await getUsdToFiatRate(fiatCurrency);
    amountFiat = amountUsd * rateUsdToFiat;
  }

  return {
    cryptoCurrency: cryptoCurrency.toUpperCase(),
    amountCrypto: amount,
    rateCryptoToUsd,
    amountUsd,
    rateUsdToFiat,
    amountFiat,
    fiatCurrency: fiatCurrency?.toUpperCase(),
    lockedAt: new Date(),
  };
}

/**
 * Clear the rate cache (useful for testing or forced refresh)
 */
export function clearRateCache(): void {
  rateCache.clear();
}

