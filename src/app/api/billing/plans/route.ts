import { NextResponse } from 'next/server';
import { BILLING_PLANS } from '@/data/billingPlans';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: BILLING_PLANS
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

