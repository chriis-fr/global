'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { BlockchainBenefits } from "@/components/landing/blockchain-benefits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import Preloader from "@/components/preloader";
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import toast from 'react-hot-toast';

// Lazy load AnimatedCursor - it's heavy and not needed for initial render
const AnimatedCursor = dynamic(() => import('react-animated-cursor'), { ssr: false });

export default function Home() {
  const { status } = useSession();
  const [preloaderComplete, setPreloaderComplete] = useState(false);
  const [cursorReady, setCursorReady] = useState(false);
  const landingPageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  // Default to false (desktop) - will be detected once on mount only
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const redirectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectToastIdRef = useRef<string | null>(null);
  const hasOfferedRedirectRef = useRef(false);
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);

  const renderRedirectToast = (seconds: number | null, t: { visible: boolean }) => (
    <div className={`max-w-sm w-full bg-blue-950 border border-blue-500/40 rounded-xl shadow-lg px-4 py-3 text-sm text-white/90 flex items-start gap-3 ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
      <div className="mt-0.5">
        <Image
          src="/chainsnobg.png"
          alt="Logo"
          width={24}
          height={24}
          className="h-6 w-6 rounded-full bg-white object-cover"
        />
      </div>
      <div className="flex-1">
        <p className="font-semibold">Already signed in</p>
        <p className="text-xs text-blue-100 mt-1">
          Redirecting to your dashboard in{' '}
          <span className="font-semibold">{seconds ?? 5}s</span>.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (redirectIntervalRef.current) {
                clearInterval(redirectIntervalRef.current);
                redirectIntervalRef.current = null;
              }
              setRedirectSeconds(null);
              if (redirectToastIdRef.current) {
                toast.dismiss(redirectToastIdRef.current);
                redirectToastIdRef.current = null;
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-blue-500/60 text-xs font-medium text-blue-100 hover:bg-blue-500/10 transition-colors"
          >
            Stay here
          </button>
          <button
            type="button"
            onClick={() => {
              if (redirectIntervalRef.current) {
                clearInterval(redirectIntervalRef.current);
                redirectIntervalRef.current = null;
              }
              setRedirectSeconds(null);
              if (redirectToastIdRef.current) {
                toast.dismiss(redirectToastIdRef.current);
                redirectToastIdRef.current = null;
              }
              router.push('/dashboard');
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-500 text-xs font-medium text-white hover:bg-blue-400 transition-colors"
          >
            Go now
          </button>
        </div>
      </div>
    </div>
  );

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


  // Track when session check is complete (used so Preloader doesn't call setComplete until session is ready)
  const sessionCheckComplete = status !== 'loading';

  // Show preloader only until it has completed once. Once preloaderComplete is true, never show again.
  // This prevents scroll from breaking when devtools opens (session refetch sets status to 'loading' and
  // would otherwise make content position:fixed again and remove scrollable height).
  const shouldShowPreloader = !preloaderComplete;

  // Show preloader immediately, even before client-side hydration
  // Return preloader structure immediately to prevent any flash

  const isHome = pathname === "/";

  // If user is already authenticated on the landing page, offer a gentle redirect to dashboard with cancel option
  useEffect(() => {
    if (!isHome) return;
    if (status !== 'authenticated') return;
    if (hasOfferedRedirectRef.current) return;

    hasOfferedRedirectRef.current = true;
    setRedirectSeconds(5);

    const id = toast.custom((t) => renderRedirectToast(5, t), { duration: 6000 });
    redirectToastIdRef.current = id as unknown as string;
    redirectIntervalRef.current = setInterval(() => {
      setRedirectSeconds((prev) => {
        const next = (prev ?? 5) - 1;
        if (next <= 0) {
          if (redirectIntervalRef.current) {
            clearInterval(redirectIntervalRef.current);
            redirectIntervalRef.current = null;
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (redirectIntervalRef.current) {
        clearInterval(redirectIntervalRef.current);
        redirectIntervalRef.current = null;
      }
      toast.dismiss(id);
    };
    // Only depend on basic route/session state; countdown is handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome, status, router]);

  // When countdown reaches 0, perform the redirect (run as a separate effect to avoid setState-in-render warnings)
  useEffect(() => {
    if (!isHome) return;
    if (status !== 'authenticated') return;
    if (redirectSeconds !== 0) return;

    if (redirectToastIdRef.current) {
      toast.dismiss(redirectToastIdRef.current);
      redirectToastIdRef.current = null;
    }
    router.push('/dashboard');
  }, [redirectSeconds, isHome, status, router]);

  // Update toast content when countdown changes so the seconds display stays in sync
  useEffect(() => {
    if (redirectSeconds == null) return;
    if (!redirectToastIdRef.current) return;
    toast.custom(
      (t) => renderRedirectToast(redirectSeconds, t),
      { id: redirectToastIdRef.current }
    );
    // renderRedirectToast is stable within component scope for this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectSeconds]);

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

    // If NOT on landing page, restore immediately (cursor handled by CSS via data-landing-page)
    if (pathname !== '/') {
      body.removeAttribute('data-landing-page');
      html.removeAttribute('data-landing-page');
      body.classList.remove('preloader-active');
      return;
    }

    if (shouldShowPreloader) {
      body.removeAttribute('data-landing-page');
      html.removeAttribute('data-landing-page');
      body.classList.add('preloader-active');
      html.classList.add('preloader-active');
    } else {
      requestAnimationFrame(() => {
        if (pathname !== '/') return;

        body.style.setProperty("--cursor-color", "rgb(59, 130, 246)");
        body.style.setProperty("--blur", "3px");
        body.style.setProperty("--innerBlur", "2px");
        body.style.setProperty("--outerColor", "rgba(59, 130, 246, 0.4)");

        if (isTouchDevice === false) {
          body.setAttribute('data-landing-page', 'true');
          html.setAttribute('data-landing-page', 'true');
          setCursorReady(true);
        } else {
          body.removeAttribute('data-landing-page');
          html.removeAttribute('data-landing-page');
          setCursorReady(false);
        }

        setTimeout(() => {
          body.classList.remove('preloader-active');
          html.classList.remove('preloader-active');
        }, 1100);
      });
    }

    return () => {
      if (typeof window !== 'undefined' && document.body) {
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
      {/* Cursor wrapper: zero-size so it never covers the page — scroll and clicks pass through; cursor is positioned by the library */}
      {isHome && !isTouchDevice && cursorReady && (
        <div
          aria-hidden
          className="cursor-overlay fixed top-0 left-0 w-0 h-0 overflow-visible z-[99999]"
        >
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
              "button",
              "[role=\"button\"]",
              ".cursor-pointer",
              ".link",
              'input[type="text"]',
              'input[type="email"]',
              'input[type="number"]',
              'input[type="submit"]',
              'input[type="image"]',
              "label[for]",
              "select",
              "textarea",
            ]}
          />
        </div>
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
      {/* Same scroll pattern as dashboard: outer overflow-hidden + inner overflow-y-auto so scroll works everywhere (navbar, content, touchscreen) */}
      <div
        ref={landingPageRef}
        className={shouldShowPreloader ? 'fixed inset-0 z-[9980] overflow-hidden' : 'min-h-screen flex flex-col overflow-hidden'}
        style={{
          position: shouldShowPreloader ? 'fixed' : 'relative',
          top: shouldShowPreloader ? 0 : 'auto',
          left: shouldShowPreloader ? 0 : 'auto',
          right: shouldShowPreloader ? 0 : 'auto',
          width: '100%',
          pointerEvents: shouldShowPreloader ? 'none' : 'auto',
          opacity: shouldShowPreloader ? 0 : 1,
          visibility: shouldShowPreloader ? 'hidden' : 'visible',
        }}
      >
        <Header />
        <main
          className={`crossBg flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${shouldShowPreloader ? 'pointer-events-none' : ''}`}
          style={{
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="pt-15">
            <BlockchainBenefits />
          </div>
          <Footer />
        </main>
      </div>
    </>
  );
}
