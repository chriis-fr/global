'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'auto-hidden'>('expanded');

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

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-900 to-blue-950 overflow-hidden">
      <Sidebar />
      <main className={`flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out min-w-0 ${
        sidebarState === 'expanded' ? 'lg:ml-0' : 'lg:ml-16'
      } ml-16`}>
        <div className="max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
} 