'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Global flag to disable polling during critical operations
let isCriticalOperation = false;

export const setCriticalOperation = (critical: boolean) => {
  isCriticalOperation = critical;
};

export default function NotificationBadge() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  const lastFetchRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);

  const fetchUnreadCount = useCallback(async () => {
    // Skip if critical operation is happening
    if (isCriticalOperation) {
      return;
    }

    // Prevent multiple simultaneous requests
    const now = Date.now();
    if (now - lastFetchRef.current < 30000) { // 30 second cooldown
      return;
    }
    
    // Prevent concurrent requests
    if (isFetchingRef.current) {
      return;
    }
    
    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const response = await fetch('/api/notifications?limit=1');
      if (!response.ok) {
        if (loading) {
        }
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        const newCount = data.data.stats.unread;
        
        // Trigger animation if count increased
        if (newCount > previousCount && previousCount > 0) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 1000); // Animation duration
        }
        
        setPreviousCount(newCount);
        setUnreadCount(newCount);
      }
    } catch (error) {
      if (loading) {
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [loading, previousCount]);

  useEffect(() => {
    if (!session?.user) return;

    // Initial fetch
    fetchUnreadCount();

    // Periodic polling every 2 minutes
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current && !isCriticalOperation) {
        fetchUnreadCount();
      }
    }, 120000); // 2 minutes

    // Page visibility change handling
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current && !isCriticalOperation) {
        // Fetch immediately when page becomes visible
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user, fetchUnreadCount]);

  if (loading) {
    return null;
  }

  return (
    <>
      {/* Blue dot indicator for unread notifications */}
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1">
          {/* Blue dot */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          {/* Red badge with count */}
          <span className="relative bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </div>
      )}
      
      {/* Bell animation overlay */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
        </div>
      )}
    </>
  );
} 