'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Bank } from '@/data';

interface BankSelectorProps {
  countryCode: string;
  value: string;
  onBankSelectAction: (bank: Bank) => void;
  onInputChangeAction: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BankSelector({
  countryCode,
  value,
  onBankSelectAction,
  onInputChangeAction,
  placeholder = "Search for a bank...",
  disabled = false
}: BankSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadBanks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/banks/search?country=${countryCode}`);
      const data = await response.json();
      
      if (data.success) {
        setBanks(data.data.banks);
        setFilteredBanks(data.data.banks);
      }
    } catch (error) {
      console.error('Error loading banks:', error);
      setBanks([]);
      setFilteredBanks([]);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  // Load banks when country changes
  useEffect(() => {
    if (countryCode) {
      loadBanks();
    }
  }, [countryCode, loadBanks]);

  // Filter banks when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBanks(banks);
    } else {
      const filtered = banks.filter(bank =>
        bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bank.swift_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bank.bank_code && bank.bank_code.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredBanks(filtered);
    }
  }, [searchTerm, banks]);

  const handleBankSelect = (bank: Bank) => {
    onBankSelectAction(bank);
    setSearchTerm('');
    setIsOpen(false);
    onInputChangeAction(bank.name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onInputChangeAction(newValue);
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchTerm('');
    onInputChangeAction('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-black"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : value ? (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredBanks.length > 0 ? (
            <div className="py-1">
              {filteredBanks.map((bank, index) => (
                <button
                  key={`${bank.name}-${index}`}
                  onClick={() => handleBankSelect(bank)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <div className="font-medium text-gray-900">{bank.name}</div>
                  <div className="text-sm text-gray-500">
                    SWIFT: {bank.swift_code}
                    {bank.bank_code && ` • Code: ${bank.bank_code}`}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {loading ? 'Loading banks...' : 'No banks found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 