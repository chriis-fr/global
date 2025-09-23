import { useState, useCallback } from 'react';

interface ServiceData {
  [key: string]: unknown;
}

export const useServiceData = () => {
  const [data, setData] = useState<ServiceData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (service: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/onboarding/service?service=${service}`);
      if (!response.ok) {
        throw new Error('Failed to fetch service data');
      }
      const result = await response.json();
      setData(prev => ({ ...prev, [service]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchData };
};
