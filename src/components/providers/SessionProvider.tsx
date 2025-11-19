'use client'

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface SessionProviderProps {
  children: ReactNode
}

// Public routes that don't require auth and should render immediately
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
  '/invoice' // Public invoice viewing routes
]

function AuthWrapper({ children }: SessionProviderProps) {
  const { status } = useSession()
  const pathname = usePathname()
  
  // Check if current route is public
  const isPublicRoute = pathname && PUBLIC_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(route)
  })
  
  // Only show loading state on protected routes (dashboard, profile, etc.)
  // For public routes (especially landing page '/'), render immediately - no loading spinner
  // The landing page handles its own preloader
  if (status === 'loading' && !isPublicRoute) {
    return (
      <LoadingSpinner 
        fullScreen={true} 
        message="Authenticating..." 
      />
    )
  }

  // Always render children - auth will be handled by individual route guards
  // For landing page, this allows the preloader to show immediately
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