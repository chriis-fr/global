'use client';

import { ReactNode } from 'react';
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { PermissionProvider } from "@/lib/contexts/PermissionContext";
import { PayablesProvider } from "@/lib/contexts/PayablesContext";
import CursorManager from "@/components/CursorManager";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Client-side providers wrapper
 * This component loads all context providers client-side only
 * to prevent blocking SSR and improving TTFB
 */
export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <ErrorBoundary>
          <CurrencyProvider>
            <ErrorBoundary>
              <SubscriptionProvider>
                <ErrorBoundary>
                  <PermissionProvider>
                    <ErrorBoundary>
                      <PayablesProvider>
                        <ErrorBoundary>
                          <CursorManager />
                        </ErrorBoundary>
                        {children}
                      </PayablesProvider>
                    </ErrorBoundary>
                  </PermissionProvider>
                </ErrorBoundary>
              </SubscriptionProvider>
            </ErrorBoundary>
          </CurrencyProvider>
        </ErrorBoundary>
      </SessionProvider>
    </ErrorBoundary>
  );
}

