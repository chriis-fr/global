import { UserServices } from '@/models';

// Service definitions with their keys and metadata
export const SERVICE_DEFINITIONS = {
  // Core Blockchain Benefits
  smartInvoicing: {
    key: 'smartInvoicing',
    title: 'Smart Invoicing',
    description: 'Create, manage, and get paid with blockchain-powered smart invoices',
    category: 'Core Blockchain Benefits',
    icon: 'FileText',
    ready: true // Ready for production
  },
  immutableRecords: {
    key: 'immutableRecords',
    title: 'Immutable Records',
    description: 'Every transaction is permanently recorded and cannot be altered',
    category: 'Core Blockchain Benefits',
    icon: 'LockKeyhole',
    ready: false // Coming soon
  },
  auditTrail: {
    key: 'auditTrail',
    title: 'Audit Trail',
    description: 'Complete history of all business operations and changes',
    category: 'Core Blockchain Benefits',
    icon: 'History',
    ready: false // Coming soon
  },
  smartPayments: {
    key: 'smartPayments',
    title: 'Smart Payments',
    description: 'Automated payments and settlements using smart contracts',
    category: 'Core Blockchain Benefits',
    icon: 'Banknote',
    ready: false // Coming soon
  },
  decentralized: {
    key: 'decentralized',
    title: 'Decentralized',
    description: 'No single point of failure in data storage and processing',
    category: 'Core Blockchain Benefits',
    icon: 'Network',
    ready: false // Coming soon
  },
  enhancedSecurity: {
    key: 'enhancedSecurity',
    title: 'Enhanced Security',
    description: 'Cryptographic security for all business transactions',
    category: 'Core Blockchain Benefits',
    icon: 'ShieldCheck',
    ready: false // Coming soon
  },
  identityManagement: {
    key: 'identityManagement',
    title: 'Identity Management',
    description: 'Secure and verifiable digital identities for all users',
    category: 'Core Blockchain Benefits',
    icon: 'Fingerprint',
    ready: false // Coming soon
  },

  // Business Solutions - Companies
  accountsPayable: {
    key: 'accountsPayable',
    title: 'Accounts Payable',
    description: 'Manage your business payments',
    category: 'Business Solutions - Companies',
    icon: 'ArrowLeft',
    ready: false // Coming soon
  },
  accountsReceivable: {
    key: 'accountsReceivable',
    title: 'Accounts Receivable',
    description: 'Create invoices & get paid in crypto & fiat legally',
    category: 'Business Solutions - Companies',
    icon: 'ArrowRight',
    ready: true // Ready for production
  },
  expenses: {
    key: 'expenses',
    title: 'Expenses',
    description: 'Easily manage your corporate expenses in crypto & fiat',
    category: 'Business Solutions - Companies',
    icon: 'Receipt',
    ready: false // Coming soon
  },
  payroll: {
    key: 'payroll',
    title: 'Payroll',
    description: 'Pay your team salaries and bonuses in crypto & fiat',
    category: 'Business Solutions - Companies',
    icon: 'Users',
    ready: false // Coming soon
  },

  // Business Solutions - Freelancers
  freelancerExpenses: {
    key: 'freelancerExpenses',
    title: 'Expenses',
    description: 'Get reimbursed for your corporate expenses',
    category: 'Business Solutions - Freelancers',
    icon: 'Receipt',
    ready: false // Coming soon
  },
  freelancerInvoicing: {
    key: 'freelancerInvoicing',
    title: 'Invoicing',
    description: 'The easiest way for freelancers and contractors to get paid in crypto & fiat',
    category: 'Business Solutions - Freelancers',
    icon: 'FileText',
    ready: true // Ready for production
  },

  // Integrations and API Solutions
  accounting: {
    key: 'accounting',
    title: 'Accounting',
    description: 'Import, categorize, and sync your crypto and fiat transactions with QuickBooks, Xero and more',
    category: 'Integrations and API Solutions',
    icon: 'Calculator',
    ready: false // Coming soon
  },
  accountsPayableReceivableAPI: {
    key: 'accountsPayableReceivableAPI',
    title: 'Accounts Payable & Receivable API',
    description: 'Build custom finance processes and let users manage payables and receivables on your platform',
    category: 'Integrations and API Solutions',
    icon: 'Code',
    ready: false // Coming soon
  },
  cryptoToFiat: {
    key: 'cryptoToFiat',
    title: 'Crypto-to-Fiat',
    description: 'Pay in Crypto and your beneficiary receives Fiat',
    category: 'Integrations and API Solutions',
    icon: 'Coins',
    ready: false // Coming soon
  },
  offrampAPI: {
    key: 'offrampAPI',
    title: 'Offramp API',
    description: 'Add worldwide offramp capabilities to your platform and unlock a new revenue stream for your business',
    category: 'Integrations and API Solutions',
    icon: 'Globe2',
    ready: false // Coming soon
  }
} as const;

export type ServiceKey = keyof typeof SERVICE_DEFINITIONS;

// Create default services object with all services disabled
export function createDefaultServices(): UserServices {
  console.log('🔧 [ServiceManager] Creating default services...');
  return {
    // Core Blockchain Benefits
    smartInvoicing: false,
    immutableRecords: false,
    auditTrail: false,
    smartPayments: false,
    decentralized: false,
    enhancedSecurity: false,
    identityManagement: false,
    
    // Business Solutions - Companies
    accountsPayable: false,
    accountsReceivable: false,
    expenses: false,
    payroll: false,
    
    // Business Solutions - Freelancers
    freelancerExpenses: false,
    freelancerInvoicing: false,
    
    // Integrations and API Solutions
    accounting: false,
    accountsPayableReceivableAPI: false,
    cryptoToFiat: false,
    offrampAPI: false
  };
}

// Enable a specific service
export function enableService(services: UserServices, serviceKey: ServiceKey): UserServices {
  return {
    ...services,
    [serviceKey]: true
  };
}

// Disable a specific service
export function disableService(services: UserServices, serviceKey: ServiceKey): UserServices {
  return {
    ...services,
    [serviceKey]: false
  };
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