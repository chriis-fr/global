'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import Preloader from "@/components/preloader";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Lazy load AnimatedCursor - it's heavy and not needed for initial render
const AnimatedCursor = dynamic(() => import('react-animated-cursor'), { ssr: false });

export default function Home() {
  const { status } = useSession();
  const [preloaderComplete, setPreloaderComplete] = useState(false);
  const [cursorReady, setCursorReady] = useState(false);
  const landingPageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Default to false (desktop) - will be detected once on mount only
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Detect touch device ONCE on mount only - no resize/orientation listeners to prevent flicker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Single detection on mount - no listeners to prevent mobile flicker
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const isSmallScreen = window.innerWidth < 768;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Consider it a touch device if:
    // - Has coarse pointer but no fine pointer (touch-only device)
    // - OR has touch support AND small screen (mobile device)
    const isTouch = (hasCoarsePointer && !hasFinePointer) || (hasTouch && isSmallScreen);
    setIsTouchDevice(isTouch);
  }, []); // Run ONCE on mount only - no resize listeners


  // Track when session check is complete
  const sessionCheckComplete = status !== 'loading';

  // Show preloader immediately on first render, then wait for both animation and session
  // Default to true to ensure preloader shows immediately
  const shouldShowPreloader = !preloaderComplete || !sessionCheckComplete;

  // Show preloader immediately, even before client-side hydration
  // Return preloader structure immediately to prevent any flash

  const isHome = pathname === "/";

  // Set cursor CSS variables early - before cursor mounts (minimal change)
  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return;
    const body = document.body;
    body.style.setProperty("--cursor-color", "rgb(59, 130, 246)");
    body.style.setProperty("--blur", "3px");
    body.style.setProperty("--innerBlur", "2px");
    body.style.setProperty("--outerColor", "rgba(59, 130, 246, 0.4)");
  }, []); // Run once on mount

  // CONSOLIDATED: Single effect that manages ALL body styles AFTER preloader completes
  // This prevents multiple style mutations that cause mobile flicker
  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return;

    const body = document.body;
    const html = document.documentElement;

    // If NOT on landing page, restore everything immediately
    if (pathname !== '/') {
      body.style.cursor = '';
      html.style.cursor = '';
      body.removeAttribute('data-landing-page');
      html.removeAttribute('data-landing-page');
      body.classList.remove('preloader-active');
      return;
    }

      // On landing page - manage styles based on preloader state
      if (shouldShowPreloader) {
        // During preloader: show normal cursor, set background via class
        body.style.cursor = '';
        html.style.cursor = '';
        body.removeAttribute('data-landing-page');
        html.removeAttribute('data-landing-page');
        body.classList.add('preloader-active');
        html.classList.add('preloader-active');
      } else {
      // After preloader completes: set cursor and CSS variables in one batch
      // Use requestAnimationFrame to batch DOM writes and prevent flicker
      requestAnimationFrame(() => {
        if (pathname !== '/') return; // Double-check we're still on landing page

        // Set cursor CSS variables (only once after preloader)
        body.style.setProperty("--cursor-color", "rgb(59, 130, 246)");
        body.style.setProperty("--blur", "3px");
        body.style.setProperty("--innerBlur", "2px");
        body.style.setProperty("--outerColor", "rgba(59, 130, 246, 0.4)");

        if (isTouchDevice === false) {
          // Desktop: hide default cursor, show animated cursor
          body.style.cursor = 'none';
          html.style.cursor = 'none';
          body.setAttribute('data-landing-page', 'true');
          html.setAttribute('data-landing-page', 'true');
          // Set cursor ready flag AFTER all styles are applied
          setCursorReady(true);
        } else {
          // Mobile: keep normal cursor
          body.style.cursor = '';
          html.style.cursor = '';
          body.removeAttribute('data-landing-page');
          html.removeAttribute('data-landing-page');
          setCursorReady(false);
        }

        // Remove preloader background class after animation completes
        setTimeout(() => {
          body.classList.remove('preloader-active');
          html.classList.remove('preloader-active');
        }, 1100);
      });
    }

    // Cleanup: restore cursor when navigating away
    return () => {
      if (typeof window !== 'undefined' && document.body) {
        body.style.cursor = '';
        html.style.cursor = '';
        body.removeAttribute('data-landing-page');
        html.removeAttribute('data-landing-page');
        body.classList.remove('preloader-active');
        html.classList.remove('preloader-active');
        setCursorReady(false);
      }
    };
  }, [isHome, pathname, isTouchDevice, shouldShowPreloader]);

  return (
    <>
      {/* Only mount AnimatedCursor on desktop AFTER cursor state is fully ready - prevents flicker */}
      {isHome && !isTouchDevice && cursorReady && (
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
        {/* <div className='bg' /> */}
        <Header />
        <div className="pt-16">
          <BlockchainBenefits />
        </div>
        <Footer />
      </div>
    </>
  );
}
