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
  const { status, data: session } = useSession()
  const pathname = usePathname()
  
  // Check if current route is public
  const isPublicRoute = pathname && PUBLIC_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(route)
  })
  
  // If we have a session, don't show loader even if status is loading (it's just refreshing)
  // Only show loader if we're truly loading AND don't have a session yet
  const shouldShowLoader = status === 'loading' && !isPublicRoute && !(session && typeof session === 'object' && 'user' in session)
  
  if (shouldShowLoader) {
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
    <NextAuthSessionProvider
      refetchInterval={5 * 60} // Only refetch session every 5 minutes (instead of default)
      refetchOnWindowFocus={false} // Don't refetch on window focus - use cache
    >
      <AuthWrapper>
        {children}
      </AuthWrapper>
    </NextAuthSessionProvider>
  )
} 