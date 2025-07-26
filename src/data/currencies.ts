export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  type: 'fiat' | 'crypto';
  logo?: string; // Path to logo image
  network?: string; // For crypto currencies
  decimals?: number; // For crypto currencies
}

export const fiatCurrencies: Currency[] = [
  { id: 'usd', code: 'USD', name: 'US Dollar', symbol: '$', type: 'fiat', logo: '/currencies/usd.png' },
  { id: 'eur', code: 'EUR', name: 'Euro', symbol: '€', type: 'fiat', logo: '/currencies/eur.png' },
  { id: 'gbp', code: 'GBP', name: 'British Pound', symbol: '£', type: 'fiat', logo: '/currencies/gbp.png' },
  { id: 'jpy', code: 'JPY', name: 'Japanese Yen', symbol: '¥', type: 'fiat', logo: '/currencies/jpy.png' },
  { id: 'cad', code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', type: 'fiat', logo: '/currencies/cad.png' },
  { id: 'aud', code: 'AUD', name: 'Australian Dollar', symbol: 'A$', type: 'fiat', logo: '/currencies/aud.png' },
  { id: 'chf', code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', type: 'fiat', logo: '/currencies/chf.png' },
  { id: 'cny', code: 'CNY', name: 'Chinese Yuan', symbol: '¥', type: 'fiat', logo: '/currencies/cny.png' },
  { id: 'inr', code: 'INR', name: 'Indian Rupee', symbol: '₹', type: 'fiat', logo: '/currencies/inr.png' },
  { id: 'brl', code: 'BRL', name: 'Brazilian Real', symbol: 'R$', type: 'fiat', logo: '/currencies/brl.png' },
  { id: 'mxn', code: 'MXN', name: 'Mexican Peso', symbol: '$', type: 'fiat', logo: '/currencies/mxn.png' },
  { id: 'sgd', code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', type: 'fiat', logo: '/currencies/sgd.png' },
  { id: 'hkd', code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', type: 'fiat', logo: '/currencies/hkd.png' },
  { id: 'nzd', code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', type: 'fiat', logo: '/currencies/nzd.png' },
  { id: 'sek', code: 'SEK', name: 'Swedish Krona', symbol: 'kr', type: 'fiat', logo: '/currencies/sek.png' },
  { id: 'nok', code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', type: 'fiat', logo: '/currencies/nok.png' },
  { id: 'dkk', code: 'DKK', name: 'Danish Krone', symbol: 'kr', type: 'fiat', logo: '/currencies/dkk.png' },
  { id: 'pln', code: 'PLN', name: 'Polish Złoty', symbol: 'zł', type: 'fiat', logo: '/currencies/pln.png' },
  { id: 'czk', code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', type: 'fiat', logo: '/currencies/czk.png' },
  { id: 'huf', code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', type: 'fiat', logo: '/currencies/huf.png' },
  { id: 'rub', code: 'RUB', name: 'Russian Ruble', symbol: '₽', type: 'fiat', logo: '/currencies/rub.png' },
  { id: 'try', code: 'TRY', name: 'Turkish Lira', symbol: '₺', type: 'fiat', logo: '/currencies/try.png' },
  { id: 'krw', code: 'KRW', name: 'South Korean Won', symbol: '₩', type: 'fiat', logo: '/currencies/krw.png' },
  { id: 'thb', code: 'THB', name: 'Thai Baht', symbol: '฿', type: 'fiat', logo: '/currencies/thb.png' },
  { id: 'myr', code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', type: 'fiat', logo: '/currencies/myr.png' },
  { id: 'idr', code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', type: 'fiat', logo: '/currencies/idr.png' },
  { id: 'php', code: 'PHP', name: 'Philippine Peso', symbol: '₱', type: 'fiat', logo: '/currencies/php.png' },
  { id: 'vnd', code: 'VND', name: 'Vietnamese Dong', symbol: '₫', type: 'fiat', logo: '/currencies/vnd.png' },
  { id: 'egp', code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', type: 'fiat', logo: '/currencies/egp.png' },
  { id: 'zar', code: 'ZAR', name: 'South African Rand', symbol: 'R', type: 'fiat', logo: '/currencies/zar.png' },
  { id: 'ngn', code: 'NGN', name: 'Nigerian Naira', symbol: '₦', type: 'fiat', logo: '/currencies/ngn.png' },
  { id: 'kes', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', type: 'fiat', logo: '/currencies/kes.png' },
  { id: 'ghs', code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', type: 'fiat', logo: '/currencies/ghs.png' },
  { id: 'ugx', code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', type: 'fiat', logo: '/currencies/ugx.png' },
  { id: 'tzs', code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', type: 'fiat', logo: '/currencies/tzs.png' },
];

export const cryptoCurrencies: Currency[] = [
  { id: 'btc', code: 'BTC', name: 'Bitcoin', symbol: '₿', type: 'crypto', logo: '/currencies/btc.png', network: 'Bitcoin', decimals: 8 },
  { id: 'eth', code: 'ETH', name: 'Ethereum', symbol: 'Ξ', type: 'crypto', logo: '/currencies/eth.png', network: 'Ethereum', decimals: 18 },
  { id: 'usdt', code: 'USDT', name: 'Tether', symbol: '₮', type: 'crypto', logo: '/currencies/usdt.png', network: 'Ethereum', decimals: 6 },
  { id: 'usdc', code: 'USDC', name: 'USD Coin', symbol: '$', type: 'crypto', logo: '/currencies/usdc.png', network: 'Ethereum', decimals: 6 },
  { id: 'bnb', code: 'BNB', name: 'BNB', symbol: 'BNB', type: 'crypto', logo: '/currencies/bnb.png', network: 'BNB Smart Chain', decimals: 18 },
  { id: 'sol', code: 'SOL', name: 'Solana', symbol: '◎', type: 'crypto', logo: '/currencies/sol.png', network: 'Solana', decimals: 9 },
  { id: 'ada', code: 'ADA', name: 'Cardano', symbol: '₳', type: 'crypto', logo: '/currencies/ada.png', network: 'Cardano', decimals: 6 },
  { id: 'doge', code: 'DOGE', name: 'Dogecoin', symbol: 'Ð', type: 'crypto', logo: '/currencies/doge.png', network: 'Dogecoin', decimals: 8 },
  { id: 'dot', code: 'DOT', name: 'Polkadot', symbol: '●', type: 'crypto', logo: '/currencies/dot.png', network: 'Polkadot', decimals: 10 },
  { id: 'matic', code: 'MATIC', name: 'Polygon', symbol: 'MATIC', type: 'crypto', logo: '/currencies/matic.png', network: 'Polygon', decimals: 18 },
  { id: 'link', code: 'LINK', name: 'Chainlink', symbol: 'LINK', type: 'crypto', logo: '/currencies/link.png', network: 'Ethereum', decimals: 18 },
  { id: 'uni', code: 'UNI', name: 'Uniswap', symbol: 'UNI', type: 'crypto', logo: '/currencies/uni.png', network: 'Ethereum', decimals: 18 },
  { id: 'ltc', code: 'LTC', name: 'Litecoin', symbol: 'Ł', type: 'crypto', logo: '/currencies/ltc.png', network: 'Litecoin', decimals: 8 },
  { id: 'bch', code: 'BCH', name: 'Bitcoin Cash', symbol: '₿', type: 'crypto', logo: '/currencies/bch.png', network: 'Bitcoin Cash', decimals: 8 },
  { id: 'xrp', code: 'XRP', name: 'XRP', symbol: 'XRP', type: 'crypto', logo: '/currencies/xrp.png', network: 'Ripple', decimals: 6 },
  { id: 'avax', code: 'AVAX', name: 'Avalanche', symbol: 'AVAX', type: 'crypto', logo: '/currencies/avax.png', network: 'Avalanche', decimals: 18 },
  { id: 'atom', code: 'ATOM', name: 'Cosmos', symbol: 'ATOM', type: 'crypto', logo: '/currencies/atom.png', network: 'Cosmos', decimals: 6 },
  { id: 'ftm', code: 'FTM', name: 'Fantom', symbol: 'FTM', type: 'crypto', logo: '/currencies/ftm.png', network: 'Fantom', decimals: 18 },
  { id: 'near', code: 'NEAR', name: 'NEAR Protocol', symbol: 'NEAR', type: 'crypto', logo: '/currencies/near.png', network: 'NEAR', decimals: 24 },
  { id: 'algo', code: 'ALGO', name: 'Algorand', symbol: 'ALGO', type: 'crypto', logo: '/currencies/algo.png', network: 'Algorand', decimals: 6 },
];

export const allCurrencies = [...fiatCurrencies, ...cryptoCurrencies];

export function getCurrencyByCode(code: string): Currency | undefined {
  return allCurrencies.find(currency => currency.code === code.toUpperCase());
}

export function getCurrencyById(id: string): Currency | undefined {
  return allCurrencies.find(currency => currency.id === id.toLowerCase());
}

export function getFiatCurrencies(): Currency[] {
  return fiatCurrencies;
}

export function getCryptoCurrencies(): Currency[] {
  return cryptoCurrencies;
}

export function getCurrenciesByNetwork(network: string): Currency[] {
  return cryptoCurrencies.filter(currency => currency.network === network);
} 