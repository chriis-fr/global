'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import Breadcrumb from '@/components/dashboard/Breadcrumb';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'auto-hidden'>('expanded');
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Redirect to auth page if not authenticated
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      router.push('/auth');
      return;
    }
  }, [session, status, router]);

  // Listen for sidebar state changes
  useEffect(() => {
    const handleResize = () => {
      // Check if sidebar is collapsed or auto-hidden based on CSS classes
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        const isCollapsed = sidebar.classList.contains('w-16');
        const isAutoHidden = sidebar.classList.contains('w-16') && !sidebar.classList.contains('w-64');
        
        if (isAutoHidden) {
          setSidebarState('auto-hidden');
        } else if (isCollapsed) {
          setSidebarState('collapsed');
        } else {
          setSidebarState('expanded');
        }
      }
    };

    // Use MutationObserver to watch for class changes on the sidebar
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const observer = new MutationObserver(handleResize);
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
      
      // Initial check
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
  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-900 to-blue-950 overflow-hidden">
      <Sidebar />
      <main 
        ref={mainContentRef}
        className={`flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out min-w-0 ${
          sidebarState === 'expanded' ? 'lg:ml-0' : 'lg:ml-16'
        } lg:ml-16 ml-0`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <div className="max-w-full">
          <Breadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
} 