'use client'

import { useSubscription } from '@/lib/contexts/SubscriptionContext'
import { useRouter } from 'next/navigation'
import { Lock, Crown, Users } from 'lucide-react'
import { ReactNode } from 'react'

interface FeatureGateProps {
  feature: 'createOrganization' | 'accessPayables' | 'createInvoice' | 'advancedFeatures'
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { checkFeatureAccess } = useSubscription()
  const router = useRouter()

  const hasAccess = checkFeatureAccess(feature)

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  const getFeatureInfo = () => {
    switch (feature) {
      case 'createOrganization':
        return {
          title: 'Organization Creation',
          description: 'Create teams and organizations to collaborate with your team members.',
          icon: <Users className="h-8 w-8" />,
          upgradeText: 'Upgrade to Pro to create organizations'
        }
      case 'accessPayables':
        return {
          title: 'Payables Management',
          description: 'Access advanced payables features including batch payments and bill management.',
          icon: <Lock className="h-8 w-8" />,
          upgradeText: 'Upgrade to Payables or Combined plan'
        }
      case 'createInvoice':
        return {
          title: 'Invoice Creation',
          description: 'Your trial has ended. Upgrade to continue creating invoices.',
          icon: <Lock className="h-8 w-8" />,
          upgradeText: 'Upgrade to continue creating invoices'
        }
      case 'advancedFeatures':
        return {
          title: 'Advanced Features',
          description: 'Access advanced features like custom tokens and approval policies.',
          icon: <Crown className="h-8 w-8" />,
          upgradeText: 'Upgrade to Pro for advanced features'
        }
    }
  }

  const featureInfo = getFeatureInfo()

  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-gray-400 mb-4 flex justify-center">
          {featureInfo.icon}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {featureInfo.title}
        </h3>
        <p className="text-gray-600 mb-6">
          {featureInfo.description}
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
        >
          <Crown className="h-4 w-4" />
          <span>{featureInfo.upgradeText}</span>
        </button>
      </div>
    </div>
  )
}
