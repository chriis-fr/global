'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Session } from 'next-auth';
import { getSessionAction } from '@/lib/actions/auth';

type SessionContextValue = {
  data: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<Session | null>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  /** Session from server (layout). No client API call — session from server or getSessionAction(). */
  initialSession?: Session | null;
}) {
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [isLoading, setIsLoading] = useState(initialSession === undefined);
  const fetchedOnce = useRef(false);

  const update = useCallback(async () => {
    const next = await getSessionAction();
    setSession(next);
    setIsLoading(false);
    return next;
  }, []);

  // When no initialSession (e.g. client nav), fetch once via server action — never GET /api/auth/session
  useEffect(() => {
    if (initialSession !== undefined) {
      setIsLoading(false);
      return;
    }
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    getSessionAction().then((s) => {
      setSession(s);
      setIsLoading(false);
    });
  }, [initialSession]);

  const status: SessionContextValue['status'] =
    isLoading ? 'loading' : session ? 'authenticated' : 'unauthenticated';

  const value: SessionContextValue = {
    data: session,
    status,
    update,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (ctx === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
