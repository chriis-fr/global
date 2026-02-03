'use client';

import type { Session } from 'next-auth';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { PermissionProvider } from "@/lib/contexts/PermissionContext";
import { PayablesProvider } from "@/lib/contexts/PayablesContext";
import CursorManager from "@/components/CursorManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { SubscriptionData } from '@/lib/actions/subscription';
import type { PreferredCurrencyResult } from '@/lib/actions/currency';

export type InitialData = {
  initialSession?: Session | null;
  initialSubscription?: SubscriptionData | null;
  initialCurrency?: PreferredCurrencyResult | null;
};

/**
 * Client-side providers wrapper with optional preloaded data from server.
 * When initialSession/subscription/currency are passed, first paint has data
 * and we avoid client-side API waterfalls (session → subscription → currency).
 */
export function ProvidersWrapper({
  children,
  initialSession,
  initialSubscription,
  initialCurrency,
}: { children: ReactNode } & InitialData) {
  return (
    <ErrorBoundary>
      <NextAuthSessionProvider refetchInterval={0} session={initialSession === undefined ? undefined : initialSession ?? null}>
      <SessionProvider session={initialSession === undefined ? undefined : initialSession}>
        <ErrorBoundary>
          <CurrencyProvider initialCurrency={initialCurrency ?? undefined}>
            <ErrorBoundary>
              <SubscriptionProvider initialSubscription={initialSubscription ?? undefined}>
                <ErrorBoundary>
                  <PermissionProvider>
                    <ErrorBoundary>
                      <PayablesProvider>
                        <ErrorBoundary>
                          <CursorManager />
                        </ErrorBoundary>
                        {children}
                        <Toaster 
                          position="top-right"
                          toastOptions={{
                            duration: 4000,
                            style: {
                              background: '#363636',
                              color: '#fff',
                            },
                            success: {
                              duration: 3000,
                              iconTheme: {
                                primary: '#10b981',
                                secondary: '#fff',
                              },
                            },
                            error: {
                              duration: 4000,
                              iconTheme: {
                                primary: '#ef4444',
                                secondary: '#fff',
                              },
                            },
                          }}
                        />
                      </PayablesProvider>
                    </ErrorBoundary>
                  </PermissionProvider>
                </ErrorBoundary>
              </SubscriptionProvider>
            </ErrorBoundary>
          </CurrencyProvider>
        </ErrorBoundary>
      </SessionProvider>
      </NextAuthSessionProvider>
    </ErrorBoundary>
  );
}

