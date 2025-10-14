import { BillingPlan } from '@/models/Billing';

export const BILLING_PLANS: BillingPlan[] = [
  // TRIAL PLAN (30-day free trial with all features)
  {
    planId: 'trial-premium',
    type: 'trial',
    tier: 'premium',
    name: '30-Day Free Trial',
    description: 'Full access to all features for 30 days',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: 'trial_premium', // Special trial plan
    yearlyPriceId: 'trial_premium', // Special trial plan
    currency: 'USD',
    features: [
      { id: 'unlimited-invoices', name: 'Unlimited invoices', description: 'Create as many invoices as you need', included: true },
      { id: 'client-management', name: 'Client management', description: 'Organize and manage your clients', included: true },
      { id: 'reconciliation', name: 'Real-time reconciliation', description: 'Automatic payment tracking', included: true },
      { id: 'organization', name: 'Organization setup', description: 'Team collaboration and branding', included: true },
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple payments at once', included: true },
      { id: 'bill-payments', name: 'Bill payments', description: 'Pay and manage your bills', included: true },
      { id: 'crypto-fees', name: 'Crypto-to-crypto fees (0.5%)', description: 'Lower transaction fees', included: true },
      { id: 'custom-token', name: 'Custom token', description: 'Add your own custom token', included: true },
      { id: 'approval-policies', name: 'Approval policies', description: 'Set up custom approval workflows', included: true },
    ],
    limits: {
      invoicesPerMonth: -1, // Unlimited
      monthlyVolume: -1, // Unlimited
      cryptoToCryptoFee: 0.5,
    },
    ctaText: 'Trial Active',
    ctaVariant: 'secondary',
  },

  // RECEIVABLES PLANS
  {
    planId: 'receivables-free',
    type: 'receivables',
    tier: 'free',
    name: 'Free',
    description: 'Perfect for contractors and freelancers',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: 'price_1SAdJ5AGa3OwCLpllBuA0tiF', // Free plan - $0
    yearlyPriceId: 'price_1SAdJ5AGa3OwCLpllBuA0tiF', // Free plan - $0
    currency: 'USD',
    features: [
      { id: 'invoices', name: 'Up to 5 invoices per month', description: 'Create and send invoices', included: true, limit: 5, unit: 'invoices' },
      { id: 'reconciliation', name: 'Real-time payment reconciliation', description: 'Automatic payment tracking', included: true },
      { id: 'receivables-tab', name: 'Receivables dashboard', description: 'Manage your incoming payments', included: true },
    ],
    limits: {
      invoicesPerMonth: 5,
    },
    ctaText: 'Get Started Free',
    ctaVariant: 'outline',
  },
  {
    planId: 'receivables-pro',
    type: 'receivables',
    tier: 'pro',
    name: 'Pro',
    description: 'Ideal for growing businesses',
    monthlyPrice: 11.99,
    yearlyPrice: 119.99,
    monthlyPriceId: 'price_1SAV6rAGa3OwCLplontxFK5u', // Monthly
    yearlyPriceId: 'price_1SAV6sAGa3OwCLplFnkyUqrm', // Yearly
    currency: 'USD',
    features: [
      { id: 'unlimited-invoices', name: 'Unlimited invoices', description: 'Create as many invoices as you need', included: true },
      { id: 'client-management', name: 'Client management', description: 'Organize and manage your clients', included: true },
      { id: 'reconciliation', name: 'Real-time reconciliation', description: 'Automatic payment tracking', included: true },
      { id: 'organization', name: 'Organization setup', description: 'Team collaboration and branding', included: true },
    ],
    limits: {
      invoicesPerMonth: -1, // Unlimited
    },
    popular: true,
    ctaText: 'Start Pro Trial',
    ctaVariant: 'primary',
  },

  // PAYABLES PLANS
  {
    planId: 'payables-basic',
    type: 'payables',
    tier: 'basic',
    name: 'Basic',
    description: 'Essential payables management',
    monthlyPrice: 170,
    yearlyPrice: 1700,
    monthlyPriceId: 'price_1SAV9LAGa3OwCLplsqx52qBE', // Monthly
    yearlyPriceId: 'price_1SAV9MAGa3OwCLplIUXMfXdp', // Yearly
    currency: 'USD',
    features: [
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple payments at once', included: true },
      { id: 'bill-payments', name: 'Bill payments', description: 'Pay and manage your bills', included: true },
      { id: 'crypto-fees', name: 'Crypto-to-crypto fees (0.9%)', description: 'Competitive transaction fees', included: true },
    ],
    limits: {
      cryptoToCryptoFee: 0.9,
    },
    ctaText: 'Choose Basic',
    ctaVariant: 'outline',
  },
  {
    planId: 'payables-pro',
    type: 'payables',
    tier: 'pro',
    name: 'Pro',
    description: 'Advanced payables with custom features',
    monthlyPrice: 270,
    yearlyPrice: 2700,
    monthlyPriceId: 'price_1SAVArAGa3OwCLplL6B9kssy', // Monthly
    yearlyPriceId: 'price_1SAVAqAGa3OwCLplNJMxJyJp', // Yearly
    currency: 'USD',
    features: [
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple payments at once', included: true },
      { id: 'bill-payments', name: 'Bill payments', description: 'Pay and manage your bills', included: true },
      { id: 'crypto-fees', name: 'Crypto-to-crypto fees (0.5%)', description: 'Lower transaction fees', included: true },
      { id: 'custom-token', name: 'Custom token', description: 'Add your own custom token', included: true },
    ],
    limits: {
      cryptoToCryptoFee: 0.5,
    },
    popular: true,
    ctaText: 'Choose Pro',
    ctaVariant: 'primary',
  },

  // COMBINED PLANS
  {
    planId: 'combined-basic',
    type: 'combined',
    tier: 'basic',
    name: 'Basic',
    description: 'Ideal for small businesses',
    monthlyPrice: 200,
    yearlyPrice: 2000,
    monthlyPriceId: 'price_1SAVMIAGa3OwCLplJQvi7jk1', // Monthly
    yearlyPriceId: 'price_1SAVMIAGa3OwCLplHGrhqv40', // Yearly
    currency: 'USD',
    features: [
      { id: 'unlimited-crypto-fiat', name: 'Unlimited crypto-to-fiat payments', description: 'Convert crypto to fiat without limits', included: true },
      { id: 'volume-limit', name: '$50,000 monthly volume', description: 'For crypto-to-crypto payments', included: true, limit: 50000, unit: 'USD' },
      { id: 'overage-fee', name: '0.7% overage fee', description: 'After monthly volume limit', included: true },
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple payments at once', included: true },
      { id: 'invoicing', name: 'Invoicing', description: 'Create and manage invoices', included: true },
      { id: 'bill-management', name: 'Bill management', description: 'Pay and track your bills', included: true },
      { id: 'payroll', name: 'Payroll and employee expenses', description: 'Manage team payments', included: true },
    ],
    limits: {
      monthlyVolume: 50000,
      overageFee: 0.7,
    },
    ctaText: 'Choose Basic',
    ctaVariant: 'outline',
  },
  {
    planId: 'combined-pro',
    type: 'combined',
    tier: 'pro',
    name: 'Pro',
    description: 'Complete business solution',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    monthlyPriceId: 'price_1SAVOJAGa3OwCLplq1QNRWcX', // Monthly
    yearlyPriceId: 'price_1SAVOJAGa3OwCLpltlUKBtbk', // Yearly
    currency: 'USD',
    features: [
      { id: 'unlimited-crypto-fiat', name: 'Unlimited crypto-to-fiat payments', description: 'Convert crypto to fiat without limits', included: true },
      { id: 'custom-volume', name: 'Custom volume for crypto-to-crypto', description: 'Tailored to your business needs', included: true },
      { id: 'overage-fee', name: '0.4% overage fee', description: 'After custom volume limit', included: true },
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple payments at once', included: true },
      { id: 'invoicing', name: 'Invoicing', description: 'Create and manage invoices', included: true },
      { id: 'bill-management', name: 'Bill management', description: 'Pay and track your bills', included: true },
      { id: 'payroll', name: 'Payroll and employee expenses', description: 'Manage team payments', included: true },
      { id: 'custom-token', name: 'Add your custom token', description: 'Integrate your own tokens', included: true },
      { id: 'approval-policies', name: 'Approval policies', description: 'Set up custom approval workflows', included: true },
    ],
    limits: {
      monthlyVolume: -1, // Custom
      overageFee: 0.4,
    },
    popular: true,
    ctaText: 'Choose Pro',
    ctaVariant: 'primary',
  },
];
