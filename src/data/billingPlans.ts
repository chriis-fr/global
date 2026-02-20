import { BillingPlan } from '@/models/Billing';

export const BILLING_PLANS: BillingPlan[] = [
  // TRIAL PLAN (15-day free trial with all features; then free plan: 5 invoices, low volume)
  {
    planId: 'trial-premium',
    type: 'trial',
    tier: 'premium',
    name: '15-Day Free Trial',
    description: 'Full access to all features for 15 days',
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
      invoicesPerMonth: -1,
      monthlyVolume: -1,
      cryptoToCryptoFee: 0.5,
    },
    ctaText: 'Trial Active',
    ctaVariant: 'secondary',
  },

  // ─── RECEIVABLES ─────────────────────────────────────────────────────────
  // Starter (Free) – Individual only (contractors, freelancers)
  {
    planId: 'receivables-free',
    type: 'receivables',
    tier: 'starter',
    name: 'Starter',
    description: 'Perfect for contractors and freelancers',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPaystackPlanCode: null,
    yearlyPaystackPlanCode: null,
    currency: 'USD',
    audience: 'individual',
    features: [
      { id: 'invoices', name: '5 invoices per month', description: 'Create and send invoices', included: true, limit: 5, unit: 'invoices' },
      { id: 'clients', name: 'Limited client management', description: 'Save & manage up to 3 clients', included: true },
      { id: 'receivables-tab', name: 'Receivables dashboard', description: 'Manage your incoming payments', included: true },
      { id: 'wallet', name: '1 seat', description: 'Supports Safe & Metamask', included: true },
    ],
    limits: {
      invoicesPerMonth: 5,
      monthlyVolume: 2000,
    },
    ctaText: 'Get Started Free',
    ctaVariant: 'outline',
  },
  // Growth for Individual – 1 seat only, 50 invoices, no API (fixed $5.99)
  {
    planId: 'receivables-growth-individual',
    type: 'receivables',
    tier: 'growth',
    name: 'Growth',
    description: ' Full features for your individual account.',
    monthlyPrice: 5.99,
    yearlyPrice: 59.88,
    currency: 'USD',
    audience: 'individual',
    dynamicPricing: {
      basePrice: 5.99,
      seatPrice: 0,
      includedSeats: 1, // 1 seat only, no extra seats
      invoiceLimit: 50,
      invoiceOveragePrice: 10,
      invoiceOverageBlock: 100,
      volumeThreshold: 25000,
      volumeFee: 0.005,
    },
    features: [
      { id: 'seats', name: '1 seat', description: 'Individual account', included: true },
      { id: 'invoices', name: '50 invoices per month', description: 'Extra: $10 per 100 invoices', included: true, limit: 50, unit: 'invoices' },
      { id: 'volume', name: '$25,000 volume included', description: '0.5% over volume', included: true },
      { id: 'reconciliation', name: 'Real-time reconciliation', description: 'Automatic payment tracking', included: true },
    ],
    limits: {
      invoicesPerMonth: 50,
      monthlyVolume: 25000,
      overageFee: 0.5,
    },
    popular: true,
    ctaText: 'Start Growth',
    ctaVariant: 'primary',
  },
  // Growth – $5.99 per seat from 1 seat (for Business / teams)
  {
    planId: 'receivables-pro',
    type: 'receivables',
    tier: 'growth',
    name: 'Growth',
    description: 'Solo invoicer or small team. Full features from day one.',
    monthlyPrice: 5.99,
    yearlyPrice: 59.88,
    currency: 'USD',
    audience: 'business',
    dynamicPricing: {
      basePrice: 0,
      seatPrice: 5.99,
      includedSeats: 0, // every seat charged at seatPrice; 1 seat = $5.99
      invoiceLimit: 100,
      invoiceOveragePrice: 10,
      invoiceOverageBlock: 100,
      volumeThreshold: 25000,
      volumeFee: 0.005, // 0.5%
    },
    features: [
      { id: 'seats', name: 'From 1 seat at $5.99', description: 'Add more seats at $5.99 each', included: true },
      { id: 'invoices', name: '100 invoices per month', description: 'Extra: $10 per 100 invoices', included: true, limit: 100, unit: 'invoices' },
      { id: 'volume', name: '$25,000 volume included', description: '0.5% over volume', included: true },
      { id: 'reconciliation', name: 'Real-time reconciliation', description: 'Automatic payment tracking', included: true },
      { id: 'api', name: 'API access', description: 'Integrate with your tools', included: true },
    ],
    limits: {
      invoicesPerMonth: 100,
      monthlyVolume: 25000,
      overageFee: 0.5,
    },
    ctaText: 'Start Growth',
    ctaVariant: 'primary',
  },
  // Scale – $12 per seat (5 seats included) – Business only
  {
    planId: 'receivables-scale',
    type: 'receivables',
    tier: 'scale',
    name: 'Scale',
    description: 'For scaling businesses',
    monthlyPrice: 60, // 5 * 12
    yearlyPrice: 600,
    currency: 'USD',
    audience: 'business',
    dynamicPricing: {
      basePrice: 60,
      seatPrice: 12,
      includedSeats: 5,
      invoiceLimit: -1,
      volumeThreshold: 100000,
      volumeFee: 0.004, // 0.4%
    },
    features: [
      { id: 'seats', name: '5 seats included', description: 'Add more at $12/seat', included: true },
      { id: 'unlimited-invoices', name: 'Unlimited invoices', description: 'No invoice cap', included: true },
      { id: 'volume', name: '$100k volume included', description: '0.4% over threshold', included: true },
      { id: 'approval', name: 'Approval workflows', description: 'Multi-step approvals', included: true },
      { id: 'multi-entity', name: 'Multi-entity support', description: 'Multiple entities', included: true },
    ],
    limits: {
      invoicesPerMonth: -1,
      monthlyVolume: 100000,
      overageFee: 0.4,
    },
    ctaText: 'Start Scale',
    ctaVariant: 'outline',
  },
  // Enterprise – Business only
  {
    planId: 'receivables-enterprise',
    type: 'receivables',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom seats, volume, and support',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    isEnterprise: true,
    audience: 'business',
    monthlyPaystackPlanCode: null,
    yearlyPaystackPlanCode: null,
    features: [
      { id: 'custom-seats', name: 'Custom seats', description: 'Tailored to your team', included: true },
      { id: 'custom-volume', name: 'Custom volume', description: 'Flexible limits', included: true },
      { id: 'sla', name: 'SLA', description: 'Guaranteed uptime', included: true },
      { id: 'dedicated-support', name: 'Dedicated support', description: 'Priority assistance', included: true },
      { id: 'custom-token', name: 'Custom token & blockchain', description: 'Custom infrastructure', included: true },
    ],
    limits: {
      invoicesPerMonth: -1,
      monthlyVolume: -1,
    },
    ctaText: 'Contact Sales',
    ctaVariant: 'outline',
  },

  // ─── PAYABLES (Business / Teams only) ───────────────────────────────────
  // Payables Team – $9 per seat (3 included)
  {
    planId: 'payables-basic',
    audience: 'business',
    type: 'payables',
    tier: 'growth',
    name: 'Payables Team',
    description: 'Batch payments and bill management',
    monthlyPrice: 27, // 3 * 9
    yearlyPrice: 270,
    currency: 'USD',
    dynamicPricing: {
      basePrice: 27,
      seatPrice: 9,
      includedSeats: 3,
      invoiceLimit: 0,
      volumeThreshold: 50000,
      volumeFee: 0.007, // 0.7%
    },
    features: [
      { id: 'seats', name: '3 seats included', description: 'Add more at $9/seat', included: true },
      { id: 'batch-payments', name: 'Batch payments', description: 'Process multiple at once', included: true },
      { id: 'bill-management', name: 'Bill management', description: 'Pay and track bills', included: true },
      { id: 'volume', name: '$50k monthly volume', description: '0.7% fee', included: true },
    ],
    limits: {
      monthlyVolume: 50000,
      overageFee: 0.7,
    },
    ctaText: 'Choose Payables Team',
    ctaVariant: 'outline',
  },
  // Scale – $19 per seat (5 included)
  {
    planId: 'payables-pro',
    audience: 'business',
    type: 'payables',
    tier: 'scale',
    name: 'Scale',
    description: 'Lower fees and payroll',
    monthlyPrice: 95, // 5 * 19
    yearlyPrice: 950,
    currency: 'USD',
    dynamicPricing: {
      basePrice: 95,
      seatPrice: 19,
      includedSeats: 5,
      invoiceLimit: 0,
      volumeThreshold: 150000,
      volumeFee: 0.005, // 0.5%
    },
    features: [
      { id: 'seats', name: '5 seats included', description: 'Add more at $19/seat', included: true },
      { id: 'lower-fees', name: '0.5% fee', description: 'Lower transaction fees', included: true },
      { id: 'payroll', name: 'Payroll', description: 'Team payments', included: true },
    ],
    limits: {
      monthlyVolume: 150000,
      overageFee: 0.5,
    },
    popular: true,
    ctaText: 'Choose Scale',
    ctaVariant: 'primary',
  },
  // Enterprise
  {
    planId: 'payables-enterprise',
    audience: 'business',
    type: 'payables',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom rate and support',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    isEnterprise: true,
    monthlyPaystackPlanCode: null,
    yearlyPaystackPlanCode: null,
    features: [
      { id: 'custom-rate', name: 'Custom rate', description: 'Tailored pricing', included: true },
      { id: 'dedicated-support', name: 'Dedicated support', description: 'Priority assistance', included: true },
    ],
    limits: {
      monthlyVolume: -1,
    },
    ctaText: 'Contact Sales',
    ctaVariant: 'outline',
  },

  // ─── COMBINED (Business / Teams only) ──────────────────────────────────
  // Combined Growth – $15 per seat (3 included)
  {
    planId: 'combined-basic',
    audience: 'business',
    type: 'combined',
    tier: 'growth',
    name: 'Combined Growth',
    description: 'Receivables + Payables in one',
    monthlyPrice: 45, // 3 * 15
    yearlyPrice: 450,
    currency: 'USD',
    dynamicPricing: {
      basePrice: 45,
      seatPrice: 15,
      includedSeats: 3,
      invoiceLimit: 200,
      volumeThreshold: 75000,
      volumeFee: 0.006, // 0.6%
    },
    features: [
      { id: 'seats', name: '3 seats included', description: 'Add more at $15/seat', included: true },
      { id: 'receivables-payables', name: 'Receivables + Payables', description: 'Full suite', included: true },
      { id: 'integrations', name: 'ClickUp & integrations', description: 'Connect your team tools', included: true },
      { id: 'invoices', name: '200 invoices/month', description: 'Included', included: true, limit: 200, unit: 'invoices' },
      { id: 'volume', name: '$75k volume', description: '0.6% overage', included: true },
    ],
    limits: {
      invoicesPerMonth: 200,
      monthlyVolume: 75000,
      overageFee: 0.6,
    },
    ctaText: 'Start Combined Growth',
    ctaVariant: 'outline',
  },
  // Combined Scale – $25 per seat (5 included)
  {
    planId: 'combined-pro',
    audience: 'business',
    type: 'combined',
    tier: 'scale',
    name: 'Combined Scale',
    description: 'Unlimited invoices, higher volume',
    monthlyPrice: 125, // 5 * 25
    yearlyPrice: 1250,
    currency: 'USD',
    dynamicPricing: {
      basePrice: 125,
      seatPrice: 25,
      includedSeats: 5,
      invoiceLimit: -1,
      volumeThreshold: 250000,
      volumeFee: 0.004, // 0.4%
    },
    features: [
      { id: 'seats', name: '5 seats included', description: 'Add more at $25/seat', included: true },
      { id: 'unlimited-invoices', name: 'Unlimited invoices', description: 'No cap', included: true },
      { id: 'integrations', name: 'ClickUp & integrations', description: 'Connect your team tools', included: true },
      { id: 'volume', name: '$250k volume', description: '0.4% overage', included: true },
    ],
    limits: {
      invoicesPerMonth: -1,
      monthlyVolume: 250000,
      overageFee: 0.4,
    },
    popular: true,
    ctaText: 'Start Combined Scale',
    ctaVariant: 'primary',
  },
  // Combined Enterprise
  {
    planId: 'combined-enterprise',
    audience: 'business',
    type: 'combined',
    tier: 'enterprise',
    name: 'Combined Enterprise',
    description: 'Custom seats, volume, and fees',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    isEnterprise: true,
    monthlyPaystackPlanCode: null,
    yearlyPaystackPlanCode: null,
    features: [
      { id: 'custom-seats', name: 'Custom seat pricing', description: 'Tailored to your size', included: true },
      { id: 'custom-volume', name: 'Custom volume', description: 'Flexible limits', included: true },
      { id: 'custom-fees', name: 'Custom fees', description: 'Volume discounts', included: true },
    ],
    limits: {
      invoicesPerMonth: -1,
      monthlyVolume: -1,
    },
    ctaText: 'Contact Sales',
    ctaVariant: 'outline',
  },
];
