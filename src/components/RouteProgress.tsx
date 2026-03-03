'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const BAR_HEIGHT = 2;
const BAR_COLOR = 'hsl(221.2 83.2% 53.3%)'; // --primary
const DURATION_GROW = 280;
const DURATION_FINISH = 180;

function isInternalNavLink(el: HTMLElement): boolean {
  const a = el.closest('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
  const href = a.getAttribute('href') ?? '';
  if (href.startsWith('#') || href === '' || href.startsWith('javascript:')) return false;
  try {
    if (href.startsWith('/')) return true;
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function getClickTarget(el: EventTarget | null): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const a = el.closest('a[href]');
  const button = el.closest('button');
  return (a ?? button ?? el) as HTMLElement;
}

export function RouteProgress() {
  const pathname = usePathname();
  const [percent, setPercent] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const loadingTarget = useRef<HTMLElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearLoadingState = useCallback(() => {
    if (loadingTarget.current) {
      loadingTarget.current.removeAttribute('data-route-loading');
      loadingTarget.current = null;
    }
  }, []);

  const startProgress = useCallback((target: HTMLElement | null) => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    clearLoadingState();
    if (target) {
      target.setAttribute('data-route-loading', '');
      loadingTarget.current = target;
    }
    setPercent(0);
    setVisible(true);
    requestAnimationFrame(() => {
      setPercent(70);
    });
  }, [clearLoadingState]);

  const finishProgress = useCallback(() => {
    setPercent(100);
    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setPercent(0);
        clearLoadingState();
      }, DURATION_FINISH)
    );
  }, [clearLoadingState]);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      finishProgress();
      prevPathname.current = pathname;
    }
  }, [pathname, finishProgress]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = getClickTarget(e.target);
      if (!target) return;
      if (target.closest('a[href]') && isInternalNavLink(target)) {
        startProgress(target);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      timers.current.forEach((t) => clearTimeout(t));
      clearLoadingState();
    };
  }, [startProgress, clearLoadingState]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed left-0 top-0 z-[99998] w-full"
      style={{
        height: BAR_HEIGHT,
        background: BAR_COLOR,
        transform: `scaleX(${percent / 100})`,
        transformOrigin: 'left',
        transition:
          percent === 0
            ? 'none'
            : percent < 100
              ? `transform ${DURATION_GROW}ms ease-out`
              : `transform ${DURATION_FINISH}ms ease-out`,
      }}
    />
  );
}
