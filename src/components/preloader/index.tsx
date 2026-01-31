'use client';

import { Wrapper, Inner, SecondOverlay } from './styles';

import React, { Dispatch, SetStateAction, useEffect, useLayoutEffect, useRef } from 'react';

import { gsap } from 'gsap';

const Preloader = ({
  setComplete,
  canComplete = true,
  landingPageRef,
}: {
  setComplete: Dispatch<SetStateAction<boolean>>;
  canComplete?: boolean;
  landingPageRef?: React.RefObject<HTMLDivElement | null>;
}) => {
  const word = ['C', 'h', 'a', 'i', 'n', 's'];

  const spans = useRef<(HTMLDivElement | null)[]>([]); // Create a ref to store the span elements

  const imageRef = useRef<HTMLImageElement>(null);

  const secondOverlayRef = useRef<HTMLDivElement>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const animationCompleteRef = useRef(false);
  const canCompleteRef = useRef(canComplete);

  // Update ref when canComplete changes
  useEffect(() => {
    canCompleteRef.current = canComplete;
    // If animation already completed but we're waiting for canComplete, check again
    if (animationCompleteRef.current && canCompleteRef.current) {
      setComplete(true);
    }
  }, [canComplete, setComplete]);

  // Set initial positions synchronously before paint to prevent flash
  useLayoutEffect(() => {
    // Ensure all elements have proper styling immediately
    if (wrapperRef.current) {
      const wrapper = wrapperRef.current;
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'flex-end';
      wrapper.style.justifyContent = 'flex-end';
      wrapper.style.background = 'linear-gradient(to bottom right, #1c398e, #172554)';
      wrapper.style.position = 'fixed';
      wrapper.style.height = '100vh';
      wrapper.style.width = '100vw';
      wrapper.style.zIndex = '9999';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.color = '#ffffff';
    }
    
    if (secondOverlayRef.current) {
      const overlay = secondOverlayRef.current;
      overlay.style.background = '#ffffff';
      overlay.style.position = 'fixed';
      overlay.style.height = '100vh';
      overlay.style.width = '100vw';
      overlay.style.zIndex = '9998';
      overlay.style.top = '0';
      overlay.style.left = '0';
    }
    
    if (imageRef.current) {
      // Hide image completely until positioned correctly
      imageRef.current.style.opacity = '0';
      imageRef.current.style.visibility = 'hidden';
      imageRef.current.style.display = 'block';
      imageRef.current.style.position = 'relative';
    }
    
    // Hide Inner container initially to prevent any flash
    const innerElement = wrapperRef.current?.querySelector('[data-inner]') as HTMLElement;
    if (innerElement) {
      innerElement.style.opacity = '0';
      innerElement.style.visibility = 'hidden';
    }
  }, []);
  

  useEffect(() => {
    const tl = gsap.timeline();

    // Set initial positions immediately to prevent flash
    // Ensure image and content start at bottom right position
    const innerElement = wrapperRef.current?.querySelector('[data-inner]') as HTMLElement;
    
    // Ensure SecondOverlay is visible from the start
    if (secondOverlayRef.current) {
      gsap.set(secondOverlayRef.current, {
        opacity: 1,
        visibility: 'visible',
        scaleY: 1,
      });
    }
    
    // Show Inner container and image only when positioned correctly
    if (innerElement) {
      gsap.set(innerElement, {
        opacity: 1,
        visibility: 'visible',
      });
    }
    
    if (imageRef.current) {
      gsap.set(imageRef.current, {
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
        visibility: 'visible',
      });
    }
    
    if (wrapperRef.current) {
      gsap.set(wrapperRef.current, {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        scaleY: 1,
      });
    }

    // Set initial position for landing page (below viewport and hidden)
    if (landingPageRef?.current) {
      gsap.set(landingPageRef.current, {
        y: '100%',
        opacity: 0,
        visibility: 'hidden',
      });
    }

    // Start animation - image is now visible and in correct position
    tl.to(imageRef.current, {
      rotate: '360deg',
      ease: 'back.out(1.7)', // Easing function
      duration: 1.4,
    });

    tl.to(imageRef.current, {
      y: '-100%', // Move the image up
      ease: 'back.out(1.7)', // Easing function
    });

    // Iterate through the span elements and animate them
    tl.to(spans.current, {
      y: '-100%', // Move the spans up
      ease: 'back.out(1.7)', // Easing function
      duration: 1.4, // Animation duration
      stagger: 0.05, // Stagger duration (0.2 seconds delay between each span)
    });

    // Animate landing page sliding up perfectly synchronized with the layers scaling up
    if (landingPageRef?.current) {
      // Make landing page visible and slide up exactly when layers start scaling
      tl.to(landingPageRef.current, {
        opacity: 1,
        visibility: 'visible',
        y: '0%',
        ease: 'power2.inOut' as const,
        duration: 1,
        onComplete: () => {
          // Reset transform after animation to allow normal scrolling
          if (landingPageRef?.current) {
            gsap.set(landingPageRef.current, { clearProps: 'transform' });
          }
        }
      }, '-=1.2'); // Start slightly before layers scale to ensure perfect sync
    }

    // Animate both the wrapper and the second overlay almost at the same time
    tl.to([wrapperRef.current, secondOverlayRef.current], {
      scaleY: 0,
      transformOrigin: 'top',
      ease: 'back.out(1.7)',
      duration: 0.7,
      stagger: 0.1,
      onComplete: () => {
        animationCompleteRef.current = true;
        if (canCompleteRef.current) {
          setComplete(true);
        } else {
          // Fallback: complete after 2.5s so user is never stuck (e.g. slow session on desktop)
          window.setTimeout(() => setComplete(true), 2500);
        }
      },
    });

    // Apply a small delay to one of the elements (adjust as needed)
    tl.to(secondOverlayRef.current, {
      scaleY: 0,
      transformOrigin: 'top',
      ease: 'power2.inOut' as const,
      duration: 0.7,
      delay: -0.7, // Adjust this delay as needed to fine-tune the timing
    });
  }, [setComplete, landingPageRef]); // Only run animation once on mount

  return (
    <>
      <SecondOverlay 
        ref={secondOverlayRef}
        style={{
          background: '#ffffff',
          position: 'fixed',
          height: '100vh',
          width: '100vw',
          zIndex: 9998,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        }}
      />
      <Wrapper 
        ref={wrapperRef}
        style={{
          background: 'linear-gradient(to bottom right, #1c398e, #172554)',
          color: 'var(--white)',
          position: 'fixed',
          height: '100vh',
          width: '100vw',
          zIndex: 9999,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        <Inner 
          data-inner
          style={{
            opacity: 0,
            visibility: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            ref={imageRef} 
            src="/svgs/ic_import.svg" 
            alt="import icon"
            style={{
              opacity: 0,
              visibility: 'hidden',
            }}
          />
          <div>
            {word.map((t, i) => (
              <div
                key={i}
                ref={(element) => {
                  spans.current[i] = element;
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </Inner>
      </Wrapper>
    </>
  );
};

export default Preloader;

