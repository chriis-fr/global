'use client';

import type { Session } from 'next-auth';
import { SessionProvider as AppSessionProvider, useSession } from '@/lib/contexts/SessionContext';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface SessionProviderProps {
  children: ReactNode;
  /** Session from server (layout). No GET /api/auth/session — server action only. */
  session?: Session | null;
}

const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/pricing',
  '/terms',
  '/privacy',
  '/use-cases',
  '/services',
  '/invoice-access',
  '/invite',
  '/invoice',
];

function AuthWrapper({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const pathname = usePathname();

  const isPublicRoute =
    pathname &&
    PUBLIC_ROUTES.some((route) => {
      if (route === '/') return pathname === '/';
      return pathname.startsWith(route);
    });

  const shouldShowLoader =
    status === 'loading' &&
    !isPublicRoute &&
    !(session && typeof session === 'object' && 'user' in session);

  if (shouldShowLoader) {
    return (
      <LoadingSpinner fullScreen={true} message="Authenticating..." />
    );
  }

  return <>{children}</>;
}

export function SessionProvider({ children, session: initialSession }: SessionProviderProps) {
  return (
    <AppSessionProvider initialSession={initialSession}>
      <AuthWrapper>{children}</AuthWrapper>
    </AppSessionProvider>
  );
}
