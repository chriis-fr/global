// Lightweight caching utility for services pages
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new Cache();

// Cache keys
export const CACHE_KEYS = {
  INVOICES: (userId: string) => `invoices_${userId}`,
  CLIENTS: (userId: string) => `clients_${userId}`,
  LEDGER: (userId: string) => `ledger_${userId}`,
  PAYABLES: (userId: string) => `payables_${userId}`,
  ONBOARDING: (userId: string, service: string) => `onboarding_${userId}_${service}`,
} as const;
