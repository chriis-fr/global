'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global cursor manager that ensures cursor is visible on all routes except landing page
 * This component runs on every route to immediately restore cursor when navigating away from landing page
 */
export default function CursorManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
      // Immediately restore cursor if NOT on landing page
      if (pathname !== '/') {
        // Force cursor restoration - remove attribute first (CSS will handle it)
        document.body.removeAttribute('data-landing-page');
        document.documentElement.removeAttribute('data-landing-page');
        
        // Clear any inline cursor styles
        document.body.style.cursor = '';
        document.documentElement.style.cursor = '';
        
        // Force a reflow to ensure styles are applied
        void document.body.offsetHeight;
      }
    } catch (error) {
      console.error('Error managing cursor:', error);
    }
  }, [pathname]); // Run immediately on every pathname change

  // Also run on mount to ensure cursor is correct on initial load
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    try {
      // Check current pathname on mount
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        document.body.removeAttribute('data-landing-page');
        document.documentElement.removeAttribute('data-landing-page');
        document.body.style.cursor = '';
        document.documentElement.style.cursor = '';
        void document.body.offsetHeight; // Force reflow
      }
    } catch (error) {
      console.error('Error managing cursor on mount:', error);
    }
  }, []);

  return null; // This component doesn't render anything
}

