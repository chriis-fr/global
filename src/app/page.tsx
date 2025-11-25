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

  // Manage cursor visibility and ensure variables are set - ONLY on landing page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // This component only renders on landing page, so we can safely assume isHome is true
    // But we check anyway for safety
    if (isHome && pathname === '/') {
      const body = document.body;
      // Set cursor CSS variables - ensure they're always set when on landing page
      body.style.setProperty("--cursor-color", "rgb(238, 19, 19)");
      body.style.setProperty("--blur", "3px");
      body.style.setProperty("--innerBlur", "2px");
      body.style.setProperty("--outerColor", "rgba(226, 79, 46, 0.4)");
      
      // Hide default cursor on landing page
      body.style.cursor = 'none';
      document.documentElement.style.cursor = 'none';
      body.setAttribute('data-landing-page', 'true');
      document.documentElement.setAttribute('data-landing-page', 'true');
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
  }, [isHome, pathname]);

  return (
    <>
      {/* Cursor renders immediately on landing page - no dynamic import delay */}
      {isHome && (
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
