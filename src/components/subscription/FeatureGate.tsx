'use client'

import React from 'react';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

interface FeatureGateProps {
  children: React.ReactNode;
  feature: 'createInvoice' | 'accessPayables' | 'createOrganization' | 'useAdvancedFeatures';
  fallback?: React.ReactNode;
}

export default function FeatureGate({ children, feature, fallback = null }: FeatureGateProps) {
  const { subscription } = useSubscription();

  if (!subscription) {
    return <>{fallback}</>;
  }

  let hasAccess = false;
  
  switch (feature) {
    case 'createInvoice':
      hasAccess = subscription.canCreateInvoice;
      break;
    case 'accessPayables':
      hasAccess = subscription.canAccessPayables;
      break;
    case 'createOrganization':
      hasAccess = subscription.canCreateOrganization;
      break;
    case 'useAdvancedFeatures':
      hasAccess = subscription.canUseAdvancedFeatures;
      break;
    default:
      hasAccess = false;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
