'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import Preloader from "@/components/preloader";

export default function Home() {
  const { status } = useSession();
  const [preloaderComplete, setPreloaderComplete] = useState(false);
  const landingPageRef = useRef<HTMLDivElement>(null);

  // Track when session check is complete
  const sessionCheckComplete = status !== 'loading';

  // Show preloader immediately on first render, then wait for both animation and session
  // Default to true to ensure preloader shows immediately
  const shouldShowPreloader = !preloaderComplete || !sessionCheckComplete || status === 'loading';
  
  // Set body background immediately on mount to prevent any flash
  useEffect(() => {
    // Set immediately on client-side
    if (typeof window !== 'undefined') {
      document.body.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
      document.documentElement.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
    }
  }, []);

  // Update body background when preloader completes - keep blue until landing page is fully visible
  useEffect(() => {
    if (!shouldShowPreloader) {
      // Keep blue background until landing page animation completes (1 second)
      const timer = setTimeout(() => {
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

  return (
    <>
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
        className="bg-white"
        style={{ 
          position: shouldShowPreloader ? 'fixed' : 'static',
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
        <Header />
        <div className="pt-16">
          <BlockchainBenefits />
        </div>
        <Footer />
      </div>
    </>
  );
}
