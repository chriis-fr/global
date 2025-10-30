'use client'

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import { ReactNode } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface SessionProviderProps {
  children: ReactNode
}

function AuthWrapper({ children }: SessionProviderProps) {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <LoadingSpinner 
        fullScreen={true} 
        message="Authenticating..." 
      />
    )
  }

  return <>{children}</>
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      <AuthWrapper>
        {children}
      </AuthWrapper>
    </NextAuthSessionProvider>
  )
} 