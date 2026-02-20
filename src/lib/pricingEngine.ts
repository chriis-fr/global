import type { BillingPlan, CalculatedPrice } from '@/models/Billing';

const YEARLY_DISCOUNT = 0.83; // 17% off when paying yearly

/**
 * Calculate monthly total for a plan with optional dynamic pricing.
 * For dynamic plans: total = basePrice + (seats * seatPrice) + optional overages.
 * For static plans: returns plan.monthlyPrice (seats ignored).
 */
export function calculatePlanPrice(
  plan: BillingPlan,
  billingPeriod: 'monthly' | 'yearly',
  seats: number,
  options?: { extraInvoices?: number; extraVolume?: number }
): CalculatedPrice {
  const dp = plan.dynamicPricing;
  if (!dp || plan.isEnterprise) {
    const monthly = plan.monthlyPrice;
    const yearly = plan.yearlyPrice;
    const totalMonthly = monthly;
    const totalYearly = billingPeriod === 'yearly' ? yearly : yearly || monthly * 12 * YEARLY_DISCOUNT;
    return {
      totalCents: Math.round((billingPeriod === 'yearly' ? totalYearly / 12 : totalMonthly) * 100),
      totalMonthly,
      totalYearly: totalYearly || totalMonthly * 12 * YEARLY_DISCOUNT,
      breakdown: {
        base: monthly,
        seats: 0,
        seatCount: 0,
      },
    };
  }

  // For individuals (seats < includedSeats), charge per seat instead of base price
  // This ensures individuals pay only for what they use (1 seat) rather than the base price for multiple seats
  const isIndividualPricing = seats < dp.includedSeats;
  
  let base: number;
  let seatTotal: number;
  
  if (isIndividualPricing) {
    // Individual pricing: pay seatPrice * seats (no base price)
    base = 0;
    seatTotal = seats * dp.seatPrice;
  } else {
    // Business pricing: basePrice covers included seats, pay extra for additional seats
    const extraSeats = Math.max(0, seats - dp.includedSeats);
    base = dp.basePrice;
    seatTotal = extraSeats * dp.seatPrice;
  }
  
  let invoiceOverage = 0;
  if (options?.extraInvoices && dp.invoiceOveragePrice !== undefined && dp.invoiceOverageBlock) {
    const blocks = Math.ceil(options.extraInvoices / dp.invoiceOverageBlock);
    invoiceOverage = blocks * dp.invoiceOveragePrice;
  }
  let volumeOverage = 0;
  if (options?.extraVolume && options.extraVolume > 0 && dp.volumeFee !== undefined) {
    volumeOverage = options.extraVolume * dp.volumeFee;
  }

  const totalMonthly = base + seatTotal + invoiceOverage + volumeOverage;
  const totalYearly = totalMonthly * 12 * YEARLY_DISCOUNT;

  return {
    totalCents: Math.round((billingPeriod === 'yearly' ? totalYearly / 12 : totalMonthly) * 100),
    totalMonthly,
    totalYearly,
    breakdown: {
      base,
      seats: seatTotal,
      seatCount: seats,
      ...(invoiceOverage > 0 && { invoiceOverage }),
      ...(volumeOverage > 0 && { volumeOverage }),
    },
  };
}

/**
 * Get a display-friendly "from" price for a plan (for lists, admin, comparison).
 * Dynamic plans: "From $X/seat" or "From $Y/mo" using included seats.
 * Enterprise: null (show "Contact Sales").
 * Static: plan.monthlyPrice.
 */
export function getDisplayPrice(plan: BillingPlan): { monthly: number; perSeat?: number; label?: string } | null {
  if (plan.isEnterprise) return null;
  if (plan.dynamicPricing) {
    const dp = plan.dynamicPricing;
    // When includedSeats is 0, minimum is 1 seat at seatPrice; else base covers first N seats
    const fromMonthly = dp.includedSeats > 0 ? dp.basePrice : dp.seatPrice;
    return {
      monthly: fromMonthly,
      perSeat: dp.seatPrice,
      label: dp.includedSeats > 0 ? `From $${fromMonthly.toFixed(2)}/mo ($${dp.seatPrice}/seat)` : `$${dp.seatPrice}/seat`,
    };
  }
  return { monthly: plan.monthlyPrice };
}

/**
 * Minimum monthly price for a plan (used for sorting / "cheapest" logic).
 */
export function getMinimumMonthlyPrice(plan: BillingPlan): number {
  const display = getDisplayPrice(plan);
  if (!display) return Infinity;
  return display.monthly;
}

/**
 * Short label for plan price in dropdowns and lists (e.g. "$17.97/mo" or "Contact Sales").
 */
export function getPlanPriceLabel(plan: BillingPlan): string {
  if (plan.isEnterprise) return 'Contact Sales';
  const display = getDisplayPrice(plan);
  if (!display) return '—';
  return `$${display.monthly.toFixed(2)}/mo`;
}
