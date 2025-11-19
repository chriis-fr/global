import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingData {
  completed: boolean;
  currentStep: number;
  completedSteps: string[];
  serviceOnboarding: Record<string, unknown>;
}

interface OnboardingState {
  onboarding: OnboardingData | null;
  services: Record<string, boolean> | null;
  isLoading: boolean;
  lastFetched: number | null;
  fetchOnboarding: () => Promise<void>;
  setOnboarding: (data: OnboardingData, services: Record<string, boolean>) => void;
  updateOnboarding: (data: Partial<OnboardingData>) => void;
  clearOnboarding: () => void;
}

// Only fetch if data is older than 5 minutes or doesn't exist
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      onboarding: null,
      services: null,
      isLoading: false,
      lastFetched: null,

      fetchOnboarding: async () => {
        const state = get();
        
        // Don't fetch if we have recent data
        if (state.onboarding && state.lastFetched) {
          const now = Date.now();
          const timeSinceFetch = now - state.lastFetched;
          if (timeSinceFetch < CACHE_DURATION) {
            return; // Use cached data
          }
        }

        // Don't fetch if already loading
        if (state.isLoading) {
          return;
        }

        set({ isLoading: true });

        try {
          const response = await fetch('/api/onboarding/status', {
            cache: 'no-store'
          });
          const data = await response.json();

          if (data.success) {
            set({
              onboarding: data.data.onboarding,
              services: data.data.services,
              lastFetched: Date.now(),
              isLoading: false
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Error fetching onboarding status:', error);
          set({ isLoading: false });
        }
      },

      setOnboarding: (data: OnboardingData, services: Record<string, boolean>) => {
        set({
          onboarding: data,
          services,
          lastFetched: Date.now(),
          isLoading: false
        });
      },

      updateOnboarding: (data: Partial<OnboardingData>) => {
        const state = get();
        if (state.onboarding) {
          set({
            onboarding: {
              ...state.onboarding,
              ...data
            },
            lastFetched: Date.now()
          });
        }
      },

      clearOnboarding: () => {
        set({
          onboarding: null,
          services: null,
          lastFetched: null,
          isLoading: false
        });
      }
    }),
    {
      name: 'onboarding-storage',
      // Only persist onboarding data, not loading states
      partialize: (state) => ({
        onboarding: state.onboarding,
        services: state.services,
        lastFetched: state.lastFetched
      })
    }
  )
);

