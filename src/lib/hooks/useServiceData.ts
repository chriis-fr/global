import { useState, useEffect, useCallback } from 'react';
import { serviceCache, CACHE_KEYS } from '@/lib/utils/cache';

interface UseServiceDataOptions {
  cacheKey: string;
  fetchFn: () => Promise<any>;
  ttl?: number; // Time to live in milliseconds
  staleThreshold?: number; // When to refresh in background (milliseconds)
}

export function useServiceData<T>({
  cacheKey,
  fetchFn,
  ttl = 5 * 60 * 1000, // 5 minutes
  staleThreshold = 2 * 60 * 1000 // 2 minutes
}: UseServiceDataOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = serviceCache.get<T>(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          setError(null);
          
          // If cache is stale, refresh in background
          if (serviceCache.isStale(cacheKey, staleThreshold)) {
            console.log(`🔄 [Cache] Background refresh for ${cacheKey}`);
            setRefreshing(true);
            try {
              const freshData = await fetchFn();
              if (freshData) {
                serviceCache.set(cacheKey, freshData, ttl);
                setData(freshData);
              }
            } catch (bgError) {
              console.warn(`⚠️ [Cache] Background refresh failed for ${cacheKey}:`, bgError);
            } finally {
              setRefreshing(false);
            }
          }
          return;
        }
      }

      // No cache or force refresh - fetch fresh data
      setLoading(true);
      setError(null);
      
      const freshData = await fetchFn();
      if (freshData) {
        serviceCache.set(cacheKey, freshData, ttl);
        setData(freshData);
      }
    } catch (err) {
      console.error(`❌ [Cache] Error loading ${cacheKey}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn, ttl, staleThreshold]);

  const refresh = useCallback(() => {
    return loadData(true);
  }, [loadData]);

  const clearCache = useCallback(() => {
    serviceCache.delete(cacheKey);
  }, [cacheKey]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    clearCache,
    loadData
  };
}
