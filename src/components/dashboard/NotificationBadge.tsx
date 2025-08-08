'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export default function NotificationBadge() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = async () => {
    // Prevent multiple simultaneous requests
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) { // 5 second cooldown
      return;
    }
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
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    // Initial fetch on login
    fetchUnreadCount();

    // Activity-based fetching (only on user interaction)
    const handleUserActivity = () => {
      // Clear existing timeout
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      // Debounce activity - only fetch after 2 seconds of no activity
      activityTimeoutRef.current = setTimeout(() => {
        fetchUnreadCount();
      }, 2000);
    };

    // Only listen for actual user interactions
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
    };
  }, [session?.user]);

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