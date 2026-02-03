import { UserServices } from '@/models';
import { BILLING_PLANS } from '@/data/billingPlans';

// Service definitions with their keys, metadata, and subscription requirements
export const SERVICE_DEFINITIONS = {
  // Core Invoicing & Payments
  smartInvoicing: {
    key: 'smartInvoicing',
    title: 'Smart Invoicing',
    description: 'Create and manage invoices seamlessly',
    category: 'Core Invoicing & Payments',
    icon: 'FileText',
    ready: true,
    subscriptionRequired: {
      plans: ['receivables-free', 'receivables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'free'
    }
  },

  accountsReceivable: {
    key: 'accountsReceivable',
    title: 'Accounts Receivable',
    description: 'Manage your receivables and get paid in crypto & fiat legally',
    category: 'Core Invoicing & Payments',
    icon: 'ArrowRight',
    ready: true,
    subscriptionRequired: {
      plans: ['receivables-free', 'receivables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'free'
    }
  },
  
  accountsPayable: {
    key: 'accountsPayable',
    title: 'Accounts Payable',
    description: 'Manage your business payments and vendor relationships',
    category: 'Core Invoicing & Payments',
    icon: 'Receipt',
    ready: true,
    subscriptionRequired: {
      plans: ['payables-basic', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'basic'
    }
  },

  // Business Operations
  expenses: {
    key: 'expenses',
    title: 'Expense Management',
    description: 'Easily manage your corporate expenses in crypto & fiat',
    category: 'Business Operations',
    icon: 'Receipt',
    ready: false,
    subscriptionRequired: {
      plans: ['combined-basic', 'combined-pro'] as string[],
      minTier: 'basic'
    }
  },
  
  payroll: {
    key: 'payroll',
    title: 'Payroll',
    description: 'Pay your team salaries and bonuses in crypto & fiat',
    category: 'Business Operations',
    icon: 'Users',
    ready: false,
    subscriptionRequired: {
      plans: ['combined-basic', 'combined-pro'] as string[],
      minTier: 'basic'
    }
  },

  // Blockchain Benefits
  immutableRecords: {
    key: 'immutableRecords',
    title: 'Immutable Records',
    description: 'Every transaction is permanently recorded and cannot be altered',
    category: 'Blockchain Benefits',
    icon: 'LockKeyhole',
    ready: false,
    subscriptionRequired: {
      plans: ['receivables-pro', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'pro'
    }
  },
  
  auditTrail: {
    key: 'auditTrail',
    title: 'Audit Trail',
    description: 'Complete history of all business operations and changes',
    category: 'Blockchain Benefits',
    icon: 'History',
    ready: false,
    subscriptionRequired: {
      plans: ['receivables-pro', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'pro'
    }
  },
  
  smartPayments: {
    key: 'smartPayments',
    title: 'Smart Payments',
    description: 'Automated payments and settlements using smart contracts',
    category: 'Blockchain Benefits',
    icon: 'Banknote',
    ready: false,
    subscriptionRequired: {
      plans: ['payables-pro', 'combined-pro'] as string[],
      minTier: 'pro'
    }
  },
  
  enhancedSecurity: {
    key: 'enhancedSecurity',
    title: 'Enhanced Security',
    description: 'Cryptographic security for all business transactions',
    category: 'Blockchain Benefits',
    icon: 'ShieldCheck',
    ready: false,
    subscriptionRequired: {
      plans: ['receivables-pro', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'pro'
    }
  },

  // Integrations & APIs
  accounting: {
    key: 'accounting',
    title: 'Accounting Integration',
    description: 'Import, categorize, and sync your crypto and fiat transactions with QuickBooks, Xero and more',
    category: 'Integrations & APIs',
    icon: 'Calculator',
    ready: false,
    subscriptionRequired: {
      plans: ['receivables-pro', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'pro'
    }
  },
  
  accountsPayableReceivableAPI: {
    key: 'accountsPayableReceivableAPI',
    title: 'AP/AR API',
    description: 'Build custom finance processes and let users manage payables and receivables on your platform',
    category: 'Integrations & APIs',
    icon: 'Code',
    ready: false,
    subscriptionRequired: {
      plans: ['combined-pro'] as string[],
      minTier: 'pro'
    }
  },
  
  cryptoToFiat: {
    key: 'cryptoToFiat',
    title: 'Crypto-to-Fiat',
    description: 'Pay in Crypto and your beneficiary receives Fiat',
    category: 'Integrations & APIs',
    icon: 'Coins',
    ready: false,
    subscriptionRequired: {
      plans: ['payables-basic', 'payables-pro', 'combined-basic', 'combined-pro'] as string[],
      minTier: 'basic'
    }
  },
  
  offrampAPI: {
    key: 'offrampAPI',
    title: 'Offramp API',
    description: 'Add worldwide offramp capabilities to your platform and unlock a new revenue stream for your business',
    category: 'Integrations & APIs',
    icon: 'Globe2',
    ready: false,
    subscriptionRequired: {
      plans: ['combined-pro'] as string[],
      minTier: 'pro'
    }
  }
} as const;

export type ServiceKey = keyof typeof SERVICE_DEFINITIONS;

// Create default services object with all services disabled
// Services will only be enabled after user completes onboarding and selects them
export function createDefaultServices(): UserServices {
  console.log(' [ServiceManager] Creating default services (all disabled until onboarding)...');
  return {
    // Core Invoicing & Payments - ALL disabled until onboarding
    smartInvoicing: false, // Will be enabled during onboarding if user selects it
    emailService: false, // Will be enabled during onboarding if user selects it
    accountsReceivable: false,
    accountsPayable: false, // Will be enabled during onboarding if user selects it
    
    // Business Operations
    expenses: false,
    payroll: false,
    
    // Blockchain Benefits
    immutableRecords: false,
    auditTrail: false,
    smartPayments: false,
    enhancedSecurity: false,
    
    // Integrations & APIs
    accounting: false,
    accountsPayableReceivableAPI: false,
    cryptoToFiat: false,
    offrampAPI: false
  };
}

// Service relationships: when one service is enabled/disabled, related services are also affected
// Note: emailService is not included as it's not a user-selectable service during onboarding
const SERVICE_RELATIONSHIPS: Record<ServiceKey, ServiceKey[]> = {
  smartInvoicing: ['accountsReceivable'], // Smart Invoicing automatically enables Accounts Receivable
  accountsReceivable: [], // Accounts Receivable is managed by Smart Invoicing
  accountsPayable: [],
  expenses: [],
  payroll: [],
  immutableRecords: [],
  auditTrail: [],
  smartPayments: [],
  enhancedSecurity: [],
  accounting: [],
  accountsPayableReceivableAPI: [],
  cryptoToFiat: [],
  offrampAPI: []
};

// Enable a specific service
export function enableService(services: UserServices, serviceKey: ServiceKey): UserServices {
  const updatedServices = {
    ...services,
    [serviceKey]: true
  };
  
  // Enable related services
  const relatedServices = SERVICE_RELATIONSHIPS[serviceKey] || [];
  relatedServices.forEach(relatedKey => {
    updatedServices[relatedKey] = true;
  });
  
  return updatedServices;
}

// Disable a specific service
export function disableService(services: UserServices, serviceKey: ServiceKey): UserServices {
  const updatedServices = {
    ...services,
    [serviceKey]: false
  };
  
  // Disable related services
  const relatedServices = SERVICE_RELATIONSHIPS[serviceKey] || [];
  relatedServices.forEach(relatedKey => {
    updatedServices[relatedKey] = false;
  });
  
  // If disabling Accounts Receivable, also disable Smart Invoicing (they're linked)
  if (serviceKey === 'accountsReceivable') {
    updatedServices.smartInvoicing = false;
  }
  
  return updatedServices;
}

// Toggle a service
export function toggleService(services: UserServices, serviceKey: ServiceKey): UserServices {
  return {
    ...services,
    [serviceKey]: !services[serviceKey]
  };
}

// Get enabled services
export function getEnabledServices(services: UserServices): ServiceKey[] {
  return Object.entries(services)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key as ServiceKey);
}

// Get services by category
export function getServicesByCategory(services: UserServices, category: string): ServiceKey[] {
  return Object.entries(SERVICE_DEFINITIONS)
    .filter(([, definition]) => definition.category === category)
    .map(([key]) => key as ServiceKey)
    .filter(key => services[key]);
}

// Get all available categories
export function getAvailableCategories(): string[] {
  return [...new Set(Object.values(SERVICE_DEFINITIONS).map(def => def.category))];
}

// Check if user has access to a specific service
export function hasServiceAccess(services: UserServices, serviceKey: ServiceKey): boolean {
  return services[serviceKey] || false;
}

// Get service count by category
export function getServiceCountByCategory(services: UserServices): Record<string, number> {
  const counts: Record<string, number> = {};
  
  Object.entries(SERVICE_DEFINITIONS).forEach(([key, definition]) => {
    const category = definition.category;
    if (!counts[category]) {
      counts[category] = 0;
    }
    if (services[key as ServiceKey]) {
      counts[category]++;
    }
  });
  
  return counts;
}

// NEW: Check if user's subscription allows access to a service
export function canAccessServiceWithSubscription(
  serviceKey: ServiceKey, 
  userPlanId: string | null
): { canAccess: boolean; requiredPlans: string[]; upgradeRequired?: string } {
  const service = SERVICE_DEFINITIONS[serviceKey];
  
  if (!service.subscriptionRequired) {
    return { canAccess: true, requiredPlans: [] };
  }

  if (!userPlanId) {
    return { 
      canAccess: false, 
      requiredPlans: [...service.subscriptionRequired.plans], // Convert to mutable array
      upgradeRequired: 'subscription'
    };
  }

  const canAccess = service.subscriptionRequired.plans.includes(userPlanId);
  
  if (!canAccess) {
    // Find the minimum required plan
    const requiredPlans = BILLING_PLANS.filter(plan => 
      service.subscriptionRequired.plans.includes(plan.planId)
    );
    
    // Find the cheapest required plan
    const cheapestRequired = requiredPlans.reduce((cheapest, current) => {
      return current.monthlyPrice < cheapest.monthlyPrice ? current : cheapest;
    });

    return {
      canAccess: false,
      requiredPlans: [...service.subscriptionRequired.plans], // Convert to mutable array
      upgradeRequired: cheapestRequired.planId
    };
  }

  return { canAccess: true, requiredPlans: [...service.subscriptionRequired.plans] }; // Convert to mutable array
}

// NEW: Get services that require subscription upgrade
export function getServicesRequiringUpgrade(
  services: UserServices, 
  userPlanId: string | null
): Array<{ serviceKey: ServiceKey; service: typeof SERVICE_DEFINITIONS[ServiceKey]; upgradeRequired: string }> {
  const servicesNeedingUpgrade: Array<{ serviceKey: ServiceKey; service: typeof SERVICE_DEFINITIONS[ServiceKey]; upgradeRequired: string }> = [];

  Object.entries(SERVICE_DEFINITIONS).forEach(([key, service]) => {
    const accessCheck = canAccessServiceWithSubscription(key as ServiceKey, userPlanId);
    
    if (!accessCheck.canAccess && accessCheck.upgradeRequired) {
      servicesNeedingUpgrade.push({
        serviceKey: key as ServiceKey,
        service,
        upgradeRequired: accessCheck.upgradeRequired
      });
    }
  });

  return servicesNeedingUpgrade;
}

// NEW: Get recommended subscription plan based on desired services
export function getRecommendedPlan(desiredServices: ServiceKey[]): string | null {
  if (desiredServices.length === 0) return null;

  // Check if all services are available in combined plans
  const combinedPlans = BILLING_PLANS.filter(plan => plan.type === 'combined');
  
  for (const plan of combinedPlans) {
    const canAccessAll = desiredServices.every(serviceKey => {
      const accessCheck = canAccessServiceWithSubscription(serviceKey, plan.planId);
      return accessCheck.canAccess;
    });
    
    if (canAccessAll) {
      // Return the cheapest combined plan that covers all services
      return plan.planId;
    }
  }

  // If not all services are in combined plans, find the plan that covers the most services
  let bestPlan = null;
  let maxServicesCovered = 0;

  BILLING_PLANS.forEach(plan => {
    const servicesCovered = desiredServices.filter(serviceKey => {
      const accessCheck = canAccessServiceWithSubscription(serviceKey, plan.planId);
      return accessCheck.canAccess;
    }).length;

    if (servicesCovered > maxServicesCovered) {
      maxServicesCovered = servicesCovered;
      bestPlan = plan.planId;
    }
  });

  return bestPlan;
} 