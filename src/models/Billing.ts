import { ObjectId } from 'mongodb';

export type PlanType = 'receivables' | 'payables' | 'combined' | 'trial';
export type BillingPeriod = 'monthly' | 'yearly';

export interface BillingFeature {
  id: string;
  name: string;
  description?: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface BillingLimits {
  invoicesPerMonth?: number;
  monthlyVolume?: number;
  cryptoToCryptoFee?: number;
  overageFee?: number;
}

/** Dynamic pricing: seat + usage + volume. When set, total = basePrice + (seats * seatPrice) + overages. */
export interface DynamicPricing {
  basePrice: number;
  seatPrice: number;
  includedSeats: number;
  /** Invoices per month included (-1 = unlimited) */
  invoiceLimit: number;
  /** Price per block of extra invoices (e.g. 10 per 100) */
  invoiceOveragePrice?: number;
  invoiceOverageBlock?: number; // e.g. 100
  /** Volume threshold in USD */
  volumeThreshold: number;
  /** Overage fee as decimal (e.g. 0.005 = 0.5%) */
  volumeFee: number;
}

export interface BillingPlan {
  planId: string;
  type: PlanType;
  tier: 'free' | 'basic' | 'pro' | 'premium' | 'starter' | 'growth' | 'scale' | 'enterprise';
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  /** When set, plan uses dynamic pricing; monthlyPrice/yearlyPrice used as "from" display only */
  dynamicPricing?: DynamicPricing;
  /** Enterprise plans: no fixed price, show "Contact Sales" */
  isEnterprise?: boolean;
  monthlyPaystackPlanCode?: string | null; // Paystack plan code (null for free/enterprise/dynamic)
  yearlyPaystackPlanCode?: string | null; // Paystack plan code (null for free/enterprise/dynamic)
  currency: string;
  features: BillingFeature[];
  limits: BillingLimits;
  popular?: boolean;
  /** Who this plan is for: individual (solo), business (teams/orgs), or both */
  audience?: 'individual' | 'business' | 'both';
  ctaText: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
}

/** Result of pricing engine for display and checkout */
export interface CalculatedPrice {
  totalCents: number;
  totalMonthly: number;
  totalYearly: number;
  breakdown: {
    base: number;
    seats: number;
    seatCount: number;
    invoiceOverage?: number;
    volumeOverage?: number;
  };
}

export interface UserSubscription {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId: ObjectId;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingPeriod: BillingPeriod;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  paystackSubscriptionCode?: string; // Paystack subscription code
  paystackPlanCode?: string; // Paystack plan code
  createdAt: Date;
  updatedAt: Date;
  usage: {
    invoicesThisMonth: number;
    monthlyVolume: number;
    lastResetDate: Date;
  };
}

export interface SubscriptionUsage {
  planId: string;
  invoicesUsed: number;
  invoicesLimit: number;
  volumeUsed: number;
  volumeLimit: number;
  canCreateInvoice: boolean;
  canProcessPayment: boolean;
}
