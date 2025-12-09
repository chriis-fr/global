'use client';

import { ReactNode } from 'react';
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { PermissionProvider } from "@/lib/contexts/PermissionContext";
import CursorManager from "@/components/CursorManager";

/**
 * Client-side providers wrapper
 * This component loads all context providers client-side only
 * to prevent blocking SSR and improving TTFB
 */
export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider>
        <SubscriptionProvider>
          <PermissionProvider>
            <CursorManager />
            {children}
          </PermissionProvider>
        </SubscriptionProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}

