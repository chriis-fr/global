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

  // Touch gesture handlers for mobile sidebar
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isRightSwipe = distance < -50; // Swipe right to open sidebar

    if (isRightSwipe && touchStart < 50) { // Only trigger if swipe starts from left edge
      // Trigger sidebar open by dispatching a custom event
      const event = new CustomEvent('openMobileSidebar');
      window.dispatchEvent(event);
    }
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
      >
        <div className="max-w-full">
          <Breadcrumb />
          {children}
        </div>
      </main>
      

    </div>
  );
} 