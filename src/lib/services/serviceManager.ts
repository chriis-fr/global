import { UserServices } from '@/models';

// Service definitions with their keys and metadata
export const SERVICE_DEFINITIONS = {
  // Core Invoicing & Payments
  smartInvoicing: {
    key: 'smartInvoicing',
    title: 'Smart Invoicing',
    description: 'Create, manage, and get paid with both fiat and blockchain payments seamlessly',
    category: 'Core Invoicing & Payments',
    icon: 'FileText',
    ready: true // Ready for production
  },

  accountsReceivable: {
    key: 'accountsReceivable',
    title: 'Accounts Receivable',
    description: 'Manage your receivables and get paid in crypto & fiat legally',
    category: 'Core Invoicing & Payments',
    icon: 'ArrowRight',
    ready: false // Coming soon
  },
  accountsPayable: {
    key: 'accountsPayable',
    title: 'Accounts Payable',
    description: 'Manage your business payments and vendor relationships',
    category: 'Core Invoicing & Payments',
    icon: 'ArrowLeft',
    ready: false // Coming soon
  },

  // Business Operations
  expenses: {
    key: 'expenses',
    title: 'Expense Management',
    description: 'Easily manage your corporate expenses in crypto & fiat',
    category: 'Business Operations',
    icon: 'Receipt',
    ready: false // Coming soon
  },
  payroll: {
    key: 'payroll',
    title: 'Payroll',
    description: 'Pay your team salaries and bonuses in crypto & fiat',
    category: 'Business Operations',
    icon: 'Users',
    ready: false // Coming soon
  },

  // Blockchain Benefits
  immutableRecords: {
    key: 'immutableRecords',
    title: 'Immutable Records',
    description: 'Every transaction is permanently recorded and cannot be altered',
    category: 'Blockchain Benefits',
    icon: 'LockKeyhole',
    ready: false // Coming soon
  },
  auditTrail: {
    key: 'auditTrail',
    title: 'Audit Trail',
    description: 'Complete history of all business operations and changes',
    category: 'Blockchain Benefits',
    icon: 'History',
    ready: false // Coming soon
  },
  smartPayments: {
    key: 'smartPayments',
    title: 'Smart Payments',
    description: 'Automated payments and settlements using smart contracts',
    category: 'Blockchain Benefits',
    icon: 'Banknote',
    ready: false // Coming soon
  },
  enhancedSecurity: {
    key: 'enhancedSecurity',
    title: 'Enhanced Security',
    description: 'Cryptographic security for all business transactions',
    category: 'Blockchain Benefits',
    icon: 'ShieldCheck',
    ready: false // Coming soon
  },

  // Integrations & APIs
  accounting: {
    key: 'accounting',
    title: 'Accounting Integration',
    description: 'Import, categorize, and sync your crypto and fiat transactions with QuickBooks, Xero and more',
    category: 'Integrations & APIs',
    icon: 'Calculator',
    ready: false // Coming soon
  },
  accountsPayableReceivableAPI: {
    key: 'accountsPayableReceivableAPI',
    title: 'AP/AR API',
    description: 'Build custom finance processes and let users manage payables and receivables on your platform',
    category: 'Integrations & APIs',
    icon: 'Code',
    ready: false // Coming soon
  },
  cryptoToFiat: {
    key: 'cryptoToFiat',
    title: 'Crypto-to-Fiat',
    description: 'Pay in Crypto and your beneficiary receives Fiat',
    category: 'Integrations & APIs',
    icon: 'Coins',
    ready: false // Coming soon
  },
  offrampAPI: {
    key: 'offrampAPI',
    title: 'Offramp API',
    description: 'Add worldwide offramp capabilities to your platform and unlock a new revenue stream for your business',
    category: 'Integrations & APIs',
    icon: 'Globe2',
    ready: false // Coming soon
  }
} as const;

export type ServiceKey = keyof typeof SERVICE_DEFINITIONS;

// Create default services object with all services disabled
export function createDefaultServices(): UserServices {
  console.log('🔧 [ServiceManager] Creating default services...');
  return {
    // Core Invoicing & Payments
    smartInvoicing: true, // Enable by default so users can see it in sidebar
    emailService: true, // Enable by default for email notifications
    accountsReceivable: false,
    accountsPayable: false,
    
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