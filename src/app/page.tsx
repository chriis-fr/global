'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import Preloader from "@/components/preloader";
import { usePathname } from 'next/navigation';
import AnimatedCursor from 'react-animated-cursor';

export default function Home() {
  const { status } = useSession();
  const [preloaderComplete, setPreloaderComplete] = useState(false);
  const landingPageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);

  // Detect if device is a touch device (mobile/tablet) - dynamically updates on resize/device changes
  // This detection happens immediately on mount and updates in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectTouchDevice = () => {
      // More accurate touch detection: 
      // - Check if pointer is coarse (touch screen) AND fine pointer is not available
      // - OR check if it's a small screen with touch support
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it a touch device if:
      // - Has coarse pointer but no fine pointer (touch-only device)
      // - OR has touch support AND small screen (mobile device)
      const isTouch = (hasCoarsePointer && !hasFinePointer) || (hasTouch && isSmallScreen);
      setIsTouchDevice(isTouch);
    };

    // Detect immediately (during preloader time for performance)
    detectTouchDevice();

    // Listen for resize / orientation changes
    window.addEventListener('resize', detectTouchDevice);
    
    // Listen for pointer media query changes (when switching device emulation)
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');
    
    // Modern browsers support addEventListener on MediaQueryList
    if (coarsePointerQuery.addEventListener) {
      coarsePointerQuery.addEventListener('change', detectTouchDevice);
    } else {
      // Fallback for older browsers
      coarsePointerQuery.addListener(detectTouchDevice);
    }
    
    if (finePointerQuery.addEventListener) {
      finePointerQuery.addEventListener('change', detectTouchDevice);
    } else {
      finePointerQuery.addListener(detectTouchDevice);
    }

    return () => {
      window.removeEventListener('resize', detectTouchDevice);
      if (coarsePointerQuery.removeEventListener) {
        coarsePointerQuery.removeEventListener('change', detectTouchDevice);
      } else {
        coarsePointerQuery.removeListener(detectTouchDevice);
      }
      if (finePointerQuery.removeEventListener) {
        finePointerQuery.removeEventListener('change', detectTouchDevice);
      } else {
        finePointerQuery.removeListener(detectTouchDevice);
      }
    };
  }, []); // Run immediately on mount - detection happens during preloader time


  // Track when session check is complete
  const sessionCheckComplete = status !== 'loading';

  // Show preloader immediately on first render, then wait for both animation and session
  // Default to true to ensure preloader shows immediately
  const shouldShowPreloader = !preloaderComplete || !sessionCheckComplete;
  
  // Set body background immediately on mount (only runs on landing page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set body background for preloader
      document.body.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
      document.documentElement.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
    }
  }, []);

  // Update body background when preloader completes - keep blue until landing page is fully visible
  useEffect(() => {
    if (!shouldShowPreloader) {
      // Keep blue background until landing page animation completes (1 second)
      const timer = setTimeout(() => {
        // Clear body background to let crossBg (white) show through
        document.body.style.background = '';
        document.documentElement.style.background = '';
      }, 1100); // Slightly longer than animation duration
      return () => clearTimeout(timer);
    } else {
      // Ensure blue background is set while preloader is showing
      document.body.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
      document.documentElement.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
    }
  }, [shouldShowPreloader]);

  // Show preloader immediately, even before client-side hydration
  // Return preloader structure immediately to prevent any flash

  const isHome = pathname === "/";

  // Variables are now set in layout.tsx script BEFORE React hydrates
  // This useEffect only updates them if needed (e.g., on hover changes)
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body && isHome) {
      // Ensure variables are set (backup in case script didn't run)
      const body = document.body;
      body.style.setProperty("--cursor-color", "rgb(238, 19, 19)");
      body.style.setProperty("--blur", "3px");
      body.style.setProperty("--innerBlur", "2px");
      body.style.setProperty("--outerColor", "rgba(226, 79, 46, 0.4)");
    }
  }, [isHome]);

  // Set CSS variables - always set when on landing page (needed for cursor animation)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return;
    
    if (isHome && pathname === '/') {
      const body = document.body;
      // Set cursor CSS variables - ensure they're always set when on landing page
      // This ensures animation works when cursor mounts on desktop
      body.style.setProperty("--cursor-color", "rgb(238, 19, 19)");
      body.style.setProperty("--blur", "3px");
      body.style.setProperty("--innerBlur", "2px");
      body.style.setProperty("--outerColor", "rgba(226, 79, 46, 0.4)");
    }
  }, [isHome, pathname]);

  // Manage cursor visibility dynamically - updates in real-time based on device type
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only manage cursor visibility on landing page
    if (isHome && pathname === '/') {
      if (isTouchDevice === false) {
        // Hide default cursor on landing page (desktop/laptop confirmed)
        document.body.style.cursor = 'none';
        document.documentElement.style.cursor = 'none';
        document.body.setAttribute('data-landing-page', 'true');
        document.documentElement.setAttribute('data-landing-page', 'true');
      } else {
        // On touch devices or while detecting, ensure cursor is visible (normal behavior)
        document.body.style.cursor = '';
        document.documentElement.style.cursor = '';
        document.body.removeAttribute('data-landing-page');
        document.documentElement.removeAttribute('data-landing-page');
      }
    }
    
    // Cleanup: ALWAYS restore cursor when component unmounts (user navigates away)
    return () => {
      if (typeof window !== 'undefined') {
        // Always restore cursor - this ensures it's visible on other pages
        document.body.style.cursor = '';
        document.documentElement.style.cursor = '';
        document.body.removeAttribute('data-landing-page');
        document.documentElement.removeAttribute('data-landing-page');
      }
    };
  }, [isHome, pathname, isTouchDevice]); // Updates whenever isTouchDevice changes

  return (
    <>
      {/* Cursor renders only after detection completes and confirms it's NOT a touch device */}
      {/* Wait for detection (!== null) and only mount if isTouchDevice === false (desktop/laptop) */}
      {/* This prevents red dot on mobile - detection happens during preloader for performance */}
      {isHome && isTouchDevice === false && (
        <AnimatedCursor 
          innerSize={isHome ? 25 : 14}
          outerSize={isHome ? 40 : 46}
          outerAlpha={0.2}
          innerScale={0.7}
          innerStyle={{
            filter: "blur(var(--innerBlur))",
            backgroundColor: "var(--cursor-color)",
          }}
          outerStyle={{
            filter: "blur(var(--blur))",
            backgroundColor: "var(--outerColor)",
            opacity: 0.4,
          }}
          outerScale={5}
          clickables={[
            "a",
            'input[type="text"]',
            'input[type="email"]',
            'input[type="number"]',
            'input[type="submit"]',
            'input[type="image"]',
            "label[for]",
            "select",
            "textarea",
            "button",
            ".link",
            // "img",
          ]}
        />
      )}
      {/* Preloader - shows immediately, mounts once and stays until complete */}
      {shouldShowPreloader && (
        <Preloader 
          key="landing-preloader"
          setComplete={setPreloaderComplete} 
          canComplete={sessionCheckComplete}
          landingPageRef={landingPageRef}
        />
      )}
      {/* Landing page content - always rendered but hidden, slides up with preloader layers */}
      <div 
        onMouseOver={() => {
          // Update cursor variables on hover - exactly like working app
          if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
            const body = document.body;
            body.style.setProperty("--cursor-color", "rgb(238, 19, 19)");
            body.style.setProperty("--blur", "3px");
            body.style.setProperty("--innerBlur", "2px");
            body.style.setProperty("--outerColor", "rgba(226, 79, 46, 0.4)");
          }
        }}

        ref={landingPageRef}
        className="crossBg"
        style={{ 
          position: shouldShowPreloader ? 'fixed' : 'relative',
          top: shouldShowPreloader ? 0 : 'auto',
          left: shouldShowPreloader ? 0 : 'auto',
          right: shouldShowPreloader ? 0 : 'auto',
          width: '100%',
          minHeight: '100vh',
          pointerEvents: shouldShowPreloader ? 'none' : 'auto',
          zIndex: shouldShowPreloader ? 9980 : 1,
          opacity: 0,
          visibility: 'hidden'
          // opacity and visibility controlled by GSAP animation
        }}
      >
        <div className='bg' />
        <Header />
        <div className="pt-16">
          <BlockchainBenefits />
        </div>
        <Footer />
      </div>
    </>
  );
}
