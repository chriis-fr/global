'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useSession as useNextAuthSession } from 'next-auth/react'
import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { useSession } from '@/lib/auth-client'
import { verifyAndActivateSubscription } from '@/lib/actions/paystack'

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refetch } = useSubscription()
  const { update: updateNextAuth } = useNextAuthSession()
  const { update: updateOurSession } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Paystack uses 'trxref' parameter (transaction reference), Stripe uses 'session_id' (for backward compatibility)
  // Paystack redirects with trxref, not reference - check trxref first!
  useEffect(() => {
    const handleSuccess = async () => {
      // Get reference again inside useEffect to ensure we have the latest value
      const ref = searchParams?.get('trxref') || searchParams?.get('reference') || searchParams?.get('session_id')
      const cleanRef = ref && ref.trim() !== '' ? ref.trim() : null
      
      console.log('🔔 [SubscriptionSuccess] Success page loaded, reference:', cleanRef, 'raw reference:', ref)
      console.log('📋 [SubscriptionSuccess] All search params:', Object.fromEntries(searchParams?.entries?.() ?? []))
      
      try {
        if (cleanRef) {
          console.log('🔍 [SubscriptionSuccess] Verifying subscription with reference:', cleanRef)
          
          // Verify and activate subscription IMMEDIATELY (for Paystack)
          const result = await verifyAndActivateSubscription(cleanRef)
          
          console.log('📊 [SubscriptionSuccess] Verification result:', {
            success: result.success,
            error: result.error
          })
          
          if (result.success) {
            console.log('✅ [SubscriptionSuccess] Subscription activated successfully')
            
            // Short wait for DB to settle (user.services + subscriptionJustUpdatedAt are set by verifyAndActivateSubscription)
            await new Promise(resolve => setTimeout(resolve, 300))
            
            // Refresh subscription (clears cache and fetches so sidebar/dashboard show only paid-for services)
            console.log('🔄 [SubscriptionSuccess] Refetching subscription...')
            await refetch()
            
            // Trigger session refresh so next getSession gets fresh JWT (subscriptionJustUpdatedAt forces JWT callback to refresh)
            try {
              if (typeof updateNextAuth === 'function') await updateNextAuth({})
              await updateOurSession?.()
            } catch (_) {}
            
            await new Promise(resolve => setTimeout(resolve, 400))
            
            // Check for pending organization data
            let redirectPath = '/dashboard?from=subscription-success';
            if (typeof window !== 'undefined') {
              const pendingOrgData = localStorage.getItem('pending_organization_data');
              if (pendingOrgData) {
                // Redirect to organization settings to complete org creation
                redirectPath = '/dashboard/settings/organization?from=subscription-success';
              }
            }
            
            console.log('✅ [SubscriptionSuccess] Redirecting to', redirectPath)
            router.push(redirectPath)
          } else {
            console.error('❌ [SubscriptionSuccess] Verification failed:', result.error)
            console.log('⚠️ [SubscriptionSuccess] Still attempting to refresh in case webhook processed it')
            await new Promise(resolve => setTimeout(resolve, 2000))
            await refetch()
            try { await updateNextAuth?.({}); await updateOurSession?.(); } catch (_) {}
            
            // Check for pending organization data
            let redirectPath = '/dashboard';
            if (typeof window !== 'undefined') {
              const pendingOrgData = localStorage.getItem('pending_organization_data');
              if (pendingOrgData) {
                redirectPath = '/dashboard/settings/organization?from=subscription-success';
              }
            }
            router.push(redirectPath)
          }
        } else {
          // No reference found, but still try to refresh (might be webhook-activated)
          console.log('⚠️ [SubscriptionSuccess] No reference found in URL, refreshing subscription data')
          await refetch()
          try { await updateNextAuth?.({}); await updateOurSession?.(); } catch (_) {}
          
          // Check for pending organization data
          let redirectPath = '/dashboard';
          if (typeof window !== 'undefined') {
            const pendingOrgData = localStorage.getItem('pending_organization_data');
            if (pendingOrgData) {
              redirectPath = '/dashboard/settings/organization?from=subscription-success';
            }
          }
          router.push(redirectPath)
        }
      } catch (err) {
        console.error('❌ [SubscriptionSuccess] Error handling subscription success:', err)
        console.error('❌ [SubscriptionSuccess] Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        })
        try {
          console.log('🔄 [SubscriptionSuccess] Attempting recovery refetch...')
          await refetch()
          try { await updateNextAuth?.({}); await updateOurSession?.(); } catch (_) {}
          
          // Check for pending organization data
          let redirectPath = '/dashboard';
          if (typeof window !== 'undefined') {
            const pendingOrgData = localStorage.getItem('pending_organization_data');
            if (pendingOrgData) {
              redirectPath = '/dashboard/settings/organization?from=subscription-success';
            }
          }
          router.push(redirectPath)
        } catch (refetchError) {
          console.error('❌ [SubscriptionSuccess] Recovery refetch also failed:', refetchError)
          setError('Failed to process subscription. Please check your dashboard or contact support.')
        }
      } finally {
        setLoading(false)
      }
    }

    handleSuccess()
  }, [refetch, router, searchParams, updateNextAuth, updateOurSession])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Processing your subscription...</h2>
          <p className="text-gray-600 mt-2">Please wait while we set up your account.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to your new plan!
        </h1>
        <p className="text-gray-600 mb-6">
          Your subscription has been successfully activated. You now have access to all the features in your plan.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Redirecting you to your dashboard in a few seconds...
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  )
}
