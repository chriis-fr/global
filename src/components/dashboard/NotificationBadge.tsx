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
  const lastFetchRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);

  const fetchUnreadCount = useCallback(async () => {
    // DISABLED: Notification fetching to improve app performance
    // TODO: Re-enable when notification system is fully implemented
    setLoading(false);
    setUnreadCount(0); // Set to 0 for now
    return;
    
    // Skip if critical operation is happening
    if (isCriticalOperation) {
      return;
    }

    // Prevent multiple simultaneous requests
    const now = Date.now();
    if (now - lastFetchRef.current < 60000) { // 60 second cooldown (increased from 30)
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
          console.error('Error fetching notification count:', response.status);
        }
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setUnreadCount(data.data.stats.unread);
      }
    } catch (error) {
      if (loading) {
        console.error('Error fetching notification count:', error);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    if (!session?.user) return;

    // DISABLED: Initial fetch and polling to improve app performance
    // TODO: Re-enable when notification system is fully implemented
    fetchUnreadCount(); // This will set loading to false and unreadCount to 0

    // DISABLED: Periodic polling
    // intervalRef.current = setInterval(() => {
    //   if (isVisibleRef.current && !isCriticalOperation) {
    //     fetchUnreadCount();
    //   }
    // }, 300000); // 5 minutes

    // DISABLED: Page visibility change handling
    // const handleVisibilityChange = () => {
    //   isVisibleRef.current = !document.hidden;
    //   if (isVisibleRef.current && !isCriticalOperation) {
    //     // Fetch immediately when page becomes visible
    //     fetchUnreadCount();
    //   }
    // };

    // document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user, fetchUnreadCount]);

  if (loading) {
    return null;
  }

  return (
    <>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </>
  );
} 