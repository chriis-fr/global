'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import FloatingActionButton from '@/components/dashboard/FloatingActionButton';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'auto-hidden'>('expanded');
  const mainContentRef = useRef<HTMLDivElement>(null);

  const { fetchOnboarding, setOnboarding } = useOnboardingStore();

  // Initialize onboarding store from session on mount and check completion.
  // Guarded with a ref to prevent repeated state updates that can cause update-depth errors.
  const onboardingInitRef = useRef(false);
  const fetchOnboardingRef = useRef(fetchOnboarding);
  
  // Keep ref in sync with fetchOnboarding function
  useEffect(() => {
    fetchOnboardingRef.current = fetchOnboarding;
  }, [fetchOnboarding]);

  useEffect(() => {
    if (status === 'loading') return;
    if (onboardingInitRef.current) return;
    
    if (!session) {
      router.push('/auth');
      return;
    }

    onboardingInitRef.current = true;

    // Check session data FIRST (fastest check, no API call needed)
    const sessionOnboardingCompleted = session.user?.onboarding?.completed || session.user?.onboarding?.currentStep === 4;
    
    // If session shows onboarding is completed, allow dashboard immediately
    if (sessionOnboardingCompleted) {
      if (session.user?.onboarding && session.user?.services) {
        setOnboarding(
          {
            completed: true,
            currentStep: session.user.onboarding.currentStep || 4,
            completedSteps: session.user.onboarding.completedSteps || [],
            serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
          },
          session.user.services as Record<string, boolean>
        );
      }
      return;
    }

    // If session shows onboarding is NOT completed, redirect immediately
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    if (currentPath !== '/onboarding' && !currentPath.startsWith('/onboarding')) {
      window.location.href = '/onboarding';
      return;
    }

    // If session doesn't have onboarding data, initialize store (will fetch if needed)
    if (session.user?.onboarding && session.user?.services) {
      setOnboarding(
        {
          completed: session.user.onboarding.completed || false,
          currentStep: session.user.onboarding.currentStep || 1,
          completedSteps: session.user.onboarding.completedSteps || [],
          serviceOnboarding: session.user.onboarding.serviceOnboarding || {}
        },
        session.user.services as Record<string, boolean>
      );
    } else {
      // Use ref to avoid dependency issues
      fetchOnboardingRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, setOnboarding, router]); // Removed fetchOnboarding from deps to prevent infinite loop

  // Listen for sidebar state changes
  useEffect(() => {
    const handleResize = () => {
      const sidebar = document.querySelector('aside');
      if (!sidebar) return;
      const isCollapsed = sidebar.classList.contains('w-16');
      const isAutoHidden = sidebar.classList.contains('w-16') && !sidebar.classList.contains('w-64');
      const nextState: 'expanded' | 'collapsed' | 'auto-hidden' = isAutoHidden ? 'auto-hidden' : isCollapsed ? 'collapsed' : 'expanded';
      setSidebarState((prev) => (prev === nextState ? prev : nextState));
    };

    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const observer = new MutationObserver(handleResize);
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
      handleResize();
      return () => observer.disconnect();
    }
  }, []);

  // Touch gesture handlers for mobile sidebar - only for edge swipes
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  const isTrackingSwipeRef = useRef<boolean>(false);

  const onTouchStart = (e: React.TouchEvent) => {
    // Only track if touch starts from left edge (first 50px)
    const touchX = e.targetTouches[0].clientX;
    if (touchX < 50) {
      isTrackingSwipeRef.current = true;
      touchStartRef.current = touchX;
      touchEndRef.current = null;
    } else {
      isTrackingSwipeRef.current = false;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Only track if we're tracking a swipe from the edge
    if (isTrackingSwipeRef.current && touchStartRef.current !== null) {
      touchEndRef.current = e.targetTouches[0].clientX;
    }
  };

  const onTouchEnd = () => {
    // Only process if we were tracking an edge swipe
    if (!isTrackingSwipeRef.current || touchStartRef.current === null || touchEndRef.current === null) {
      isTrackingSwipeRef.current = false;
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }
    
    const distance = touchStartRef.current - touchEndRef.current;
    const isRightSwipe = distance < -50; // Swipe right to open sidebar

    if (isRightSwipe) {
      // Trigger sidebar open by dispatching a custom event
      const event = new CustomEvent('openMobileSidebar');
      window.dispatchEvent(event);
    }
    
    // Reset tracking
    isTrackingSwipeRef.current = false;
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Show loading while checking authentication
  // Subscription loads in parallel during auth, so it should be ready by the time auth completes
  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  // Check onboarding completion from session (fastest check)
  // Consider completed if: completed === true OR currentStep === 4
  const isOnboardingCompleted = session.user?.onboarding?.completed || session.user?.onboarding?.currentStep === 4;
  if (!isOnboardingCompleted) {
    return null; // Will redirect via useEffect
  }

  // If we don't know yet, allow dashboard to render (session check will handle redirect)
  // This prevents blocking the dashboard when session shows it's completed

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-900 to-blue-950 overflow-hidden" style={{ willChange: 'auto', contain: 'layout style paint' }}>
      <Sidebar />
      <main 
        ref={mainContentRef}
        className={`flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out min-w-0 ${
          sidebarState === 'expanded' ? 'lg:ml-0' : 'lg:ml-16'
        } lg:ml-16 ml-0`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y pinch-zoom', willChange: 'scroll-position', contain: 'layout style' }}
      >
        <div className="max-w-full">
          <Breadcrumb />
          {children}
        </div>
      </main>
      <FloatingActionButton />
    </div>
  );
} 