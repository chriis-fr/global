# Preloader Implementation Guide

## 📚 Table of Contents
1. [What is GSAP?](#what-is-gsap)
2. [Overview of What We Built](#overview)
3. [Key React Concepts Used](#react-concepts)
4. [Architecture Breakdown](#architecture)
5. [Step-by-Step Changes Explained](#changes-explained)
6. [How It All Works Together](#how-it-works)

---

## 🎨 What is GSAP?

**GSAP (GreenSock Animation Platform)** is a powerful JavaScript animation library that lets you create smooth, performant animations.

### Why GSAP Instead of CSS Animations?

1. **Performance**: GSAP uses GPU acceleration and optimizes animations better than CSS
2. **Control**: You can pause, reverse, speed up, or manipulate animations programmatically
3. **Timeline System**: Chain multiple animations together with precise timing control
4. **Browser Compatibility**: Works consistently across all browsers
5. **Easing Functions**: Advanced easing options like `back.out(1.7)` for bouncy effects

### Key GSAP Concepts We Used:

```javascript
// 1. gsap.set() - Set properties immediately (no animation)
gsap.set(element, { opacity: 1, x: 0 });

// 2. gsap.to() - Animate TO a value
gsap.to(element, { x: 100, duration: 1 });

// 3. Timeline - Chain animations together
const tl = gsap.timeline();
tl.to(element1, { x: 100 });
tl.to(element2, { y: 100 }); // Starts after element1 finishes

// 4. Stagger - Animate multiple elements with delays
tl.to(elements, { y: -100, stagger: 0.05 }); // 0.05s delay between each

// 5. Easing - How the animation feels
ease: 'back.out(1.7)'  // Bouncy effect
ease: 'power2.inOut'   // Smooth acceleration/deceleration
```

---

## 🏗️ Overview of What We Built

We created a **zero-latency preloader** that:
- ✅ Shows immediately when users visit the landing page
- ✅ Hides all other loading states (no "Authenticating..." or "Logging you in...")
- ✅ Animates smoothly with GSAP
- ✅ Synchronizes with the landing page reveal
- ✅ Prevents any flash of unstyled content (FOUC)
- ✅ Waits for session data to load in the background

---

## ⚛️ Key React Concepts Used

### 1. **useRef** - Direct DOM Access
```javascript
const imageRef = useRef<HTMLImageElement>(null);
// Later: <img ref={imageRef} />
```
**Why?** GSAP needs direct access to DOM elements. `useRef` gives us that without re-rendering.

### 2. **useState** - Component State
```javascript
const [preloaderComplete, setPreloaderComplete] = useState(false);
```
**Why?** Tracks when the preloader animation finishes so we can hide it.

### 3. **useEffect** - Side Effects
```javascript
useEffect(() => {
  // Run animation when component mounts
  const tl = gsap.timeline();
  // ... animation code
}, []); // Empty array = run once on mount
```
**Why?** Runs after the component renders. Perfect for starting animations.

### 4. **useLayoutEffect** - Synchronous DOM Updates
```javascript
useLayoutEffect(() => {
  // Set styles BEFORE browser paints
  element.style.opacity = '0';
}, []);
```
**Why?** Runs synchronously BEFORE the browser paints. Prevents visual flashes.

**Difference:**
- `useEffect`: Runs AFTER paint (can cause flash)
- `useLayoutEffect`: Runs BEFORE paint (prevents flash)

---

## 🏛️ Architecture Breakdown

### File Structure:
```
src/
├── app/
│   ├── page.tsx              # Landing page (orchestrates preloader)
│   └── layout.tsx            # Root layout (sets background)
├── components/
│   └── preloader/
│       ├── index.tsx         # Main preloader component
│       └── styles.ts         # Styled-components
└── lib/
    └── contexts/
        ├── SessionProvider.tsx      # Session management
        └── SubscriptionContext.tsx  # Subscription data
```

### Component Hierarchy:
```
RootLayout (layout.tsx)
└── SessionProvider
    └── SubscriptionProvider
        └── Landing Page (page.tsx)
            ├── Preloader (when loading)
            └── Landing Content (always rendered, hidden initially)
```

---

## 🔧 Step-by-Step Changes Explained

### Change 1: Created Preloader Component (`src/components/preloader/index.tsx`)

**What we did:**
- Created a component with GSAP animations
- Used refs to access DOM elements
- Implemented a timeline animation sequence

**Key Code:**
```javascript
const tl = gsap.timeline();

// 1. Rotate image 360°
tl.to(imageRef.current, {
  rotate: '360deg',
  duration: 1.4,
});

// 2. Move image up
tl.to(imageRef.current, {
  y: '-100%',
});

// 3. Move letters up with stagger (one after another)
tl.to(spans.current, {
  y: '-100%',
  stagger: 0.05, // 0.05s delay between each letter
});

// 4. Scale layers up (reveal landing page)
tl.to([wrapperRef.current, secondOverlayRef.current], {
  scaleY: 0,  // Scale from 1 to 0 (collapses upward)
  transformOrigin: 'top',  // Scale from top edge
  stagger: 0.1,  // Second overlay starts 0.1s after wrapper
});
```

**Why?** Creates a smooth, professional loading animation.

---

### Change 2: Integrated Preloader into Landing Page (`src/app/page.tsx`)

**What we did:**
- Added state to track preloader completion
- Passed a ref to the landing page content
- Conditionally rendered preloader based on loading state

**Key Code:**
```javascript
const { status } = useSession();
const [preloaderComplete, setPreloaderComplete] = useState(false);
const landingPageRef = useRef<HTMLDivElement>(null);

// Show preloader until BOTH animation AND session check complete
const shouldShowPreloader = !preloaderComplete || status === 'loading';
```

**Why?** Ensures preloader shows until everything is ready.

---

### Change 3: Prevented Flash of Unstyled Content (FOUC)

**Problem:** Users saw a blank white page or unstyled content before preloader appeared.

**Solution 1: useLayoutEffect in Preloader**
```javascript
useLayoutEffect(() => {
  // Set styles SYNCHRONOUSLY before browser paints
  if (wrapperRef.current) {
    wrapperRef.current.style.background = 'linear-gradient(...)';
    wrapperRef.current.style.position = 'fixed';
    wrapperRef.current.style.zIndex = '9999';
  }
}, []);
```
**Why?** Ensures preloader styles are applied before first paint.

**Solution 2: Inline Styles in Layout**
```javascript
// src/app/layout.tsx
<body style={{
  background: 'linear-gradient(to bottom right, #1c398e, #172554)',
}}>
```
**Why?** Sets background immediately, preventing white flash.

**Solution 3: Hide Elements Initially**
```javascript
// Hide image until positioned correctly
imageRef.current.style.opacity = '0';
imageRef.current.style.visibility = 'hidden';
```
**Why?** Prevents image from appearing in wrong position.

---

### Change 4: Synchronized Landing Page Reveal

**What we did:**
- Passed `landingPageRef` to preloader
- Used GSAP to animate landing page sliding up
- Synchronized with preloader layers scaling

**Key Code:**
```javascript
// In preloader component
if (landingPageRef?.current) {
  // Set initial position (below viewport, hidden)
  gsap.set(landingPageRef.current, {
    y: '100%',  // 100% below viewport
    opacity: 0,
    visibility: 'hidden',
  });

  // Animate landing page sliding up
  tl.to(landingPageRef.current, {
    opacity: 1,
    visibility: 'visible',
    y: '0%',  // Slide to normal position
    duration: 1,
  }, '-=1.2');  // Start 1.2s BEFORE previous animation ends
}
```

**Why?** Creates seamless transition - landing page appears WITH the layers, not after.

---

### Change 5: Disabled Conflicting Loaders

**Problem:** Multiple loaders appeared ("Authenticating...", "Logging you in...", preloader).

**Solution 1: SessionProvider.tsx**
```javascript
// Only show loading spinner on PROTECTED routes
const isPublicRoute = pathname === '/';
if (status === 'loading' && !isPublicRoute) {
  return <LoadingSpinner />;
}
```

**Solution 2: SubscriptionContext.tsx**
```javascript
// Don't show loader on landing page
const isLandingPage = pathname === '/';
{loading && session?.user?.id && !isLandingPage ? (
  <LoadingSpinner />
) : (
  children
)}
```

**Why?** Ensures only ONE loader shows on landing page.

---

### Change 6: Fixed Image Positioning

**Problem:** Image appeared at top-left, then jumped to correct position.

**Solution:**
```javascript
useLayoutEffect(() => {
  // Hide image until positioned
  if (imageRef.current) {
    imageRef.current.style.opacity = '0';
    imageRef.current.style.visibility = 'hidden';
  }
}, []);

// Then in useEffect (after layout):
gsap.set(imageRef.current, {
  x: 0,
  y: 0,
  opacity: 1,
  visibility: 'visible',
});
```

**Why?** Image only becomes visible when in correct position.

---

### Change 7: Background Color Matching

**Problem:** Preloader showed black background instead of blue gradient.

**Solution:**
```javascript
// Set everywhere:
// 1. Inline styles in component
background: 'linear-gradient(to bottom right, #1c398e, #172554)'

// 2. In layout.tsx body tag
style={{ background: 'linear-gradient(...)' }}

// 3. In globals.css
body {
  background: linear-gradient(...) !important;
}
```

**Why?** Ensures consistent background color everywhere.

---

### Change 8: Mobile Responsiveness

**Problem:** Mobile layout broke (image too large, text invisible).

**Solution:**
```javascript
// Removed inline styles that conflicted with media queries
// Let styled-components handle responsive design
// styles.ts has @media queries that work correctly
```

**Why?** Allows CSS media queries to work properly.

---

## 🎬 How It All Works Together

### Animation Sequence:

1. **Page Loads** → `page.tsx` renders
2. **Preloader Shows** → `shouldShowPreloader = true`
3. **Styles Applied** → `useLayoutEffect` sets styles synchronously
4. **Background Set** → Body background set to blue gradient
5. **Animation Starts** → GSAP timeline begins:
   - Image rotates 360°
   - Image moves up
   - Letters move up (staggered)
   - Landing page slides up (synchronized)
   - Layers scale up (revealing landing page)
6. **Session Checks** → `useSession()` checks authentication in background
7. **Animation Completes** → `setComplete(true)` called
8. **Preloader Hides** → `shouldShowPreloader = false`
9. **Landing Page Visible** → User sees content

### Timing Diagram:

```
Time →
0s    [Preloader appears]
      [Image rotates 360°] ────────────────┐
                                          │
1.4s  [Image moves up] ──────────────────┤
                                          │
      [Letters move up (staggered)] ──────┤
                                          │
      [Landing page slides up] ───────────┤ All synchronized
                                          │
      [Layers scale up] ──────────────────┘
      
2.4s  [Preloader hidden]
      [Landing page fully visible]
```

---

## 🎯 Key Takeaways

1. **GSAP** = Powerful animation library for smooth, controlled animations
2. **useLayoutEffect** = Prevents visual flashes by running before paint
3. **useRef** = Direct DOM access for GSAP animations
4. **Timeline** = Chains animations together with precise timing
5. **Stagger** = Creates sequential animations (letters, layers)
6. **Synchronization** = Landing page animates WITH preloader, not after
7. **FOUC Prevention** = Multiple layers of protection (inline styles, useLayoutEffect, CSS)

---

## 🔍 Debugging Tips

### If preloader flashes:
- Check `useLayoutEffect` is setting styles
- Verify inline styles in component
- Check body background in layout.tsx

### If animation is janky:
- Check GSAP timeline timing
- Verify `stagger` values
- Check `ease` functions

### If landing page appears too early:
- Check `shouldShowPreloader` logic
- Verify `setComplete` is called at right time
- Check `canComplete` prop

---

## 📖 Further Reading

- [GSAP Documentation](https://greensock.com/docs/)
- [React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)
- [React useRef](https://react.dev/reference/react/useRef)
- [Next.js App Router](https://nextjs.org/docs/app)

---

**Congratulations!** You now understand how a professional preloader works! 🎉

