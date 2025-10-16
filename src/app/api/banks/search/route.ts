import { NextRequest, NextResponse } from 'next/server';
import { getBanksForCountry, searchBanks } from '@/data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('country');
    const searchTerm = searchParams.get('search') || '';

    if (!countryCode) {
      return NextResponse.json(
        { success: false, error: 'Country code is required' },
        { status: 400 }
      );
    }

    // Get banks for the country
    const banks = await getBanksForCountry(countryCode);
    
    // Search banks if search term is provided
    const filteredBanks = searchTerm ? searchBanks(banks, searchTerm) : banks;

    return NextResponse.json({
      success: true,
      data: {
        banks: filteredBanks,
        total: filteredBanks.length,
        countryCode
      }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to search banks' },
      { status: 500 }
    );
  }
} 