# globals.css (full file — 300 lines)

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --Background: #000000;
  --white: #ffffff;
  --cursor-color: rgb(59, 130, 246);
  --blur: 3px;
  --innerBlur: 2px;
  --outerColor: rgba(59, 130, 246, 0.4);
  --size: 40;
  --outerSize: 25;
  
  /* Design system colors for Badge and other UI components */
  --primary: hsl(221.2 83.2% 53.3%);
  --primary-foreground: hsl(210 40% 98%);
  --secondary: hsl(210 40% 96.1%);
  --secondary-foreground: hsl(222.2 47.4% 11.2%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(210 40% 98%);
  --ring: hsl(221.2 83.2% 53.3%);
}

.crossBg {
  background-image: linear-gradient(#dcdce5 0.5px, transparent 0.5px),
    linear-gradient(to right, #dcdce5 0.5px, transparent 0.5px);
  background-size: 75px 75px;
  background-color: #ffffff;
}

.bg {
  position: fixed;
  top: -50%;
  left: -50%;
  right: -50%;
  bottom: -50%;
  width: 200vw;
  height: 200vh;
  background: transparent
    url("http://assets.iceable.com/img/noise-transparent.png") repeat 0 0;
  background-repeat: repeat;
  animation: bg-animation 0.2s infinite;
  opacity: 0.9;
  visibility: visible;
  pointer-events: none;
  z-index: 0;
  /* Prevent background from causing scroll jitter */
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Ensure animated cursor is above bg layer */
[data-react-animated-cursor],
[data-react-animated-cursor] * {
  z-index: 99999 !important;
  pointer-events: none !important;
}

/* Cursor overlay: full-screen layer must never block scroll/touch (navbar works because it sits above this) */
.cursor-overlay,
.cursor-overlay * {
  pointer-events: none !important;
}

/* Hide cursor on non-landing pages */
body:not([data-landing-page="true"]) .react-animated-cursor,
html:not([data-landing-page="true"]) .react-animated-cursor {
  display: none !important;
}

@keyframes bg-animation {
  0% {
    transform: translate(0, 0);
  }
  10% {
    transform: translate(-5%, -5%);
  }
  20% {
    transform: translate(-10%, 5%);
  }
  30% {
    transform: translate(5%, -10%);
  }
  40% {
    transform: translate(-5%, 15%);
  }
  50% {
    transform: translate(-10%, 5%);
  }
  60% {
    transform: translate(15%, 0);
  }
  70% {
    transform: translate(0, 10%);
  }
  80% {
    transform: translate(-15%, 0);
  }
  90% {
    transform: translate(10%, 5%);
  }
  100% {
    transform: translate(5%, 0);
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 100%;
  /* Cursor: use attribute-based rule (data-landing-page), no inline cursor in JS */
  cursor: auto !important;
  background: var(--background);
  transition: background 0.3s ease;
}

/* Preloader background - controlled by CSS class instead of JS to prevent flicker */
body.preloader-active,
html.preloader-active {
  background: linear-gradient(to bottom right, #1c398e, #172554) !important;
}

/* Single html block: background, cursor, scroll — no inline cursor in JS */
html {
  background: var(--background);
  transition: background 0.3s ease;
  cursor: auto !important;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 100%;
}

/* Only hide cursor on landing page - override with !important */
body[data-landing-page="true"],
html[data-landing-page="true"] {
  cursor: none !important;
}

/* Ensure cursor is ALWAYS visible on all pages except landing page */
/* This is critical to override any cursor: none styles */
body:not([data-landing-page="true"]),
html:not([data-landing-page="true"]) {
  cursor: auto !important;
}

/* Buttons and interactive elements should show pointer cursor */
body:not([data-landing-page="true"]) button,
body:not([data-landing-page="true"]) a,
body:not([data-landing-page="true"]) [role="button"],
body:not([data-landing-page="true"]) input[type="button"],
body:not([data-landing-page="true"]) input[type="submit"],
body:not([data-landing-page="true"]) input[type="image"],
body:not([data-landing-page="true"]) label[for],
body:not([data-landing-page="true"]) select,
body:not([data-landing-page="true"]) .cursor-pointer,
body:not([data-landing-page="true"]) [style*="cursor: pointer"] {
  cursor: pointer !important;
}

/* Text inputs and textareas should show text cursor */
body:not([data-landing-page="true"]) input[type="text"],
body:not([data-landing-page="true"]) input[type="email"],
body:not([data-landing-page="true"]) input[type="password"],
body:not([data-landing-page="true"]) input[type="search"],
body:not([data-landing-page="true"]) input[type="url"],
body:not([data-landing-page="true"]) input[type="tel"],
body:not([data-landing-page="true"]) textarea,
body:not([data-landing-page="true"]) [contenteditable="true"] {
  cursor: text !important;
}

/* All other elements get default cursor */
body:not([data-landing-page="true"]) * {
  cursor: inherit;
}

/* Removed: hiding root until data-preloader-ready - that attribute was never set. */

* {
  box-sizing: border-box;
}

/* Mobile touch optimizations - only on actual controls so two-finger scroll works on trackpad */
button, a, [role="button"], input[type="button"], input[type="submit"], input[type="image"] {
  touch-action: manipulation !important;
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  /* Prevent text selection on mobile taps */
  user-select: none;
  -webkit-user-select: none;
  /* Removed will-change to prevent scroll jitter - only use when actually animating */
}

/* Removed broad [onclick]/[onClick] touch-action - it was blocking two-finger scroll on desktop trackpad */

/* Optimize images for LCP - critical for performance */
/* Removed content-visibility: auto as it can cause layout recalculations during scroll on mobile */

/* Optimize hero sections for faster LCP */
/* Removed content-visibility to prevent scroll jitter on mobile */

/* Reduce layout shifts - removed contain to prevent scroll jitter on mobile */
/* h1, h2, h3 {
  contain: layout style;
} */

/* Removed will-change: contents as it can cause performance issues during scroll */

/* Prevent layout shifts on button clicks */
button:active {
  transform: scale(0.98);
  transition: transform 0.1s ease-out;
}

/* Improve scrolling performance on mobile — do not set touch-action/overflow on body/html here (breaks native scroll) */
body, html {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Prevent scroll jitter on mobile - REMOVED aggressive GPU acceleration
   that was causing layer thrashing. Only apply GPU acceleration to specific
   elements that actually need it, not all sections/absolute elements */

/* Ensure mobile uses native touch cursor - extra safety */
@media (pointer: coarse) {
  body, html {
    cursor: auto !important; /* ensure mobile uses native touch cursor */
  }
  
  /* Hide animated cursor on touch devices */
  .react-animated-cursor {
    display: none !important;
  }
}

font-face {
  font-family: Neue;
  src: url("../../public/fonts/neue-montreal-free-demo-pangram-pangram-030418/NeueMontreal-Regular.otf");
}

/* Custom reverse spin animation for reload icon */
@keyframes spin-reverse {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

.animate-spin-reverse {
  animation: spin-reverse 1s linear infinite;
}

/* Floating Action Button animations */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hide scrollbar for mobile horizontal scroll cards */
.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
```
