// Lightweight caching utility for services pages
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class ServiceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache age in milliseconds
  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return Date.now() - entry.timestamp;
  }

  // Check if cache is stale (older than specified time)
  isStale(key: string, staleThreshold: number = 2 * 60 * 1000): boolean {
    const age = this.getAge(key);
    return age !== null && age > staleThreshold;
  }
}

// Global cache instance
export const serviceCache = new ServiceCache();

// Cache keys
export const CACHE_KEYS = {
  INVOICES: (userId: string) => `invoices_${userId}`,
  CLIENTS: (userId: string) => `clients_${userId}`,
  LEDGER: (userId: string) => `ledger_${userId}`,
  PAYABLES: (userId: string) => `payables_${userId}`,
  ONBOARDING: (userId: string, service: string) => `onboarding_${userId}_${service}`,
} as const;
