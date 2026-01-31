import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CurrencyService } from '@/lib/services/currencyService';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount, fromCurrency, toCurrency } = body;

    if (!amount || !fromCurrency || !toCurrency) {
      return NextResponse.json(
        { success: false, message: 'Amount, fromCurrency, and toCurrency are required' },
        { status: 400 }
      );
    }

    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      return NextResponse.json({
        success: true,
        data: {
          originalAmount: amount,
          convertedAmount: amount,
          fromCurrency,
          toCurrency,
          rate: 1,
          converted: false
        }
      });
    }

    // Convert the currency
    const convertedAmount = await CurrencyService.convertCurrency(amount, fromCurrency, toCurrency);
    const rate = await CurrencyService.getExchangeRate(fromCurrency, toCurrency);

    return NextResponse.json({
      success: true,
      data: {
        originalAmount: amount,
        convertedAmount,
        fromCurrency,
        toCurrency,
        rate,
        converted: true
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to convert currency',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET removed: preferred currency is provided via getPreferredCurrency() server action
// and preloaded in layout (initialCurrency). Use lib/actions/currency.ts getPreferredCurrency(). 