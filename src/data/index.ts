// Export all data from the data folder
export * from './countries';
export * from './currencies';
export * from './industries';
export * from './networks';

// Bank data management
export interface Bank {
  name: string;
  swift_code: string;
  bank_code: string | null;
}

export const getBanksForCountry = async (countryCode: string): Promise<Bank[]> => {
  try {
    switch (countryCode.toUpperCase()) {
      case 'KE':
        const kenyaBanks = await import('./kenya-banks.json');
        return kenyaBanks.default;
      case 'GH':
        const ghanaBanks = await import('./ghana-banks.json');
        return ghanaBanks.default;
      default:
        return [];
    }
  } catch {
    return [];
  }
};

export const searchBanks = (banks: Bank[], searchTerm: string): Bank[] => {
  if (!searchTerm.trim()) return banks;
  
  const term = searchTerm.toLowerCase();
  return banks.filter(bank => 
    bank.name.toLowerCase().includes(term) ||
    bank.swift_code.toLowerCase().includes(term) ||
    (bank.bank_code && bank.bank_code.toLowerCase().includes(term))
  );
}; 