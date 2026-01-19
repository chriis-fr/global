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
    monthlyPaystackPlanCode: null, // Free plan - no Paystack plan code
    yearlyPaystackPlanCode: null, // Free plan - no Paystack plan code
    currency: 'USD',
    features: [
      { id: 'invoices', name: 'Up to 4 invoices per month', description: 'Create and send invoices', included: true, limit: 5, unit: 'invoices' },
      { id: 'clients', name: 'Limited client management', description: 'save & manage upto 3 clients ', included: true },
      { id: 'receivables-tab', name: 'Receivables dashboard', description: 'Manage your incoming payments', included: true },
      { id: 'wallet', name: '1 User', description: 'Supports Safe & Metamask', included: true },
    ],
    limits: {
      invoicesPerMonth: 4,
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
    monthlyPrice: 4.49,
    yearlyPrice: 44.99,
    monthlyPaystackPlanCode: "PLN_ipgidwru7u85a84", // Set after creating plan in Paystack dashboard
    yearlyPaystackPlanCode: "PLN_d1fjzsawkjvycz3", // Set after creating plan in Paystack dashboard
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
    ctaText: 'Start Pr',
    ctaVariant: 'primary',
  },

  // PAYABLES PLANS
  {
    planId: 'payables-basic',
    type: 'payables',
    tier: 'basic',
    name: 'Basic',
    description: 'Essential payables management',
    monthlyPrice: 49.99,
    yearlyPrice: 497.99,
    monthlyPaystackPlanCode: "PLN_6o0yqhwv598dmen", // Set after creating plan in Paystack dashboard
    yearlyPaystackPlanCode: "PLN_nupjwk0j6k4s76y", // Set after creating plan in Paystack dashboard
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
    monthlyPrice: 99.99,
    yearlyPrice: 995.99,
    monthlyPaystackPlanCode: "PLN_iajoz8dpmpa4lk7", // Set after creating plan in Paystack dashboard
    yearlyPaystackPlanCode: "PLN_rhpk1hcr46brm51", // Set after creating plan in Paystack dashboard
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
    monthlyPrice: 139.99,
    yearlyPrice: 1399.99,
    monthlyPaystackPlanCode: "PLN_fff524rpodszv4h", // Set after creating plan in Paystack dashboard
    yearlyPaystackPlanCode: "PLN_8gtksh08hugt1lk", // Set after creating plan in Paystack dashboard
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
    monthlyPrice: 199.99,
    yearlyPrice: 1990.99,
    monthlyPaystackPlanCode: "PLN_erpa6tolz7eht0k", // Set after creating plan in Paystack dashboard
    yearlyPaystackPlanCode: "PLN_cm6serxczfhh6gm", // Set after creating plan in Paystack dashboard
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
