'use client';

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
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
    </ErrorBoundary>
  );
}

