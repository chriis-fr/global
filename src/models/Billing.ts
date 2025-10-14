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

export interface BillingPlan {
  planId: string;
  type: PlanType;
  tier: 'free' | 'basic' | 'pro' | 'premium';
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyPriceId: string | null; // Stripe price ID
  yearlyPriceId: string | null; // Stripe price ID
  currency: string;
  features: BillingFeature[];
  limits: BillingLimits;
  popular?: boolean;
  ctaText: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
}

export interface UserSubscription {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId: ObjectId;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingPeriod: BillingPeriod;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
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
