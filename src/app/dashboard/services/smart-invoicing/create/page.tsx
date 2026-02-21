'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { sendInvoiceWhatsApp } from '@/lib/actions/whatsapp';

import Image from 'next/image';
import { 
  ArrowLeft, 
  Save,
  Plus,
  Trash2,
  Building2,
  User,
  Wallet,
  CreditCard,
  Upload,
  Calendar,
  Clock,
  Edit3,
  Loader2,
  Download,
  AlertCircle,
  ChevronDown,
  Search,
  Mail,
  File,
  ChevronDown as ChevronDownIcon,
  Smartphone,
  Lock,
  CheckCircle
} from 'lucide-react';
import { fiatCurrencies, cryptoCurrencies, getCurrencyByCode } from '@/data/currencies';
import { countries, getTaxRatesByCountry } from '@/data/countries';
import { networks } from '@/data/networks';
import InvoicePdfView from '@/components/invoicing/InvoicePdfView';
import { LogoSelector } from '@/components/LogoSelector';
import BankSelector from '@/components/BankSelector';
import { Bank } from '@/data';
import DynamicBankFields from '@/components/payments/DynamicBankFields';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { CELO_TOKENS } from '@/lib/chains/celo';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector';
import SavePaymentMethodButton from '@/components/payments/SavePaymentMethodButton';
import ReceivingAddressInput from '@/components/wallet/ReceivingAddressInput';
import { getInvoiceDraft } from '@/lib/actions/pdf-invoice';
import toast from 'react-hot-toast';
import { pdf } from '@react-pdf/renderer';
import { InvoicePdfDocument, type InvoicePdfData } from '@/components/invoicing/InvoicePdfDocument';

interface Client {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  taxId?: string;
  notes?: string;
}

interface InvoiceFormData {
  _id?: string;
  invoiceNumber?: string;
  invoiceName: string;
  issueDate: string;
  dueDate: string;
  companyLogo?: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  companyTaxNumber: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  // WhatsApp sending options
  sendViaWhatsapp: boolean;
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  fiatPaymentSubtype?: 'bank' | 'mpesa_paybill' | 'mpesa_till' | 'phone';
  paymentNetwork?: string;
  paymentAddress?: string;
  receivingMethod?: 'manual' | 'wallet'; // How the receiving address was entered
  receivingWalletType?: string | null; // Type of wallet if connected (safe, metamask, etc.)
  chainId?: number; // Chain ID for crypto payments (e.g., 42220 for Celo)
  tokenAddress?: string; // Contract address for the crypto token
  bankName?: string;
  swiftCode?: string;
  bankCode?: string;
  branchCode?: string;
  accountName?: string;
  accountNumber?: string;
  branchAddress?: string;
  // Custom bank fields (for banks not in predefined list)
  bankCountryCode?: string; // Country code for bank selection (GH, KE, etc.)
  customBankFields?: Record<string, string>; // Dynamic key-value pairs for custom bank fields
  // M-Pesa Paybill fields
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  // M-Pesa Till fields
  tillNumber?: string;
  businessName?: string;
  // Phone payment field
  paymentPhoneNumber?: string;
  enableMultiCurrency: boolean;
  invoiceType: 'regular' | 'recurring';
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  total: number;
  /** When true, withholding tax is deducted from (subtotal + totalTax); can be removed per invoice with ×. */
  withholdingTaxEnabled?: boolean;
  /** Withholding tax rate % (e.g. 5 for 5%); default 5. */
  withholdingTaxRatePercent?: number;
  memo: string;
  attachedFiles: File[];
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  ccClients?: Array<{
    _id?: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    address?: string;
  }>;
}

const defaultInvoiceData: InvoiceFormData = {
  invoiceNumber: '',
  invoiceName: 'Invoice',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  companyAddress: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  },
  companyTaxNumber: '',
  clientName: '',
  clientCompany: '',
  clientEmail: '',
  clientPhone: '',
  clientAddress: {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  },
  // WhatsApp sending options
  sendViaWhatsapp: false,
  currency: 'USD',
  paymentMethod: 'fiat',
  fiatPaymentSubtype: 'bank',
  paymentNetwork: '',
  paymentAddress: '',
  receivingMethod: 'manual', // Default to manual entry
  receivingWalletType: null,
  chainId: undefined, // Optional - only set when Celo is selected
  tokenAddress: undefined, // Optional - only set when Celo is selected
  bankName: '',
  swiftCode: '',
  bankCode: '',
  branchCode: '',
  accountName: '',
  accountNumber: '',
  branchAddress: '',
  bankCountryCode: 'KE', // Default to Kenya
  customBankFields: {}, // Dynamic custom bank fields
  paybillNumber: '',
  mpesaAccountNumber: '',
  tillNumber: '',
  businessName: '',
  paymentPhoneNumber: '',
  enableMultiCurrency: false,
  invoiceType: 'regular',
  items: [
    {
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      amount: 0
    }
  ],
  subtotal: 0,
  totalTax: 0,
  total: 0,
  memo: '',
  attachedFiles: [],
  status: 'draft',
  ccClients: []
};

// Custom hook for form persistence
const useFormPersistence = (key: string, initialData: InvoiceFormData, setAutoSaveStatus: (status: 'saved' | 'saving' | 'error' | null) => void) => {
  const [formData, setFormData] = useState<InvoiceFormData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Merge with default data to handle new fields, but preserve user selections
          // Prioritize saved data over defaults, especially for currency and payment settings
          // CRITICAL: If tokenAddress is set, preserve the currency that was synced with it
          const merged = { 
            ...initialData, 
            ...parsed,
            // Explicitly preserve currency and payment-related fields from saved data
            currency: parsed.currency || initialData.currency,
            paymentMethod: parsed.paymentMethod || initialData.paymentMethod,
            paymentNetwork: parsed.paymentNetwork || initialData.paymentNetwork,
            chainId: parsed.chainId || initialData.chainId,
            tokenAddress: parsed.tokenAddress || initialData.tokenAddress,
            paymentAddress: parsed.paymentAddress || initialData.paymentAddress
          };
          
          // If tokenAddress is set and currency doesn't match, sync it
          if (merged.tokenAddress && merged.paymentNetwork === 'celo') {
            if (merged.tokenAddress === 'native' && merged.currency !== 'CELO') {
              merged.currency = 'CELO';
            } else if (merged.tokenAddress === CELO_TOKENS.USDT.address && merged.currency !== 'USDT') {
              merged.currency = 'USDT';
            } else if (merged.tokenAddress === CELO_TOKENS.cUSD.address && merged.currency !== 'CUSD') {
              merged.currency = 'CUSD';
            }
          }
          
          return merged;
        }
      } catch (error) {
        console.warn('Failed to load saved form data:', error);
      }
    }
    return initialData;
  });

  const updateFormData = (newData: InvoiceFormData | ((prev: InvoiceFormData) => InvoiceFormData)) => {
    setFormData(prev => {
      let updated = typeof newData === 'function' ? newData(prev) : newData;
      
      // SAFEGUARD: Don't save empty company data if we have loaded data
      // This prevents overwriting good data with empty values
      const hasCompanyData = updated.companyName && updated.companyName.trim() !== '';
      const prevHasCompanyData = prev.companyName && prev.companyName.trim() !== '';
      
      // If company data is being cleared but we had data before, preserve it
      // This prevents accidental clearing of company information
      const shouldPreserveCompanyData = !hasCompanyData && prevHasCompanyData;
      
      if (shouldPreserveCompanyData) {
        console.warn('⚠️ [Form Persistence] Attempted to clear company data, preserving existing data', {
          prevCompanyName: prev.companyName,
          updatedCompanyName: updated.companyName
        });
        updated = {
          ...updated,
          companyName: prev.companyName,
          companyEmail: prev.companyEmail || updated.companyEmail,
          companyPhone: prev.companyPhone || updated.companyPhone,
          companyAddress: {
            ...updated.companyAddress,
            street: prev.companyAddress?.street || updated.companyAddress?.street || '',
            city: prev.companyAddress?.city || updated.companyAddress?.city || '',
            state: prev.companyAddress?.state || updated.companyAddress?.state || '',
            zipCode: prev.companyAddress?.zipCode || updated.companyAddress?.zipCode || '',
            country: prev.companyAddress?.country || updated.companyAddress?.country || 'US'
          },
          companyTaxNumber: prev.companyTaxNumber || updated.companyTaxNumber
        };
      }
      
      // Auto-save to localStorage with status indication
      if (typeof window !== 'undefined') {
        setAutoSaveStatus('saving');
        try {
          localStorage.setItem(key, JSON.stringify(updated));
          setAutoSaveStatus('saved');
          // Clear status after 2 seconds
          setTimeout(() => setAutoSaveStatus(null), 2000);
        } catch (error) {
          console.warn('Failed to save form data:', error);
          setAutoSaveStatus('error');
          setTimeout(() => setAutoSaveStatus(null), 3000);
        }
      }
      
      return updated;
    });
  };

  const clearSavedData = () => {
    if (typeof window !== 'undefined') {
      // CRITICAL: Preserve company data when clearing saved invoice data
      // Company data should persist across invoice creations
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Extract company data to preserve
          const companyData = {
            companyName: parsed.companyName,
            companyEmail: parsed.companyEmail,
            companyPhone: parsed.companyPhone,
            companyAddress: parsed.companyAddress,
            companyTaxNumber: parsed.companyTaxNumber,
            companyLogo: parsed.companyLogo
          };
          
          // Clear the invoice draft
          localStorage.removeItem(key);
          
          // Immediately save back only the company data
          // This ensures company info persists for next invoice
          if (companyData.companyName || companyData.companyEmail) {
            const companyOnlyData = {
              ...initialData,
              ...companyData
            };
            localStorage.setItem(key, JSON.stringify(companyOnlyData));
            console.log('✅ [Form Persistence] Preserved company data after clearing invoice draft');
          }
        } else {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.warn('Failed to preserve company data:', error);
        localStorage.removeItem(key);
      }
    }
  };

  return { formData, setFormData: updateFormData, clearSavedData };
};

/** Round to 2 decimal places for money; avoids 500 becoming 499.99999999999994. */
function round2(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Normalize all monetary fields to 2 decimals before sending to API so 500 stays 500. */
function normalizeInvoicePayload(
  data: InvoiceFormData,
  overrides: Partial<InvoiceFormData> & { withholdingTaxAmount?: number; withholdingTaxRatePercent?: number } = {}
): InvoiceFormData & { withholdingTaxAmount?: number; withholdingTaxRatePercent?: number; routingNumber?: string } {
  const sub = round2(Number(data.subtotal) ?? 0);
  const tax = round2(Number(data.totalTax) ?? 0);
  const tot = round2(Number(data.total) ?? 0);
  const items = (data.items ?? []).map((item) => ({
    ...item,
    unitPrice: round2(Number(item.unitPrice) ?? 0),
    amount: round2(Number(item.amount) ?? 0),
    discount: round2(Number(item.discount) ?? 0),
    tax: round2(Number(item.tax) ?? 0)
  }));
  // API expects routingNumber; create form uses swiftCode/bankCode (e.g. Kenya) — send as routingNumber
  const routingNumber = data.swiftCode || data.bankCode || '';
  return { ...data, subtotal: sub, totalTax: tax, total: tot, items, routingNumber, ...overrides };
}

/** Generate professional vector PDF (react-pdf) and return base64. Used for send and download. */
async function generateInvoicePdfBase64(
  data: InvoicePdfData,
  invoiceNumber?: string
): Promise<string> {
  const blob = await pdf(
    <InvoicePdfDocument data={data} invoiceNumber={invoiceNumber} />
  ).toBlob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  
  // Auto-save status state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  
  // Use form persistence hook
  const { formData, setFormData, clearSavedData } = useFormPersistence(
    `invoice-draft-${session?.user?.email || 'anonymous'}`, 
    defaultInvoiceData,
    setAutoSaveStatus
  );
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showCompanyEditModal, setShowCompanyEditModal] = useState(false);
  const [showClientEditModal, setShowClientEditModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  // Scroll to validation errors when they appear (e.g. after clicking Send Invoice / Download PDF)
  useEffect(() => {
    if (validationErrors.length > 0 && validationErrorsRef.current) {
      const el = validationErrorsRef.current;
      // Center the error block in the viewport so it’s clearly visible; scroll-margin-top on the element adds top spacing
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [validationErrors]);

  // Lock body scroll when send overlay is visible so page cannot scroll
  useEffect(() => {
    if (!sendingInvoice) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [sendingInvoice]);

  // Handler functions that scroll to top before opening modals
  const handleOpenCompanyModal = () => {
    // Immediately scroll to top - use all methods
    window.scrollTo(0, 0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
    
    // Lock body at top immediately
    document.body.style.cssText = `
      position: fixed !important;
      top: 0px !important;
      left: 0px !important;
      width: 100% !important;
      overflow: hidden !important;
    `;
    
    document.documentElement.style.cssText = `
      overflow: hidden !important;
      position: fixed !important;
      top: 0px !important;
      left: 0px !important;
      width: 100% !important;
    `;
    
    // Force scroll to 0 again after locking
    window.scrollTo(0, 0);
    
    // Wait for browser to process, then open modal
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowCompanyEditModal(true);
      });
    });
  };

  const handleOpenClientModal = () => {
    // Immediately scroll to top - use all methods
    window.scrollTo(0, 0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
    
    // Lock body at top immediately
    document.body.style.cssText = `
      position: fixed !important;
      top: 0px !important;
      left: 0px !important;
      width: 100% !important;
      overflow: hidden !important;
    `;
    
    document.documentElement.style.cssText = `
      overflow: hidden !important;
      position: fixed !important;
      top: 0px !important;
      left: 0px !important;
      width: 100% !important;
    `;
    
    // Force scroll to 0 again after locking
    window.scrollTo(0, 0);
    
    // Wait for browser to process, then open modal
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowClientEditModal(true);
      });
    });
  };

  // Prevent body scroll when modals are open (only for From and To modals, not add client)
  useEffect(() => {
    if (showCompanyEditModal || showClientEditModal) {
      // Double-check we're at top
      window.scrollTo(0, 0);
      
      // Ensure scroll is locked - use !important to override any conflicts
      document.body.style.cssText = `
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        width: 100% !important;
        overflow: hidden !important;
      `;
      
      document.documentElement.style.cssText = `
        overflow: hidden !important;
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        width: 100% !important;
      `;
      
      // Prevent scroll on main content container if it exists
      const mainContent = document.querySelector('main');
      if (mainContent) {
        (mainContent as HTMLElement).style.cssText = 'overflow: hidden !important;';
      }
    } else {
      // Restore scrolling - clear all styles
      document.body.style.cssText = '';
      document.documentElement.style.cssText = '';
      
      // Restore scroll on main content container
      const mainContent = document.querySelector('main');
      if (mainContent) {
        (mainContent as HTMLElement).style.overflow = '';
      }
    }

    // Cleanup function
    return () => {
      if (!showCompanyEditModal && !showClientEditModal) {
        document.body.style.cssText = '';
        document.documentElement.style.cssText = '';
        
        const mainContent = document.querySelector('main');
        if (mainContent) {
          (mainContent as HTMLElement).style.overflow = '';
        }
      }
    };
  }, [showCompanyEditModal, showClientEditModal]);
  
  // Phone formatting and validation functions
  const formatPhoneForWhatsApp = (phone: string, countryCode: string = '+1') => {
    if (!phone) return phone;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If starts with 0, remove it and add country code
    if (digits.startsWith('0')) {
      const withoutZero = digits.substring(1);
      return `${countryCode}${withoutZero}`;
    }
    
    // If already has country code, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // If no leading 0 and no country code, add it
    return `${countryCode}${digits}`;
  };

  // Extract country code from phone number
  const extractCountryCodeFromPhone = (phone: string) => {
    if (!phone || !phone.startsWith('+')) return null;
    
    // Common country codes mapping
    const countryCodeMap: { [key: string]: string } = {
      '+1': 'US', '+7': 'RU', '+20': 'EG', '+27': 'ZA', '+30': 'GR', '+31': 'NL', '+32': 'BE',
      '+33': 'FR', '+34': 'ES', '+39': 'IT', '+40': 'RO', '+41': 'CH', '+43': 'AT', '+44': 'GB',
      '+45': 'DK', '+46': 'SE', '+47': 'NO', '+48': 'PL', '+49': 'DE', '+51': 'PE', '+52': 'MX',
      '+53': 'CU', '+54': 'AR', '+55': 'BR', '+56': 'CL', '+57': 'CO', '+58': 'VE', '+60': 'MY',
      '+61': 'AU', '+62': 'ID', '+63': 'PH', '+64': 'NZ', '+65': 'SG', '+66': 'TH', '+81': 'JP',
      '+82': 'KR', '+84': 'VN', '+86': 'CN', '+90': 'TR', '+91': 'IN', '+92': 'PK', '+93': 'AF',
      '+94': 'LK', '+95': 'MM', '+98': 'IR', '+212': 'MA', '+213': 'DZ', '+216': 'TN', '+218': 'LY',
      '+220': 'GM', '+221': 'SN', '+222': 'MR', '+223': 'ML', '+224': 'GN', '+225': 'CI', '+226': 'BF',
      '+227': 'NE', '+228': 'TG', '+229': 'BJ', '+230': 'MU', '+231': 'LR', '+232': 'SL', '+233': 'GH',
      '+234': 'NG', '+235': 'TD', '+236': 'CF', '+237': 'CM', '+238': 'CV', '+239': 'ST', '+240': 'GQ',
      '+241': 'GA', '+242': 'CG', '+243': 'CD', '+244': 'AO', '+245': 'GW', '+246': 'IO', '+248': 'SC',
      '+249': 'SD', '+250': 'RW', '+251': 'ET', '+252': 'SO', '+253': 'DJ', '+254': 'KE', '+255': 'TZ',
      '+256': 'UG', '+257': 'BI', '+258': 'MZ', '+260': 'ZM', '+261': 'MG', '+262': 'RE', '+263': 'ZW',
      '+264': 'NA', '+265': 'MW', '+266': 'LS', '+267': 'BW', '+268': 'SZ', '+269': 'KM', '+290': 'SH',
      '+291': 'ER', '+297': 'AW', '+298': 'FO', '+299': 'GL', '+350': 'GI', '+351': 'PT', '+352': 'LU',
      '+353': 'IE', '+354': 'IS', '+355': 'AL', '+356': 'MT', '+357': 'CY', '+358': 'FI', '+359': 'BG',
      '+370': 'LT', '+371': 'LV', '+372': 'EE', '+373': 'MD', '+374': 'AM', '+375': 'BY', '+376': 'AD',
      '+377': 'MC', '+378': 'SM', '+380': 'UA', '+381': 'RS', '+382': 'ME', '+383': 'XK', '+385': 'HR',
      '+386': 'SI', '+387': 'BA', '+389': 'MK', '+420': 'CZ', '+421': 'SK', '+423': 'LI', '+500': 'FK',
      '+501': 'BZ', '+502': 'GT', '+503': 'SV', '+504': 'HN', '+505': 'NI', '+506': 'CR', '+507': 'PA',
      '+508': 'PM', '+509': 'HT', '+590': 'GP', '+591': 'BO', '+592': 'GY', '+593': 'EC', '+594': 'GF',
      '+595': 'PY', '+596': 'MQ', '+597': 'SR', '+598': 'UY', '+599': 'AN', '+670': 'TL', '+672': 'NF',
      '+673': 'BN', '+674': 'NR', '+675': 'PG', '+676': 'TO', '+677': 'SB', '+678': 'VU', '+679': 'FJ',
      '+680': 'PW', '+681': 'WF', '+682': 'CK', '+683': 'NU', '+684': 'AS', '+685': 'WS', '+686': 'KI',
      '+687': 'NC', '+688': 'TV', '+689': 'PF', '+690': 'TK', '+691': 'FM', '+692': 'MH', '+850': 'KP',
      '+852': 'HK', '+853': 'MO', '+855': 'KH', '+856': 'LA', '+880': 'BD', '+886': 'TW', '+960': 'MV',
      '+961': 'LB', '+962': 'JO', '+963': 'SY', '+964': 'IQ', '+965': 'KW', '+966': 'SA', '+967': 'YE',
      '+968': 'OM', '+970': 'PS', '+971': 'AE', '+972': 'IL', '+973': 'BH', '+974': 'QA', '+975': 'BT',
      '+976': 'MN', '+977': 'NP', '+992': 'TJ', '+993': 'TM', '+994': 'AZ', '+995': 'GE', '+996': 'KG',
      '+998': 'UZ'
    };
    
    // Try to match country code (longest first)
    const sortedCodes = Object.keys(countryCodeMap).sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (phone.startsWith(code)) {
        return countryCodeMap[code];
      }
    }
    
    return null;
  };

  const validatePhoneForWhatsApp = (phone: string) => {
    if (!phone) return false;
    
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Must start with + and have at least 10 digits after country code
    const phoneRegex = /^\+\d{10,15}$/;
    return phoneRegex.test(cleaned);
  };
  
  // CC Clients state
  const [showCcClientSelector, setShowCcClientSelector] = useState(false);
  const [showCcClientCreationModal, setShowCcClientCreationModal] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationErrorsRef = useRef<HTMLDivElement>(null);

  // Helper function to check if currency is local/fiat (not crypto)
  const isLocalCurrency = () => {
    const currencyInfo = getCurrencyByCode(formData.currency);
    return currencyInfo?.type === 'fiat' || !currencyInfo || formData.paymentMethod === 'fiat';
  };

  // Helper function to get currency icon
  const getCurrencyIcon = (currencyCode: string) => {
    // Map of currency codes to their actual file names
    const currencyIconMap: { [key: string]: string } = {
      // Fiat Currencies
      'USD': 'usd.png',
      'EUR': 'euro.png',
      'GBP': 'gbp.png',
      'JPY': 'jpy.png',
      'CAD': 'cad.jpeg',
      'AUD': 'usd.png', // Fallback to USD until aud.png is added
      'CHF': 'chf.png',
      'CNY': 'cny.jpeg',
      'INR': 'inr.png',
      'BRL': 'brl.png',
      'MXN': 'mxn.png',
      'SGD': 'sgd.png',
      'HKD': 'hkd.png',
      'NZD': 'nzd.png',
      'SEK': 'sek.png',
      'NOK': 'nok.png',
      'DKK': 'dkk.png',
      'PLN': 'pln.png',
      'CZK': 'czk.png',
      'HUF': 'huf.png',
      'RUB': 'rub.png',
      'TRY': 'try.png',
      'KRW': 'krw.png',
      'THB': 'thb.jpeg',
      'MYR': 'myr.png',
      'IDR': 'idr.png',
      'PHP': 'php.png',
      'VND': 'vnd.png',
      'EGP': 'egp.png',
      'ZAR': 'zar.png',
      'NGN': 'ngn.png',
      'KES': 'kes.png',
      'GHS': 'ghs.png',
      'UGX': 'ugx.png',
      'TZS': 'tzs.png',
      
      // Cryptocurrencies
      'BTC': 'btc.png',
      'ETH': 'eth.png',
      'USDT': 'usdt.png',
      'USDC': 'usdc.png',
      'DAI': 'dai.png',
      'USDP': 'usdp.png',
      'TUSD': 'tusd.png',
      'CELO': 'celo.png', // You have this file
      'CUSD': 'cusd.png',
      'CEUR': 'ceur.png',
      'SCR': 'scroll.png', // You have this file
      'BNB': 'bnb.png',
      'SOL': 'sol.png',
      'ADA': 'ada.png',
      'DOT': 'chainsnobg.png', // Fallback to app logo - you need dot.png
      'MATIC': 'chainsnobg.png', // Fallback to app logo - you need matic.png
      'LINK': 'chainsnobg.png', // Fallback to app logo - you need link.png
      'UNI': 'chainsnobg.png', // Fallback to app logo - you need uni.png
      'LTC': 'chainsnobg.png', // Fallback to app logo - you need ltc.png
      'BCH': 'chainsnobg.png', // Fallback to app logo - you need bch.png
      'XRP': 'chainsnobg.png', // Fallback to app logo - you need xrp.png
      'AVAX': 'chainsnobg.png', // Fallback to app logo - you need avax.png
      'ATOM': 'chainsnobg.png', // Fallback to app logo - you need atom.png
      'FTM': 'chainsnobg.png', // Fallback to app logo - you need ftm.png
      'NEAR': 'chainsnobg.png', // Fallback to app logo - you need near.png
      'ALGO': 'chainsnobg.png', // Fallback to app logo - you need algo.png
    };

    const iconFile = currencyIconMap[currencyCode.toUpperCase()];
    if (iconFile) {
      return `/currencies/${iconFile}`;
    }
    
    // Ultimate fallback - use app logo
    return '/chainsnobg.png';
  };

  // Helper function to get network icon
  const getNetworkIcon = (networkId: string) => {
    // Map of network IDs to their actual file names
    const networkIconMap: { [key: string]: string } = {
      'ethereum': 'ethereum.png', // You have this file
      'polygon': 'chainsnobg.png', // Fallback to app logo - you need polygon.png
      'bsc': 'chainsnobg.png', // Fallback to app logo - you need bsc.png
      'solana': 'chainsnobg.png', // Fallback to app logo - you need solana.png
      'avalanche': 'chainsnobg.png', // Fallback to app logo - you need avalanche.png
      'fantom': 'chainsnobg.png', // Fallback to app logo - you need fantom.png
      'arbitrum': 'chainsnobg.png', // Fallback to app logo - you need arbitrum.png
      'optimism': 'chainsnobg.png', // Fallback to app logo - you need optimism.png
      'base': 'chainsnobg.png', // Fallback to app logo - you need base.png
      'cardano': 'chainsnobg.png', // Fallback to app logo - you need cardano.png
      'polkadot': 'chainsnobg.png', // Fallback to app logo - you need polkadot.png
      'cosmos': 'chainsnobg.png', // Fallback to app logo - you need cosmos.png
      'near': 'chainsnobg.png', // Fallback to app logo - you need near.png
      'algorand': 'chainsnobg.png', // Fallback to app logo - you need algorand.png
      'bitcoin': 'chainsnobg.png', // Fallback to app logo - you need bitcoin.png
      'litecoin': 'chainsnobg.png', // Fallback to app logo - you need litecoin.png
      'ripple': 'chainsnobg.png', // Fallback to app logo - you need ripple.png
      'celo': 'celo.png', // You have this file
      'scroll': 'scroll.png', // You have this file
    };

    const iconFile = networkIconMap[networkId.toLowerCase()];
    if (iconFile) {
      return `/networks/${iconFile}`;
    }
    
    // Ultimate fallback - use app logo
    return '/chainsnobg.png';
  };

  // Currency dropdown state
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [userHasSelectedCurrency, setUserHasSelectedCurrency] = useState(false);
  const [isAutoSelectingCurrency, setIsAutoSelectingCurrency] = useState(false);
  const [showCustomBankFields, setShowCustomBankFields] = useState(false);
  const [isCustomBank, setIsCustomBank] = useState(false);
  
  // Check saved data on mount to preserve currency selection
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.user?.email) {
      try {
        const saved = localStorage.getItem(`invoice-draft-${session.user.email}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // If currency exists and is not the default USD, user has selected it
          if (parsed.currency && parsed.currency !== 'USD' && parsed.currency !== defaultInvoiceData.currency) {
            setUserHasSelectedCurrency(true);
          }
        }
      } catch {
        // Ignore errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Auto-select currency based on payment method (only if user hasn't manually selected)
  const autoSelectCurrencyForPaymentMethod = (paymentMethod: string) => {
    // Don't auto-select if user has already manually selected a currency
    if (userHasSelectedCurrency) {
      return;
    }
    
    // Don't auto-select if we're currently syncing from token selection
    if (isAutoSelectingCurrency) {
      return;
    }
    
    if (paymentMethod === 'crypto') {
      // Auto-select USDT for crypto payments only if no currency is selected
      const usdtCurrency = cryptoCurrencies.find((c: { code: string }) => c.code === 'USDT');
      
      if (usdtCurrency) {
        setIsAutoSelectingCurrency(true);
        setFormData(prev => {
          // CRITICAL: Don't override if tokenAddress is set (user selected via token)
          if (prev.tokenAddress && prev.paymentNetwork === 'celo') {
            // User has selected a token, don't override the currency
            return prev;
          }
          
          // Don't auto-select if currency is already a crypto currency (user has selected it)
          const currentCurrency = getCurrencyByCode(prev.currency);
          if (currentCurrency && currentCurrency.type === 'crypto') {
            // User has already selected a crypto currency, don't override
            return prev;
          }
          
          // Only auto-select if currency is default (USD) or empty
          if (prev.currency === 'USD' || !prev.currency || prev.currency === defaultInvoiceData.currency) {
            return {
              ...prev,
              currency: usdtCurrency.code,
              currencySymbol: usdtCurrency.symbol,
              currencyName: usdtCurrency.name,
              currencyLogo: usdtCurrency.logo,
              currencyType: usdtCurrency.type,
              currencyNetwork: usdtCurrency.network
            };
          }
          return prev; // Keep existing currency if user has selected something else
        });
        // Reset the flag after a short delay
        setTimeout(() => setIsAutoSelectingCurrency(false), 100);
      }
    } else if (paymentMethod === 'fiat') {
      // Auto-select USD for fiat payments only if no currency is selected
      const usdCurrency = fiatCurrencies.find((c: { code: string }) => c.code === 'USD');
      
      if (usdCurrency) {
        setIsAutoSelectingCurrency(true);
        setFormData(prev => {
          // CRITICAL: Don't override if tokenAddress is set (user selected via token)
          if (prev.tokenAddress && prev.paymentNetwork === 'celo') {
            // User has selected a token, don't override the currency
            return prev;
          }
          
          // Don't auto-select if currency is already a fiat currency (user has selected it)
          const currentCurrency = getCurrencyByCode(prev.currency);
          if (currentCurrency && currentCurrency.type === 'fiat' && prev.currency !== 'USD') {
            // User has already selected a fiat currency, don't override
            return prev;
          }
          
          // Only auto-select if currency is a crypto currency or empty
          if (!prev.currency || (currentCurrency && currentCurrency.type === 'crypto')) {
            return {
              ...prev,
              currency: usdCurrency.code,
              currencySymbol: usdCurrency.symbol,
              currencyName: usdCurrency.name,
              currencyLogo: usdCurrency.logo,
              currencyType: usdCurrency.type,
              currencyNetwork: usdCurrency.network
            };
          }
          return prev; // Keep existing currency if user has selected something else
        });
        // Reset the flag after a short delay
        setTimeout(() => setIsAutoSelectingCurrency(false), 100);
      }
    }
  };
  
  // Network dropdown state
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [networkSearch, setNetworkSearch] = useState('');
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{
    _id: string;
    name: string;
    type: 'fiat' | 'crypto';
    fiatDetails?: {
      subtype: 'bank' | 'mpesa_paybill' | 'mpesa_till' | 'phone';
      // Bank details
      bankName?: string;
      swiftCode?: string;
      bankCode?: string;
      branchCode?: string;
      accountName?: string;
      accountNumber?: string;
      branchAddress?: string;
      // Custom bank fields
      customFields?: Record<string, string>;
      // M-Pesa details
      paybillNumber?: string;
      mpesaAccountNumber?: string;
      tillNumber?: string;
      businessName?: string;
      // Phone payment details
      paymentPhoneNumber?: string;
    };
    cryptoDetails?: {
      network: string;
      address: string;
      currency?: string;
      chainId?: number;
      tokenAddress?: string;
      safeDetails?: {
        safeAddress: string;
        owners: string[];
        threshold: number;
        chainId?: number;
      };
    };
  }>>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  // Check if we're editing an existing invoice
  const invoiceId = searchParams?.get('id');
  const fromPdfDraftId = searchParams?.get('fromPdfDraft');
  const fromClickUp = searchParams?.get('fromClickUp') === '1';
  const pdfDraftLoadDone = useRef(false);
  const lastLoadedPdfDraftId = useRef<string | null>(null);
  const clickUpLoadDone = useRef(false);

  // Check if any items have discounts (used to conditionally show Discount column)
  const hasAnyDiscounts = formData.items.some(item => item.discount > 0);

  // Download dropdown state
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  const loadInvoice = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Security check: Only allow editing draft invoices
        if (data.data.status !== 'draft') {
          console.warn('🚫 [Security] Attempted to edit non-draft invoice:', data.data.status);
          router.push(`/dashboard/services/smart-invoicing/invoices/${id}`);
          return;
        }
        
        const raw = data.data;
        const items = (raw.items || []).map((item: { unitPrice?: number; amount?: number; quantity?: number; [k: string]: unknown }) => ({
          ...item,
          unitPrice: round2(Number(item.unitPrice) ?? 0),
          amount: round2(Number(item.amount) ?? 0),
          quantity: Math.max(0, Math.round(Number(item.quantity) || 1))
        }));
        // Map nested companyDetails/clientDetails to flat form shape so From/To sections persist after save
        const cd = raw.companyDetails as { name?: string; addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string; taxNumber?: string; logo?: string; email?: string; phone?: string } | undefined;
        const clientD = raw.clientDetails as { firstName?: string; companyName?: string; email?: string; country?: string; region?: string; city?: string; postalCode?: string; addressLine1?: string; phone?: string } | undefined;
        const loadedData = {
          ...defaultInvoiceData,
          ...raw,
          // Ensure From (company) section is always from saved data, not defaults
          companyName: raw.companyName ?? cd?.name ?? defaultInvoiceData.companyName,
          companyEmail: raw.companyEmail ?? (cd as { email?: string } | undefined)?.email ?? defaultInvoiceData.companyEmail,
          companyPhone: raw.companyPhone ?? (cd as { phone?: string } | undefined)?.phone ?? defaultInvoiceData.companyPhone,
          companyTaxNumber: raw.companyTaxNumber ?? cd?.taxNumber ?? defaultInvoiceData.companyTaxNumber,
          companyLogo: raw.companyLogo ?? cd?.logo ?? defaultInvoiceData.companyLogo,
          companyAddress: raw.companyAddress?.street !== undefined && raw.companyAddress?.country !== undefined
            ? raw.companyAddress
            : {
                street: cd?.addressLine1 ?? raw.companyAddress?.street ?? '',
                city: cd?.city ?? raw.companyAddress?.city ?? '',
                state: cd?.region ?? raw.companyAddress?.state ?? '',
                zipCode: cd?.postalCode ?? raw.companyAddress?.zipCode ?? '',
                country: cd?.country ?? raw.companyAddress?.country ?? 'US'
              },
          // Ensure To (client) section is from saved data
          clientName: raw.clientName ?? (clientD ? [clientD.firstName, (clientD as { lastName?: string }).lastName].filter(Boolean).join(' ') : undefined) ?? defaultInvoiceData.clientName,
          clientCompany: raw.clientCompany ?? clientD?.companyName ?? defaultInvoiceData.clientCompany,
          clientEmail: raw.clientEmail ?? clientD?.email ?? defaultInvoiceData.clientEmail,
          clientPhone: raw.clientPhone ?? clientD?.phone ?? defaultInvoiceData.clientPhone,
          clientAddress: raw.clientAddress?.street !== undefined && raw.clientAddress?.country !== undefined
            ? raw.clientAddress
            : {
                street: clientD?.addressLine1 ?? raw.clientAddress?.street ?? '',
                city: clientD?.city ?? raw.clientAddress?.city ?? '',
                state: clientD?.region ?? raw.clientAddress?.state ?? '',
                zipCode: clientD?.postalCode ?? raw.clientAddress?.zipCode ?? '',
                country: clientD?.country ?? raw.clientAddress?.country ?? ''
              },
          items,
          attachedFiles: raw.attachedFiles || [],
          ccClients: raw.ccClients || [],
          chainId: raw.paymentSettings?.chainId || raw.chainId,
          tokenAddress: raw.paymentSettings?.tokenAddress || raw.tokenAddress,
          withholdingTaxEnabled: (raw.withholdingTaxAmount != null && raw.withholdingTaxAmount > 0),
          withholdingTaxRatePercent: Number(raw.withholdingTaxRatePercent) || 5,
          subtotal: round2(Number(raw.subtotal) ?? 0),
          totalTax: round2(Number(raw.totalTax) ?? 0),
          total: round2(Number(raw.total) ?? 0)
        };
        setFormData(loadedData);
        setIsEditing(true);
      }
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // router and setFormData are stable, no need to include

  const loadServiceOnboardingData = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/service?service=smartInvoicing');
      const data = await response.json();
      
      if (data.success && data.data.serviceOnboarding) {
        const onboardingData = data.data.serviceOnboarding;
        const showWithholding = onboardingData.invoiceSettings?.showWithholdingTaxOnInvoices ?? false;
        const ratePercent = Number(onboardingData.invoiceSettings?.withholdingTaxRatePercent) || 5;
        const rate = ratePercent / 100;

        // Update form data with service onboarding information
        setFormData(prev => {
          const finalCountry = onboardingData.businessInfo?.address?.country || prev.companyAddress.country;
          const sub = prev.subtotal ?? 0;
          const tax = prev.totalTax ?? 0;
          const totalBeforeWithholding = sub + tax;
          const withholdingAmount = showWithholding ? totalBeforeWithholding * rate : 0;
          const newTotal = totalBeforeWithholding - withholdingAmount;

          return {
            ...prev,
            companyName: onboardingData.businessInfo?.name || prev.companyName,
            companyEmail: onboardingData.businessInfo?.email || prev.companyEmail,
            companyPhone: onboardingData.businessInfo?.phone || prev.companyPhone,
            companyAddress: {
              street: onboardingData.businessInfo?.address?.street || prev.companyAddress.street,
              city: onboardingData.businessInfo?.address?.city || prev.companyAddress.city,
              state: onboardingData.businessInfo?.address?.state || prev.companyAddress.state,
              zipCode: onboardingData.businessInfo?.address?.zipCode || prev.companyAddress.zipCode,
              country: finalCountry
            },
            companyTaxNumber: onboardingData.businessInfo?.taxId || prev.companyTaxNumber,
            currency: (!userHasSelectedCurrency && onboardingData.invoiceSettings?.defaultCurrency)
              ? onboardingData.invoiceSettings.defaultCurrency
              : prev.currency,
            withholdingTaxEnabled: showWithholding,
            withholdingTaxRatePercent: ratePercent,
            total: showWithholding ? newTotal : prev.total
          };
        });
      }
    } catch (error) {
      console.error('Error loading service onboarding data:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setFormData and userHasSelectedCurrency are stable, no need to include

  // Load saved payment methods - memoized to prevent infinite re-renders
  const loadSavedPaymentMethods = useCallback(async () => {
    try {
      const response = await fetch('/api/payment-methods');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSavedPaymentMethods(data.paymentMethods || []);
        }
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  }, []); // Empty deps - only load once on mount

  const loadOrganizationData = useCallback(async () => {
    try {
      const response = await fetch('/api/user/settings');
      const data = await response.json();
      
      if (data.success && data.data?.organization) {
        const org = data.data.organization;
        setFormData(prev => {
          const finalCountry = org.address?.country && org.address.country !== 'US' ? org.address.country : prev.companyAddress.country;
          
          return {
            ...prev,
            companyName: org.name || prev.companyName,
            companyEmail: org.billingEmail || org.email || prev.companyEmail,
            companyPhone: org.phone || prev.companyPhone,
            companyAddress: {
              street: org.address?.street || prev.companyAddress.street,
              city: org.address?.city || prev.companyAddress.city,
              state: org.address?.state || prev.companyAddress.state,
              zipCode: org.address?.zipCode || prev.companyAddress.zipCode,
              country: finalCountry
            }
          };
        });
      }
    } catch (error) {
      console.error('Failed to load organization data:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setFormData is stable from useState, no need to include

  const loadLogoFromSettings = useCallback(async () => {
    try {
      
      const response = await fetch('/api/user/logo');
      const data = await response.json();
      
      if (data.success && data.logoUrl) {
        setFormData(prev => ({
          ...prev,
          companyLogo: data.logoUrl
        }));
        
      } else {
        console.log('⚠️ [Invoice Create] No logo in settings, trying logos API...');
        // If no logo is set in settings, try to load from logos API
        const logosResponse = await fetch('/api/user/logos');
        const logosData = await logosResponse.json();
        
        if (logosData.success && logosData.logos && logosData.logos.length > 0) {
          const defaultLogo = logosData.logos.find((logo: {isDefault: boolean, url: string}) => logo.isDefault) || logosData.logos[0];
          setFormData(prev => ({
            ...prev,
            companyLogo: defaultLogo.url
          }));
          console.log('✅ [Invoice Create] Logo loaded from logos API');
        } else {
          console.log('⚠️ [Invoice Create] No logos found in any API');
        }
      }
    } catch (error) {
      console.error('❌ [Invoice Create] Failed to load logo from settings:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setFormData is stable from useState, no need to include

  const loadClients = useCallback(async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      if (data.success && data.data) {
        setClients(data.data);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  }, []);

  // Track if initial load has been done to prevent re-renders
  const initialLoadDone = useRef(false);
  const lastUserId = useRef<string | undefined>(undefined);
  const companyDataLoaded = useRef(false); // Track if company data has been loaded from server
  const loadedInvoiceIdRef = useRef<string | null>(null); // Prevent duplicate GET /api/invoices/[id]
  const hasResetForNewInvoiceRef = useRef(false);

  useEffect(() => {
    // When pre-filling from PDF draft (or just finished loading one), only load payment methods; don't overwrite company/client/items
    if (fromPdfDraftId || pdfDraftLoadDone.current) {
      loadSavedPaymentMethods();
      return;
    }
    const currentUserId = session?.user?.id;
    if (invoiceId) {
      hasResetForNewInvoiceRef.current = false;
      // Already loaded this draft – avoid duplicate GET /api/invoices/[id]; payment methods already loaded
      if (loadedInvoiceIdRef.current === invoiceId) {
        return;
      }
      loadedInvoiceIdRef.current = invoiceId;
      initialLoadDone.current = true;
      companyDataLoaded.current = true;
      loadInvoice(invoiceId);
      loadSavedPaymentMethods();
      loadClients();
      loadLogoFromSettings();
      return;
    }
    loadedInvoiceIdRef.current = null;
    // Create new invoice (no ?id=): if form still has a draft _id from a previous session, reset to fresh so "Create invoice" is clean
    if (currentUserId && formData._id && !hasResetForNewInvoiceRef.current) {
      hasResetForNewInvoiceRef.current = true;
      const companyPreserved = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyPhone: formData.companyPhone,
        companyAddress: formData.companyAddress,
        companyTaxNumber: formData.companyTaxNumber,
        companyLogo: formData.companyLogo
      };
      clearSavedData();
      setFormData({ ...defaultInvoiceData, ...companyPreserved });
      loadSavedPaymentMethods();
      loadClients();
      loadLogoFromSettings();
      return;
    }
    if (currentUserId) {
      // CRITICAL: Always load company data when creating new invoice (not editing)
      // Check if company data is missing, and if so, load it
      const hasCompanyData = formData.companyName && formData.companyName.trim() !== '';
      
      if (!hasCompanyData || currentUserId !== lastUserId.current) {
        // User changed or company data is missing - load it
        // When user changes, reset initialLoadDone so we run loadClients/loadLogo for the new user
        if (currentUserId !== lastUserId.current) {
          lastUserId.current = currentUserId;
          initialLoadDone.current = false;
        }
        
        // Always load company data if it's missing, even if initialLoadDone is true
        // This ensures company data loads when returning to the page after sending invoice
        loadServiceOnboardingData();
        loadOrganizationData();
        companyDataLoaded.current = true;
        
        // Always load payment methods - they should be available every time
        loadSavedPaymentMethods();
        
        // Only load clients and logo once per user session (initialLoadDone was false on first run or after user change)
        if (!initialLoadDone.current) {
          loadClients();
          loadLogoFromSettings();
          initialLoadDone.current = true;
        }
      }
    }
  // clearSavedData/setFormData are from hook and used only for "reset for new invoice"; omit to avoid effect running every render
  // eslint-disable-next-line react-hooks/exhaustive-deps -- invoiceId, formData._id, session, loaders are the intended triggers
  }, [invoiceId, fromPdfDraftId, session?.user?.id, formData.companyName, formData.companyAddress, formData.companyEmail, formData.companyLogo, formData.companyPhone, formData.companyTaxNumber, formData._id, loadInvoice, loadServiceOnboardingData, loadOrganizationData, loadClients, loadLogoFromSettings, loadSavedPaymentMethods]);

  // When arriving from PDF upload: load draft and pre-fill create form (items, client, company, etc.). Use documentAst when invoiceData is empty.
  useEffect(() => {
    if (!fromPdfDraftId) return;
    if (lastLoadedPdfDraftId.current === fromPdfDraftId && pdfDraftLoadDone.current) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await getInvoiceDraft(fromPdfDraftId);
        if (cancelled || !result.success || !result.data) return;
        const raw = (result.data.invoiceData || {}) as Record<string, unknown>;
        const ast = result.data.documentAst as { meta?: { title?: string; reference_numbers?: Record<string, string> }; parties?: { issuer?: string; recipient?: string }; dates?: { due?: string; signed?: string }; items?: Array<{ label?: string; quantity?: number; unit_price?: number }> } | null | undefined;
        const toDateStr = (v: unknown) => {
          if (v == null) return '';
          const d = v instanceof Date ? v : new Date(String(v));
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        };
        const company = (raw.companyDetails as Record<string, string> | undefined) ?? {};
        const client = (raw.clientDetails as Record<string, string> | undefined) ?? {};
        // Items: prefer mapped draft invoiceData.items (includes any preset prices),
        // otherwise fall back to documentAst.items (parser = source of truth for description)
        let items: Array<{ id: string; description: string; quantity: number; unitPrice: number; discount: number; tax: number; amount: number }>;
        const astItems = ast?.items ?? [];
        const draftItems = Array.isArray(raw.items) ? raw.items as Array<{ description?: string; quantity?: number; unitPrice?: number; total?: number; taxRate?: number }> : [];
        if (draftItems.length > 0) {
          items = draftItems.map((item, i) => {
            const qty = Math.max(0, Math.round(Number(item.quantity) || 1));
            const up = round2(Number(item.unitPrice) ?? 0);
            const amount = round2((item.total ?? qty * up) as number);
            return {
              id: String(i + 1),
              description: String(item.description ?? '').trim(),
              quantity: qty,
              unitPrice: up,
              discount: 0,
              tax: round2(Number(item.taxRate) ?? 0),
              amount,
            };
          });
        } else if (astItems.length > 0) {
          items = astItems.map((item, i) => {
            const qty = Math.max(0, Math.round(Number(item.quantity) || 1));
            const up = round2(Number(item.unit_price) ?? 0);
            const desc = String(item.label ?? '').trim();
            return {
              id: String(i + 1),
              description: desc,
              quantity: qty,
              unitPrice: up,
              discount: 0,
              tax: 0,
              amount: round2(qty * up),
            };
          });
        } else {
          items = defaultInvoiceData.items;
        }
        const subtotal = round2(Number(raw.subtotal) ?? items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0));
        const totalAmount = round2(Number(raw.totalAmount) ?? subtotal);
        const totalTax = round2(Number((raw as Record<string, unknown>).totalTax) ?? Math.max(0, totalAmount - subtotal));
        const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0;
        const safeTotal = Number.isFinite(totalAmount) ? totalAmount : 0;
        const safeTotalTax = Number.isFinite(totalTax) ? totalTax : 0;
        const invoiceNumber = (raw.invoiceNumber as string) || ''; // We generate; only pre-fill if mapping set it
        const invoiceName = (raw.invoiceTitle as string) || ast?.meta?.reference_numbers?.task_order || ast?.meta?.title || defaultInvoiceData.invoiceName;
        const currency = (raw.currency as string) || 'USD';
        const issueDate = toDateStr(raw.issueDate) || (ast?.dates?.signed ? toDateStr(ast.dates.signed) : '') || defaultInvoiceData.issueDate;
        const dueDate = toDateStr(raw.dueDate) || (ast?.dates?.due ? toDateStr(ast.dates.due) : '') || defaultInvoiceData.dueDate;
        const companyName = company.name ?? ast?.parties?.issuer ?? '';
        const clientName = client.name ?? ast?.parties?.recipient ?? '';
        setFormData(prev => ({
          ...prev,
          invoiceNumber: invoiceNumber || prev.invoiceNumber,
          invoiceName: invoiceName || prev.invoiceName,
          currency: currency || prev.currency,
          issueDate: issueDate || prev.issueDate,
          dueDate: dueDate || prev.dueDate,
          companyName: companyName || prev.companyName,
          companyEmail: company.email ?? prev.companyEmail,
          companyPhone: company.phone ?? prev.companyPhone,
          clientName: clientName || prev.clientName,
          clientEmail: client.email ?? prev.clientEmail,
          clientPhone: client.phone ?? prev.clientPhone,
          items,
          subtotal: safeSubtotal,
          totalTax: safeTotalTax,
          total: safeTotal,
          memo: (raw.notes as string) ?? prev.memo,
        }));
        lastLoadedPdfDraftId.current = fromPdfDraftId;
        pdfDraftLoadDone.current = true;
        router.replace('/dashboard/services/smart-invoicing/create');
      } catch (e) {
        console.error('Failed to load PDF draft into create form:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromPdfDraftId, router, setFormData]);

  // When arriving from ClickUp: load selected tasks from sessionStorage and pre-fill line items
  useEffect(() => {
    if (!fromClickUp || clickUpLoadDone.current) return;
    try {
      const stored = sessionStorage.getItem('clickUpPrefillItems');
      sessionStorage.removeItem('clickUpPrefillItems');
      if (!stored) return;
      const raw = JSON.parse(stored) as Array<{ id: string; name: string; listName?: string; spaceName?: string }>;
      if (!Array.isArray(raw) || raw.length === 0) return;
      const items = raw.map((t, i) => {
        const desc = [t.name, t.spaceName, t.listName].filter(Boolean).join(' › ');
        return {
          id: String(i + 1),
          description: desc || t.name,
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          amount: 0,
        };
      });
      const subtotal = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unitPrice ?? 0), 0);
      setFormData(prev => ({
        ...prev,
        items,
        subtotal: round2(subtotal),
        totalTax: 0,
        total: round2(subtotal),
      }));
      clickUpLoadDone.current = true;
      router.replace('/dashboard/services/smart-invoicing/create');
    } catch (e) {
      console.error('Failed to load ClickUp prefill:', e);
    }
  }, [fromClickUp, router, setFormData]);

  // Set client country to user's country if client country is empty and user has a country
  // This only runs once when session becomes available and formData is initialized
  const hasSetClientCountry = useRef(false);
  useEffect(() => {
    if (
      session?.user?.address?.country && 
      !formData.clientAddress.country && 
      !invoiceId &&
      !hasSetClientCountry.current
    ) {
      hasSetClientCountry.current = true;
      setFormData(prev => ({
        ...prev,
        clientAddress: {
          ...prev.clientAddress,
          country: session.user.address.country
        }
      }));
    }
  }, [session?.user?.address?.country, formData.clientAddress.country, invoiceId, setFormData]);

    // Monitor formData changes for debugging (disabled during sending)
  useEffect(() => {
    if (!sendingInvoice) {
      // FormData updated with logo
    }
  }, [formData.companyLogo, sendingInvoice]);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.currency-dropdown-container')) {
        setShowCurrencyDropdown(false);
        setCurrencySearch('');
      }
      if (!target.closest('.network-dropdown-container')) {
        setShowNetworkDropdown(false);
        setNetworkSearch('');
      }
      if (!target.closest('.download-dropdown-container')) {
        setShowDownloadDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (field: keyof InvoiceFormData, value: string | number | boolean | Record<string, string>) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Track when user manually selects a currency
      if (field === 'currency') {
        setUserHasSelectedCurrency(true);
        
        // Only auto-switch payment method if this is NOT an auto-selection
        if (!isAutoSelectingCurrency) {
          // Check if the selected currency is a cryptocurrency
          const selectedCurrency = getCurrencyByCode(value as string);
          if (selectedCurrency && selectedCurrency.type === 'crypto') {
            // Automatically switch payment method to crypto for cryptocurrencies
            updated.paymentMethod = 'crypto';
            // Set the appropriate network for the cryptocurrency
            if (selectedCurrency.network) {
              // Find the network by name and set the network ID
              const matchingNetwork = networks.find(network => network.name === selectedCurrency.network);
              if (matchingNetwork) {
                updated.paymentNetwork = matchingNetwork.id;
                // Clear chainId and tokenAddress if not Celo
                if (matchingNetwork.id !== 'celo') {
                  updated.chainId = undefined;
                  updated.tokenAddress = undefined;
                } else {
                  // Set chainId and sync tokenAddress based on currency
                  updated.chainId = 42220;
                  // Sync tokenAddress with currency selection for Celo tokens
                  const currencyCode = String(value).toUpperCase();
                  if (currencyCode === 'CELO') {
                    updated.tokenAddress = 'native';
                  } else if (currencyCode === 'USDT') {
                    updated.tokenAddress = CELO_TOKENS.USDT.address;
                  } else if (currencyCode === 'CUSD') {
                    updated.tokenAddress = CELO_TOKENS.cUSD.address;
                  } else {
                    // Default to cUSD for other Celo currencies
                    updated.tokenAddress = CELO_TOKENS.cUSD.address;
                  }
                }
              }
            }
          } else if (selectedCurrency && selectedCurrency.type === 'fiat') {
            // Automatically switch payment method to fiat for fiat currencies
            updated.paymentMethod = 'fiat';
            // Clear the payment network and chain/token fields for fiat currencies
            updated.paymentNetwork = '';
            updated.chainId = undefined;
            updated.tokenAddress = undefined;
          }
        } else {
        }
      }
      
      // Sync currency when token is selected (if Celo network is active)
      // This MUST happen BEFORE any other currency logic to prevent resets
      if (field === 'tokenAddress' && updated.paymentNetwork === 'celo' && value) {
        // Immediately set the flag to prevent ANY auto-select from interfering
        setUserHasSelectedCurrency(true);
        setIsAutoSelectingCurrency(true);
        
        if (String(value) === CELO_TOKENS.USDT.address) {
          updated.currency = 'USDT';
        } else if (String(value) === CELO_TOKENS.cUSD.address) {
          updated.currency = 'CUSD';
        }
        
        // Keep the flag set longer to prevent any race conditions
        setTimeout(() => {
          setIsAutoSelectingCurrency(false);
          // Ensure the flag stays true - user has selected via token
          setUserHasSelectedCurrency(true);
        }, 500);
      }
      
      // Sync tokenAddress when network changes to Celo (if currency is a Celo token)
      if (field === 'paymentNetwork' && value === 'celo') {
        updated.chainId = 42220;
        // Sync tokenAddress based on current currency
        const currentCurrency = String(updated.currency || '').toUpperCase();
        if (currentCurrency === 'USDT') {
          updated.tokenAddress = CELO_TOKENS.USDT.address;
        } else if (currentCurrency === 'CUSD') {
          updated.tokenAddress = CELO_TOKENS.cUSD.address;
        } else {
          // Default to cUSD if currency doesn't match
          updated.tokenAddress = CELO_TOKENS.cUSD.address;
        }
      }
      
      return updated;
    });
  };

  const handleFiatPaymentSubtypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      fiatPaymentSubtype: value as 'bank' | 'mpesa_paybill' | 'mpesa_till' | 'phone',
      // Only automatically change currency for M-Pesa payments if user hasn't manually selected a currency
      // or if they're switching from M-Pesa back to bank transfer, preserve their previous currency
      currency: (value === 'mpesa_paybill' || value === 'mpesa_till') 
        ? 'KES' 
        : (prev.fiatPaymentSubtype === 'mpesa_paybill' || prev.fiatPaymentSubtype === 'mpesa_till')
          ? (userHasSelectedCurrency ? prev.currency : 'USD') // Preserve user selection or default to USD
          : prev.currency
    }));
  };

  const handleBankSelect = (bank: Bank | null) => {
    if (bank) {
      // Bank selected from list
      setFormData(prev => ({
        ...prev,
        bankName: bank.name,
        swiftCode: bank.swift_code,
        bankCode: bank.bank_code || ''
      }));
      setIsCustomBank(false);
      setShowCustomBankFields(false);
    } else {
      // Custom bank - user is typing custom bank name
      setIsCustomBank(true);
    }
  };

  // Check if bank name is custom (not in the list) – only refetch when country or name actually changed
  const lastBanksSearchRef = useRef<{ country: string; name: string }>({ country: '', name: '' });
  useEffect(() => {
    const country = formData.bankCountryCode || '';
    const name = (formData.bankName || '').trim();
    if (!name || !country) {
      setIsCustomBank(false);
      setShowCustomBankFields(false);
      return;
    }
    if (lastBanksSearchRef.current.country === country && lastBanksSearchRef.current.name === name) {
      return;
    }
    lastBanksSearchRef.current = { country, name };

    let cancelled = false;
    const checkIfCustomBank = async () => {
      try {
        const response = await fetch(`/api/banks/search?country=${country}`);
        if (cancelled) return;
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          const banks = (data.data?.banks || []) as Bank[];
          const isInList = banks.some(bank =>
            bank.name.toLowerCase().trim() === name.toLowerCase()
          );
          if (!cancelled) {
            setIsCustomBank(!isInList);
            if (isInList) setShowCustomBankFields(false);
          }
        }
      } catch {
        if (!cancelled) setIsCustomBank(!!name);
      }
    };
    checkIfCustomBank();
    return () => { cancelled = true; };
  }, [formData.bankName, formData.bankCountryCode]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    setFormData(prev => ({
      ...prev,
      attachedFiles: [...(prev.attachedFiles || []), ...validFiles]
    }));
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachedFiles: (prev.attachedFiles || []).filter((_, i) => i !== index)
    }));
  };



  const selectClient = (client: Client) => {
    // Parse the address string to extract components
    let street = client.address || '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = '';

    if (client.address) {
      const addressParts = client.address.split(',').map(part => part.trim());
      if (addressParts.length >= 4) {
        street = addressParts[0];
        city = addressParts[1];
        const stateZip = addressParts[2].split(' ');
        if (stateZip.length >= 2) {
          state = stateZip.slice(0, -1).join(' ');
          zipCode = stateZip[stateZip.length - 1];
        } else {
          state = addressParts[2];
        }
        country = addressParts[3];
      } else if (addressParts.length === 3) {
        street = addressParts[0];
        city = addressParts[1];
        const stateZip = addressParts[2].split(' ');
        if (stateZip.length >= 2) {
          state = stateZip.slice(0, -1).join(' ');
          zipCode = stateZip[stateZip.length - 1];
        } else {
          state = addressParts[2];
        }
      } else if (addressParts.length === 2) {
        street = addressParts[0];
        city = addressParts[1];
      }
    }

    setFormData(prev => ({
      ...prev,
      clientName: client.name,
      clientCompany: client.company || '',
      clientEmail: client.email,
      clientPhone: client.phone || '',
      clientAddress: {
        street,
        city,
        state,
        zipCode,
        country
      }
    }));

    // Auto-detect best sending method after client selection
    // WhatsApp is disabled, so always use email
    setTimeout(() => {
      // Force email mode since WhatsApp is disabled
      setFormData(prev => ({ ...prev, sendViaWhatsapp: false }));
    }, 100);
    setShowClientSelector(false);
  };

  const createNewClient = () => {
    setShowNewClientModal(true);
    setShowClientSelector(false);
  };

  // CC Client functions
  const selectCcClient = (client: Client) => {
    // Check if client is already in CC list
    const isAlreadyCc = formData.ccClients?.some(cc => cc.email === client.email);
    if (isAlreadyCc) {
      toast.error('This client is already in the CC list.');
      return;
    }

    // Check if client is the primary client
    if (formData.clientEmail === client.email) {
      toast.error('This client is already the primary recipient.');
      return;
    }

    const newCcClient = {
      _id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      address: client.address
    };

    setFormData(prev => ({
      ...prev,
      ccClients: [...(prev.ccClients || []), newCcClient]
    }));

    setShowCcClientSelector(false);
  };

  const removeCcClient = (email: string) => {
    setFormData(prev => ({
      ...prev,
      ccClients: prev.ccClients?.filter(cc => cc.email !== email) || []
    }));
  };

  const createNewCcClient = () => {
    setShowCcClientCreationModal(true);
    setShowCcClientSelector(false);
  };

  const handleCreateClient = async (clientData: Omit<Client, '_id'>) => {
    try {
      setCreatingClient(true);
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });
      const data = await response.json();
      if (data.success) {
        await loadClients();
        selectClient(data.data);
        setShowNewClientModal(false);
      } else {
        toast.error(data.message || 'Failed to create client');
      }
    } catch (error) {
      console.error('Failed to create client:', error);
      toast.error('Failed to create client. Please try again.');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleCreateCcClient = async (clientData: Omit<Client, '_id'>) => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });
      const data = await response.json();
      if (data.success) {
        await loadClients();
        selectCcClient(data.data);
        setShowCcClientCreationModal(false);
      }
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    // Description is a string; keep it as-is
    if (field === 'description') {
      newItems[index] = { ...newItems[index], description: String(value ?? '') };
    } else {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      // Round monetary/percent inputs so 500 stays 500 (no float drift)
      const rounded =
        field === 'unitPrice' || field === 'discount' || field === 'tax' ? round2(numValue) :
        field === 'quantity' ? Math.max(0, Math.round(numValue)) : numValue;
      newItems[index] = { ...newItems[index], [field]: rounded };
    }

    const item = newItems[index];
    const subtotalBeforeTax = round2(item.quantity * item.unitPrice * (1 - item.discount / 100));
    item.amount = round2(subtotalBeforeTax * (1 + item.tax / 100));

    let subtotal = 0;
    let totalTax = 0;
    newItems.forEach(i => {
      const itemSubtotal = round2(i.quantity * i.unitPrice * (1 - i.discount / 100));
      const itemTax = round2(itemSubtotal * (i.tax / 100));
      subtotal += itemSubtotal;
      totalTax += itemTax;
    });
    subtotal = round2(subtotal);
    totalTax = round2(totalTax);

    setFormData(prev => {
      const totalBeforeWithholding = round2(subtotal + totalTax);
      const rate = (prev.withholdingTaxRatePercent ?? 5) / 100;
      const withholdingAmount = (prev.withholdingTaxEnabled ?? false) ? round2(totalBeforeWithholding * rate) : 0;
      const total = round2(totalBeforeWithholding - withholdingAmount);
      return {
        ...prev,
        items: newItems,
        subtotal,
        totalTax,
        total
      };
    });
  };

  const addItem = () => {
    const newItem = {
      id: (formData.items.length + 1).toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      amount: 0
    };
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      let subtotal = 0;
      let totalTax = 0;
      newItems.forEach(item => {
        const itemSubtotal = round2(item.quantity * item.unitPrice * (1 - item.discount / 100));
        const itemTax = round2(itemSubtotal * (item.tax / 100));
        subtotal += itemSubtotal;
        totalTax += itemTax;
      });
      subtotal = round2(subtotal);
      totalTax = round2(totalTax);

      setFormData(prev => {
        const totalBeforeWithholding = round2(subtotal + totalTax);
        const rate = (prev.withholdingTaxRatePercent ?? 5) / 100;
        const withholdingAmount = (prev.withholdingTaxEnabled ?? false) ? round2(totalBeforeWithholding * rate) : 0;
        const total = round2(totalBeforeWithholding - withholdingAmount);
        return {
          ...prev,
          items: newItems,
          subtotal,
          totalTax,
          total
        };
      });
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const url = isEditing ? `/api/invoices/${formData._id}` : '/api/invoices';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeInvoicePayload(formData, {
          status: 'draft',
          withholdingTaxAmount: formData.withholdingTaxEnabled ? round2(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)) : 0,
          withholdingTaxRatePercent: formData.withholdingTaxEnabled ? (formData.withholdingTaxRatePercent ?? 5) : undefined
        }))
      });

      const data = response.ok ? await response.json() : null;
      const success = response.ok && data?.success;

      if (!success) {
        const message = data?.message || data?.error || `Save failed (${response.status})`;
        toast.error(message);
        return;
      }

      toast.success('Draft saved.');
      // Preserve company (From) in localStorage so next time they open Create invoice the form is fresh but keeps their details
      const companyPreserved = {
        companyName: formData.companyName,
        companyEmail: formData.companyEmail,
        companyPhone: formData.companyPhone,
        companyAddress: formData.companyAddress,
        companyTaxNumber: formData.companyTaxNumber,
        companyLogo: formData.companyLogo
      };
      clearSavedData();
      setFormData({ ...defaultInvoiceData, ...companyPreserved });
      setIsEditing(false);
      router.replace('/dashboard/services/smart-invoicing');
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    const errors = validateInvoiceForPdf();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    setSendingInvoice(true);

    try {
      // Starting invoice email send...

      let primaryInvoiceId: string;
      let primaryInvoiceNumber: string;

      // If this is a draft invoice (has _id), update it instead of creating new
      if (formData._id) {
        // Updating draft invoice (do not set status to 'sent' if invoice is pending_approval – API will reject)
        const updateResponse = await fetch(`/api/invoices/${formData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeInvoicePayload(formData, {
            status: 'sent',
            withholdingTaxAmount: formData.withholdingTaxEnabled ? round2(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)) : 0
          }))
        });

        const updateData = await updateResponse.json();

        if (updateResponse.ok && updateData.success) {
          primaryInvoiceId = updateData.invoice._id;
          primaryInvoiceNumber = updateData.invoice.invoiceNumber;
        } else if (updateResponse.status === 403 && updateData.message && String(updateData.message).toLowerCase().includes('pending approval')) {
          // Invoice is pending approval – API rejected setting status to 'sent'; use existing id and continue to send (send will return requiresApproval)
          primaryInvoiceId = formData._id;
          primaryInvoiceNumber = formData.invoiceNumber || '';
        } else if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('❌ [Smart Invoicing] Update invoice response error:', errorText);
          throw new Error(updateData.message || `Failed to update invoice: ${updateResponse.status}`);
        } else {
          throw new Error(updateData.message || 'Failed to update invoice');
        }
      } else {
        // Create new invoice
        // Creating new invoice...

        const primaryInvoiceResponse = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeInvoicePayload(formData, {
            status: 'sent',
            withholdingTaxAmount: formData.withholdingTaxEnabled ? round2(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)) : 0
          }))
        });

        // Primary invoice response status received

        if (!primaryInvoiceResponse.ok) {
          const errorText = await primaryInvoiceResponse.text();
          console.error('❌ [Smart Invoicing] Primary invoice response error:', errorText);
          throw new Error(`Failed to save primary invoice: ${primaryInvoiceResponse.status} ${errorText}`);
        }

        const primaryInvoiceData = await primaryInvoiceResponse.json();
        // Primary invoice response received

        if (!primaryInvoiceData.success) {
          throw new Error(`Failed to save invoice: ${primaryInvoiceData.message}`);
        }

        primaryInvoiceId = primaryInvoiceData.invoice._id;
        primaryInvoiceNumber = primaryInvoiceData.invoice.invoiceNumber;

        // Primary invoice saved successfully
      }

      // Update formData with the new invoice number and ID
      setFormData(prev => ({
        ...prev,
        _id: primaryInvoiceId,
        invoiceNumber: primaryInvoiceNumber
      }));

      // If there are CC clients, create CC invoices
      if (formData.ccClients && formData.ccClients.length > 0) {
        const ccInvoiceResponse = await fetch('/api/invoices/cc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryInvoiceId,
            primaryInvoiceNumber,
            ccClients: formData.ccClients,
            invoiceData: normalizeInvoicePayload(formData, { status: 'sent' })
          })
        });

        if (!ccInvoiceResponse.ok) {
          throw new Error('Failed to create CC invoices');
        }

        await ccInvoiceResponse.json();
      }

      // Generate professional vector PDF (react-pdf) — use actual invoice number from API
      const pdfBase64 = await generateInvoicePdfBase64(formData, primaryInvoiceNumber);
      console.log('📄 [PDF Generation] PDF size:', (pdfBase64.length / 1024).toFixed(2), 'KB');
      
      // Sending invoice via email...
      
      console.log('📄 [PDF Generation] Converting attached files to base64...');
      const filesStartTime = Date.now();
      
      // Convert attached files to base64
      const attachedFilesBase64 = await Promise.all(
        (formData.attachedFiles || []).map(async (file) => {
          return new Promise<{ filename: string; content: string; contentType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({
                filename: file.name,
                content: base64,
                contentType: file.type
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );
      
      const filesEndTime = Date.now();
      console.log('📄 [PDF Generation] File attachments conversion completed in', filesEndTime - filesStartTime, 'ms');

      let result: { success: boolean; messageId?: string; error?: string; message?: string; requiresApproval?: boolean; status?: string };

      // WhatsApp is disabled - force email mode
      // TODO: Remove this check when re-enabling WhatsApp
      if (false && formData.sendViaWhatsapp) {
        // Send via WhatsApp
        console.log('📱 [WhatsApp Sending] ========== STARTING WHATSAPP SEND FROM FRONTEND ==========');
        console.log('📱 [WhatsApp Sending] Input parameters:', {
          invoiceId: primaryInvoiceId,
          clientPhone: formData.clientPhone,
          phoneLength: formData.clientPhone?.length || 0,
          pdfBase64Length: pdfBase64?.length || 0,
          pdfBase64Preview: pdfBase64?.substring(0, 50) || 'EMPTY',
          invoiceNumber: formData.invoiceNumber,
          clientName: formData.clientName,
          companyName: formData.companyName
        });
        
        const whatsappStartTime = Date.now();
        
        try {
          result = await sendInvoiceWhatsApp(
            primaryInvoiceId,
            formData.clientPhone,
            pdfBase64
          );
          
          const whatsappEndTime = Date.now();
          const whatsappDuration = whatsappEndTime - whatsappStartTime;
          
          console.log('📱 [WhatsApp Sending] WhatsApp request completed in', whatsappDuration, 'ms');
          console.log('📱 [WhatsApp Sending] Result:', {
            success: result.success,
            messageId: result.messageId,
            error: result.error
          });
        } catch (err: unknown) {
          const whatsappEndTime = Date.now();
          const whatsappDuration = whatsappEndTime - whatsappStartTime;
          
          // Helper function to safely extract error message
          const getErrorMessage = (error: unknown): string => {
            if (error instanceof Error) {
              return error.message;
            }
            if (typeof error === 'string') {
              return error as string;
            }
            return String(error);
          };
          
          // Helper function to safely extract error stack
          const getErrorStack = (error: unknown): string | undefined => {
            return error instanceof Error ? error.stack : undefined;
          };
          
          // Helper function to safely extract error name
          const getErrorName = (error: unknown): string | undefined => {
            return error instanceof Error ? error.name : undefined;
          };
          
          const errorMessage = getErrorMessage(err);
          const errorStack = getErrorStack(err);
          const errorName = getErrorName(err);
          
          console.error('📱 [WhatsApp Sending] ❌ Frontend error after', whatsappDuration, 'ms:', {
            error: errorMessage,
            stack: errorStack,
            name: errorName
          });
          
          result = {
            success: false,
            error: errorMessage
          };
        }
        
        console.log('📱 [WhatsApp Sending] ========== WHATSAPP SEND FROM FRONTEND COMPLETED ==========');
      } else {
        // Send via Email
        console.log('📧 [Email Sending] Starting email request...');
        const emailStartTime = Date.now();
        
        // Send invoice via email with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        const response = await fetch('/api/invoices/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: primaryInvoiceId,
            recipientEmail: formData.clientEmail,
            pdfBuffer: pdfBase64,
            attachedFiles: attachedFilesBase64
          }),
          signal: controller.signal
        });
        
        const emailEndTime = Date.now();
        console.log('📧 [Email Sending] Email request completed in', emailEndTime - emailStartTime, 'ms');

        clearTimeout(timeoutId);

        result = await response.json();
      }

      if (result.success) {
        console.log('✅ [Smart Invoicing] Invoice sent successfully:', {
          invoiceNumber: formData.invoiceNumber,
          recipient: formData.sendViaWhatsapp ? formData.clientPhone : formData.clientEmail,
          method: formData.sendViaWhatsapp ? 'WhatsApp' : 'Email',
          total: formData.total,
          messageId: result.messageId
        });
        
        const recipient = formData.sendViaWhatsapp ? formData.clientPhone : formData.clientEmail;
        toast.success(
          formData.sendViaWhatsapp
            ? `Invoice sent via WhatsApp to ${recipient}`
            : `Invoice sent to ${recipient}`
        );
        // Clear saved form data after successful send
        clearSavedData();
        // Redirect to invoices page
        router.push('/dashboard/services/smart-invoicing/invoices');
      } else if (result.requiresApproval === true || result.status === 'pending_approval') {
        // Invoice is pending approval – not a failure; tell the user clearly
        console.log('⏳ [Smart Invoicing] Invoice pending approval:', {
          invoiceNumber: formData.invoiceNumber,
          status: 'pending_approval'
        });
        toast.success(
          'This invoice is pending approval. It will be sent to the recipient once an approver approves it.'
        );
        clearSavedData();
        router.push('/dashboard/services/smart-invoicing/invoices');
      } else {
        console.error('❌ [Smart Invoicing] Failed to send invoice:', {
          error: result.error,
          message: result.message,
          invoiceNumber: formData.invoiceNumber,
          recipient: formData.sendViaWhatsapp ? formData.clientPhone : formData.clientEmail,
          method: formData.sendViaWhatsapp ? 'WhatsApp' : 'Email',
          fullResult: result
        });
        toast.error(`Failed to send invoice: ${result.message || result.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('❌ [Smart Invoicing] ========== EXCEPTION IN SEND INVOICE ==========');
      console.error('❌ [Smart Invoicing] Error details:', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ [Smart Invoicing] Request timed out');
          toast.error('Request timed out. Please try again or contact support if the issue persists.');
        } else {
          console.error('❌ [Smart Invoicing] Error:', error.message);
          toast.error(`Failed to send invoice: ${error.message}`);
        }
      } else {
        console.error('❌ [Smart Invoicing] Unknown error type');
        toast.error('Failed to send invoice. Please try again.');
      }
    } finally {
      console.log('📱 [Smart Invoicing] Cleaning up - setting sendingInvoice to false');
      setSendingInvoice(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getCurrencySymbol = () => {
    return getCurrencyByCode(formData.currency)?.symbol || '€';
  };

  const renderEditableField = (
    field: string,
    value: string,
    placeholder: string,
    className: string = "text-3xl font-bold text-gray-900"
  ) => {
    return editingField === field ? (
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(field as keyof InvoiceFormData, e.target.value)}
        onBlur={() => setEditingField(null)}
        className={`${className} border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-500 outline-none`}
        autoFocus
      />
    ) : (
      <button
        onClick={() => setEditingField(field)}
        className={`${className} hover:bg-gray-100 px-2 py-1 rounded flex items-center group`}
      >
        {value || placeholder}
        <Edit3 className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  const renderEditableDateField = (
    field: string,
    value: string,
    label: string,
    className: string = "text-sm text-gray-600"
  ) => {
    return editingField === field ? (
      <div className="flex items-center space-x-2">
        <input
          type="date"
          value={value}
          onChange={(e) => handleInputChange(field as keyof InvoiceFormData, e.target.value)}
          onBlur={() => setEditingField(null)}
          className={`${className} border border-gray-300 rounded px-2 py-1 bg-white text-xs sm:text-sm`}
          autoFocus
        />
      </div>
    ) : (
      <button
        onClick={() => setEditingField(field)}
        className={`${className} hover:bg-gray-100 px-2 py-1 rounded flex items-center group touch-manipulation`}
      >
        <span className="text-xs sm:text-sm">{label} {formatDate(value)}</span>
        <Edit3 className="h-3 w-3 ml-1 sm:ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };



  const validateInvoiceForPdf = () => {
    const errors: string[] = [];
    
    // Required fields validation
    if (!formData.invoiceName || formData.invoiceName.trim() === '') {
      errors.push('Invoice name is required');
    }
    if (!formData.companyName || formData.companyName.trim() === '') {
      errors.push('Company name is required');
    }
    if (!formData.clientName || formData.clientName.trim() === '') {
      errors.push('Client name is required');
    }
    if (!formData.companyAddress.street || formData.companyAddress.street.trim() === '') {
      errors.push('Company address is required');
    }
    // Client address is now optional - removed validation check
    
    // Contact information validation - require at least one contact method
    const hasEmail = formData.clientEmail && formData.clientEmail.trim() !== '';
    const hasPhone = formData.clientPhone && formData.clientPhone.trim() !== '';
    
    if (!hasEmail && !hasPhone) {
      errors.push('At least one contact method (email or phone) is required');
    } else {
      // Validate based on selected sending method
      // WhatsApp is disabled - always validate email
      // TODO: Re-enable WhatsApp validation when WhatsApp is re-enabled
      if (false && formData.sendViaWhatsapp) {
        // WhatsApp mode: phone number is required and must be valid format
        if (!hasPhone) {
          errors.push('Phone number is required for WhatsApp sending');
        } else if (!validatePhoneForWhatsApp(formData.clientPhone)) {
          errors.push('Phone number must be in international format (e.g., +1234567890) for WhatsApp sending');
        }
      } else {
        // Email mode: email is required
        if (!hasEmail) {
          errors.push('Email address is required for email sending');
        }
      }
    }
    
    // Items validation
    const hasValidItems = formData.items.some((item: { description?: string; quantity?: number; unitPrice?: number }) => 
      String(item.description ?? '').trim() !== '' && 
      (item.quantity ?? 0) > 0 && (item.unitPrice ?? 0) > 0
    );
    if (!hasValidItems) {
      errors.push('At least one item with description, quantity, and unit price is required');
    }
    
    return errors;
  };

  const handleDownloadPdf = async () => {
    const errors = validateInvoiceForPdf();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    setSendingInvoice(true);

    try {
      console.log('📤 [Smart Invoicing] Starting PDF download...', {
        invoiceNumber: formData.invoiceNumber,
        clientEmail: formData.clientEmail,
        total: formData.total
      });

      let primaryInvoiceId: string;
      let primaryInvoiceNumber: string;

      // If this is a draft invoice (has _id), update it instead of creating new
      if (formData._id) {
        // Updating draft invoice (API will reject status 'sent' when invoice is pending_approval)
        const updateResponse = await fetch(`/api/invoices/${formData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeInvoicePayload(formData, {
            status: 'sent',
            withholdingTaxAmount: formData.withholdingTaxEnabled ? round2(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)) : 0
          }))
        });

        const updateData = await updateResponse.json();

        if (updateResponse.ok && updateData.success) {
          primaryInvoiceId = updateData.invoice._id;
          primaryInvoiceNumber = updateData.invoice.invoiceNumber;
        } else if (updateResponse.status === 403 && updateData.message && String(updateData.message).toLowerCase().includes('pending approval')) {
          primaryInvoiceId = formData._id;
          primaryInvoiceNumber = formData.invoiceNumber || '';
        } else if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('❌ [Smart Invoicing] Update invoice response error:', errorText);
          throw new Error(updateData.message || `Failed to update invoice: ${updateResponse.status}`);
        } else {
          throw new Error(updateData.message || 'Failed to update invoice');
        }
      } else {
        // Create new invoice
        const primaryInvoiceResponse = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeInvoicePayload(formData, {
            status: 'sent',
            withholdingTaxAmount: formData.withholdingTaxEnabled ? round2(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)) : 0
          }))
        });

        if (!primaryInvoiceResponse.ok) {
          const errorText = await primaryInvoiceResponse.text();
          console.error('❌ [Smart Invoicing] Create invoice response error:', errorText);
          throw new Error(`Failed to create invoice: ${primaryInvoiceResponse.status} ${errorText}`);
        }

        const primaryInvoiceData = await primaryInvoiceResponse.json();

        if (!primaryInvoiceData.success) {
          throw new Error(`Failed to create invoice: ${primaryInvoiceData.message}`);
        }

        primaryInvoiceId = primaryInvoiceData.invoice._id;
        primaryInvoiceNumber = primaryInvoiceData.invoice.invoiceNumber;

        // Primary invoice saved successfully
      }

      // Update formData with the new invoice ID and number
      setFormData(prev => ({
        ...prev,
        _id: primaryInvoiceId,
        invoiceNumber: primaryInvoiceNumber
      }));

      // Generate professional vector PDF (react-pdf)
      const pdfBase64 = await generateInvoicePdfBase64(formData, primaryInvoiceNumber);
      console.log('📄 [Smart Invoicing] Downloading PDF...', {
        invoiceNumber: primaryInvoiceNumber,
        pdfSize: pdfBase64.length
      });
      const byteChars = atob(pdfBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${primaryInvoiceNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ [Smart Invoicing] PDF downloaded successfully:', {
        invoiceNumber: primaryInvoiceNumber,
        total: formData.total
      });
      
      toast.success(`PDF saved. Invoice ${primaryInvoiceNumber} added to your invoices.`);
      
      // Clear saved form data after successful download (same as send invoice)
      clearSavedData();
      // Redirect to invoices page to show the sent invoice
      router.push('/dashboard/services/smart-invoicing/invoices');
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    } finally {
      setSendingInvoice(false);
    }
  };

  // Handle CSV download
  const handleDownloadCsv = () => {
    const errors = validateInvoiceForPdf();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    try {
      console.log('📤 [Smart Invoicing] Starting CSV download...', {
        invoiceNumber: formData.invoiceNumber,
        clientEmail: formData.clientEmail,
        total: formData.total
      });

      // Create simple CSV structure for easy bulk processing
      const csvRows = [];
      
      // CSV Headers - simple and clean (one row per invoice)
      const headers = [
        'Invoice Number',
        'Invoice Name', 
        'Issue Date',
        'Due Date',
        'Status',
        'Company Name',
        'Company Email',
        'Company Phone',
        'Company Address',
        'Company Tax Number',
        'Client Name',
        'Client Company',
        'Client Email',
        'Client Phone',
        'Client Address',
        'Items Description',
        'Total Quantity',
        'Subtotal',
        'Total Tax',
        'Total Amount',
        'Currency',
        'Payment Method',
        'Bank Name',
        'Account Number',
        'Routing Number',
        'Network',
        'Payment Address',
        'Memo',
        'Created Date'
      ];
      csvRows.push(headers.join(','));
      
      // Get company details
      const companyName = formData.companyName;
      const companyEmail = formData.companyEmail;
      const companyPhone = formData.companyPhone;
      const companyTaxNumber = formData.companyTaxNumber;
      const companyAddress = `${formData.companyAddress.street}, ${formData.companyAddress.city}, ${formData.companyAddress.state} ${formData.companyAddress.zipCode}, ${formData.companyAddress.country}`;
      
      // Get client details
      const clientName = formData.clientName;
      const clientCompany = formData.clientCompany || 'N/A';
      const clientEmail = formData.clientEmail;
      const clientPhone = formData.clientPhone;
      const clientAddress = `${formData.clientAddress.street}, ${formData.clientAddress.city}, ${formData.clientAddress.state} ${formData.clientAddress.zipCode}, ${formData.clientAddress.country}`;
      
      // Get payment details
      const paymentMethodText = formData.paymentMethod === 'fiat' ? 
        formData.fiatPaymentSubtype === 'mpesa_paybill' ? 'M-Pesa Paybill' :
        formData.fiatPaymentSubtype === 'mpesa_till' ? 'M-Pesa Till' :
        'Bank Transfer' : 'Cryptocurrency';
      const bankName = formData.bankName || 'N/A';
      const accountNumber = formData.accountNumber || 'N/A';
      const routingNumber = formData.swiftCode || formData.bankCode || 'N/A';
      const network = formData.paymentNetwork || 'N/A';
      const paymentAddress = formData.paymentAddress || 'N/A';
      
      // Get original currency (preserve the invoice's original currency)
      const originalCurrency = formData.currency;
      
      // Create one row per invoice (combine all items into a single description)
      const itemsDescription = formData.items && formData.items.length > 0 
        ? formData.items.map(item => `${item.description || 'Item'} (Qty: ${item.quantity}, Price: ${(item.unitPrice ?? 0).toFixed(2)})`).join('; ')
        : 'No items';
      
      const totalQuantity = formData.items ? formData.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
      
      const row = [
        `"${formData.invoiceNumber || 'N/A'}"`,
        `"${formData.invoiceName || 'Invoice'}"`,
        `"${formatDate(formData.issueDate)}"`,
        `"${formatDate(formData.dueDate)}"`,
        `"Draft"`,
        `"${companyName}"`,
        `"${companyEmail}"`,
        `"${companyPhone}"`,
        `"${companyAddress}"`,
        `"${companyTaxNumber}"`,
        `"${clientName}"`,
        `"${clientCompany}"`,
        `"${clientEmail}"`,
        `"${clientPhone}"`,
        `"${clientAddress}"`,
        `"${itemsDescription}"`,
        `"${totalQuantity}"`,
        `"${(formData.subtotal ?? 0).toFixed(2)}"`,
        `"${(formData.totalTax ?? 0).toFixed(2)}"`,
        `"${(formData.total ?? 0).toFixed(2)}"`,
        `"${originalCurrency}"`,
        `"${paymentMethodText}"`,
        `"${bankName}"`,
        `"${accountNumber}"`,
        `"${routingNumber}"`,
        `"${network}"`,
        `"${paymentAddress}"`,
        `"${formData.memo || ''}"`,
        `"${formatDate(new Date().toISOString())}"`
      ];
      csvRows.push(row.join(','));
      
      // Convert to CSV string
      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${formData.invoiceNumber || 'invoice'}_${formatDate(formData.issueDate).replace(/,/g, '')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [Smart Invoicing] CSV downloaded successfully:', {
        invoiceNumber: formData.invoiceNumber,
        filename: `${formData.invoiceNumber || 'invoice'}_${formatDate(formData.issueDate).replace(/,/g, '')}.csv`,
        currency: originalCurrency
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download CSV:', error);
      toast.error('Failed to download CSV. Please try again.');
    }
  };



  // Note: Invoice numbers are now generated by the backend API
  // No need to generate them on the frontend

  // Handle payment method selection
  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethodId(methodId);
    
    if (methodId) {
      const selectedMethod = savedPaymentMethods.find(method => method._id === methodId);
      if (selectedMethod) {
        if (selectedMethod.type === 'fiat') {
          setFormData(prev => ({
            ...prev,
            paymentMethod: 'fiat',
            fiatPaymentSubtype: selectedMethod.fiatDetails?.subtype || 'bank',
            bankName: selectedMethod.fiatDetails?.bankName || '',
            swiftCode: selectedMethod.fiatDetails?.swiftCode || '',
            bankCode: selectedMethod.fiatDetails?.bankCode || '',
            branchCode: selectedMethod.fiatDetails?.branchCode || '',
            accountName: selectedMethod.fiatDetails?.accountName || '',
            accountNumber: selectedMethod.fiatDetails?.accountNumber || '',
            branchAddress: selectedMethod.fiatDetails?.branchAddress || '',
            customBankFields: (selectedMethod.fiatDetails as { customFields?: Record<string, string> })?.customFields || {},
            paybillNumber: selectedMethod.fiatDetails?.paybillNumber || '',
            mpesaAccountNumber: selectedMethod.fiatDetails?.mpesaAccountNumber || '',
            tillNumber: selectedMethod.fiatDetails?.tillNumber || '',
            businessName: selectedMethod.fiatDetails?.businessName || '',
            paymentPhoneNumber: selectedMethod.fiatDetails?.paymentPhoneNumber || '',
            // Set currency from payment method if available, otherwise keep current
            // M-Pesa methods should default to KES
            currency: (() => {
              const methodCurrency = (selectedMethod.fiatDetails as { currency?: string })?.currency;
              if (methodCurrency) return methodCurrency;
              // Auto-set KES for M-Pesa methods
              if (selectedMethod.fiatDetails?.subtype === 'mpesa_paybill' || selectedMethod.fiatDetails?.subtype === 'mpesa_till') {
                return 'KES';
              }
              return prev.currency;
            })()
          }));
        } else if (selectedMethod.type === 'crypto') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const isSafeWallet = (selectedMethod.cryptoDetails as any)?.safeDetails;
          const cryptoCurrency = selectedMethod.cryptoDetails?.currency;
          const cryptoDetails = selectedMethod.cryptoDetails;
          setFormData(prev => ({
            ...prev,
            paymentMethod: 'crypto',
            paymentNetwork: cryptoDetails?.network || '',
            paymentAddress: cryptoDetails?.address || '',
            chainId: cryptoDetails?.chainId || prev.chainId,
            tokenAddress: cryptoDetails?.tokenAddress || prev.tokenAddress,
            // Set currency if available, default to USDT for crypto
            currency: cryptoCurrency || 'USDT',
            // If Safe wallet, preserve Safe-specific details
            ...(isSafeWallet && {
              // Safe wallet specific fields are already in cryptoDetails
            })
          }));
        }
      }
    }
  };

  // Check if user can create invoice on component mount
  useEffect(() => {
    if (subscription && !subscription.canCreateInvoice) {
      // Don't redirect - just disable the form
      console.log('Invoice limit reached - form will be disabled');
    }
  }, [subscription, router]);

  if (loading && invoiceId) {
    return (
      <div className="min-h-screen rounded-xl bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header skeleton - matches Back + Save Draft / Send Invoice */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
            <div className="h-12 w-40 bg-gray-200 rounded-lg animate-pulse" />
            <div className="flex gap-4">
              <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
          {/* Invoice document skeleton - white card with header + content */}
          <div className="bg-white rounded-lg shadow-lg border w-full max-w-4xl mx-auto overflow-hidden">
            <div className="p-4 sm:p-8 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start space-y-4 sm:space-y-0 gap-4">
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="flex flex-col items-end gap-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-16 w-16 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap gap-4">
                <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="h-4 w-full max-w-md bg-gray-200 rounded animate-pulse mb-3" />
                <div className="h-4 w-full max-w-sm bg-gray-200 rounded animate-pulse mb-3" />
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <div className="h-8 flex-1 bg-gray-200 rounded animate-pulse" />
                      <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                      <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                      <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading invoice...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-xl bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Sending overlay - rendered in body so it covers full viewport and prevents scroll */}
        {sendingInvoice && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-hidden"
            style={{ pointerEvents: 'auto', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            aria-live="polite"
            aria-busy="true"
            role="alert"
          >
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-sm mx-4 flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" aria-hidden />
              <h3 className="text-lg font-semibold text-gray-900">Sending invoice</h3>
              <p className="text-sm text-gray-600 text-center">Please wait. Do not close or refresh this page.</p>
            </div>
          </div>,
          document.body
        )}

        {/* Disabled Overlay - Show when limit is reached */}
        {subscription && !subscription.canCreateInvoice && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center max-w-md mx-auto shadow-2xl">
              <Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Invoice Limit Reached</h2>
              <p className="text-gray-600 mb-6">
                You have reached your monthly limit of 5 invoices on the free plan. 
                Upgrade to a Pro plan to create unlimited invoices.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Pricing Plans
                </button>
                <button
                  onClick={() => router.push('/dashboard/services/smart-invoicing')}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Invoices
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Original Form Content - Disabled when limit reached or when sending invoice */}
        <div className={`${subscription && !subscription.canCreateInvoice ? 'pointer-events-none opacity-50' : ''} ${sendingInvoice ? 'pointer-events-none select-none' : ''}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm touch-manipulation active:scale-95 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
                <Save className="h-4 w-4" />
                <span>Save Draft</span>
            </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Send Invoice</span>
              </button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div ref={validationErrorsRef} className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg scroll-mt-24" style={{ scrollMarginTop: '2rem' }}>
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h3 className="text-sm font-medium text-red-800">Please fix the following errors before generating PDF:</h3>
            </div>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Auto-save Status Indicator */}
        {autoSaveStatus && (
          <div className="mb-4 flex items-center justify-center">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
              autoSaveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
              autoSaveStatus === 'saved' ? 'bg-green-50 text-green-700' :
              'bg-red-50 text-red-700'
            }`}>
              {autoSaveStatus === 'saving' && (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span>Auto-saving...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <div className="h-4 w-4 bg-green-600 rounded-full flex items-center justify-center">
                    <div className="h-2 w-2 bg-white rounded-full"></div>
                  </div>
                  <span>Draft saved</span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <>
                  <div className="h-4 w-4 bg-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <span>Save failed</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Invoice Document */}
        <div ref={printRef} className="bg-white rounded-lg shadow-lg border w-full max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start space-y-4 sm:space-y-0">
              {/* Left Side - Invoice Name */}
              <div className="flex-1">
                {renderEditableField('invoiceName', formData.invoiceName, 'Invoice #')}
              </div>

              {/* Right Side - Dates and Logo */}
              <div className="w-full sm:w-auto">
                {/* Mobile Layout - Stack vertically */}
                <div className="flex flex-col space-y-3 sm:hidden">
                  {/* Logo first on mobile */}
                  <div 
                    onClick={handleOpenCompanyModal}
                    className="w-20 h-20 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer flex-shrink-0 group relative overflow-hidden self-end"
                  >
                    {formData.companyLogo ? (
                      <>
                        <Image 
                          src={formData.companyLogo} 
                          alt="Company Logo" 
                          width={80}
                          height={80}
                          className="object-contain w-full h-full"
                          unoptimized={formData.companyLogo.startsWith('data:')}
                          priority={true}
                          sizes="80px"
                          style={{ backgroundColor: 'white' }}
                        />
                        <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <Edit3 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Dates below logo on mobile */}
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      {renderEditableDateField('issueDate', formData.issueDate, 'Issued on')}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      {renderEditableDateField('dueDate', formData.dueDate, 'Payment due by')}
                    </div>
                  </div>
                </div>

                {/* Desktop Layout - Side by side */}
                <div className="hidden sm:flex items-end space-x-4">
                  <div className="text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      {renderEditableDateField('issueDate', formData.issueDate, 'Issued on')}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="h-4 w-4" />
                      {renderEditableDateField('dueDate', formData.dueDate, 'Payment due by')}
                    </div>
                  </div>
                  <div 
                    onClick={handleOpenCompanyModal}
                    className="w-20 h-20 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer flex-shrink-0 group relative overflow-hidden"
                  >
                    {formData.companyLogo ? (
                      <>
                        <Image 
                          src={formData.companyLogo} 
                          alt="Company Logo" 
                          width={80}
                          height={80}
                          className="object-contain w-full h-full"
                          unoptimized={formData.companyLogo.startsWith('data:')}
                          priority={true}
                          sizes="80px"
                          style={{ backgroundColor: 'white' }}
                        />
                        <div className="absolute inset-0  bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <Edit3 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between space-y-6 lg:space-y-0">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    From
                  </div>
                  <button
                    onClick={handleOpenCompanyModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </h3>
                <div className="flex items-start space-x-4">
                 
                  
                  {/* Company Details */}
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-gray-700">
                      {formData.companyName || 'Company Name'}
                    </div>
                    <div className="text-gray-700 space-y-1">
                      <div>{formData.companyAddress.street || 'Street Address'}</div>
                      <div className="flex flex-wrap space-x-2">
                        <span>{formData.companyAddress.city || 'City'}</span>
                        <span>{formData.companyAddress.state || 'State'}</span>
                        <span>{formData.companyAddress.zipCode || 'ZIP'}</span>
                      </div>
                      <div>
                        {formData.companyAddress.country ? countries.find(c => c.code === formData.companyAddress.country)?.name || formData.companyAddress.country : 'Country'}
                      </div>
                    </div>
                    <div className="text-gray-700">
                      Tax: {formData.companyTaxNumber || 'Tax Number'}
                    </div>
                    <div className="text-gray-700">
                      {formData.companyEmail || 'Email'}
                    </div>
                    <div className="text-gray-700">
                      {formData.companyPhone || 'Phone'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="flex-1 lg:ml-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Bill To
                  </h3>
                  <div className="flex items-center space-x-2">
                    {/* WhatsApp Toggle Button - DISABLED FOR NOW */}
                    {/* TODO: Re-enable WhatsApp functionality after configuration */}
                    {false && (
                      <button
                        onClick={() => {
                          const newWhatsAppMode = !formData.sendViaWhatsapp;
                          setFormData(prev => {
                            const updated = { ...prev, sendViaWhatsapp: newWhatsAppMode };
                            
                            // Auto-format phone number when switching to WhatsApp
                            if (newWhatsAppMode && prev.clientPhone) {
                              // Get country code from current country selection
                              const countryCode = prev.clientAddress.country ? 
                                (prev.clientAddress.country === 'US' ? '+1' : 
                                 prev.clientAddress.country === 'GB' ? '+44' :
                                 prev.clientAddress.country === 'DE' ? '+49' :
                                 prev.clientAddress.country === 'FR' ? '+33' :
                                 prev.clientAddress.country === 'IT' ? '+39' :
                                 prev.clientAddress.country === 'ES' ? '+34' :
                                 prev.clientAddress.country === 'CA' ? '+1' :
                                 prev.clientAddress.country === 'AU' ? '+61' :
                                 prev.clientAddress.country === 'JP' ? '+81' :
                                 prev.clientAddress.country === 'CN' ? '+86' :
                                 prev.clientAddress.country === 'IN' ? '+91' :
                                 prev.clientAddress.country === 'BR' ? '+55' :
                                 prev.clientAddress.country === 'MX' ? '+52' :
                                 prev.clientAddress.country === 'RU' ? '+7' :
                                 prev.clientAddress.country === 'KR' ? '+82' :
                                 prev.clientAddress.country === 'NL' ? '+31' :
                                 prev.clientAddress.country === 'SE' ? '+46' :
                                 prev.clientAddress.country === 'NO' ? '+47' :
                                 prev.clientAddress.country === 'DK' ? '+45' :
                                 prev.clientAddress.country === 'FI' ? '+358' :
                                 prev.clientAddress.country === 'PL' ? '+48' :
                                 prev.clientAddress.country === 'CZ' ? '+420' :
                                 prev.clientAddress.country === 'HU' ? '+36' :
                                 prev.clientAddress.country === 'RO' ? '+40' :
                                 prev.clientAddress.country === 'BG' ? '+359' :
                                 prev.clientAddress.country === 'HR' ? '+385' :
                                 prev.clientAddress.country === 'SI' ? '+386' :
                                 prev.clientAddress.country === 'SK' ? '+421' :
                                 prev.clientAddress.country === 'LT' ? '+370' :
                                 prev.clientAddress.country === 'LV' ? '+371' :
                                 prev.clientAddress.country === 'EE' ? '+372' :
                                 prev.clientAddress.country === 'IE' ? '+353' :
                                 prev.clientAddress.country === 'PT' ? '+351' :
                                 prev.clientAddress.country === 'GR' ? '+30' :
                                 prev.clientAddress.country === 'CY' ? '+357' :
                                 prev.clientAddress.country === 'MT' ? '+356' :
                                 prev.clientAddress.country === 'LU' ? '+352' :
                                 prev.clientAddress.country === 'BE' ? '+32' :
                                 prev.clientAddress.country === 'AT' ? '+43' :
                                 prev.clientAddress.country === 'CH' ? '+41' :
                                 prev.clientAddress.country === 'LI' ? '+423' :
                                 prev.clientAddress.country === 'MC' ? '+377' :
                                 prev.clientAddress.country === 'SM' ? '+378' :
                                 prev.clientAddress.country === 'VA' ? '+39' :
                                 prev.clientAddress.country === 'AD' ? '+376' :
                                 prev.clientAddress.country === 'IS' ? '+354' :
                                 prev.clientAddress.country === 'FO' ? '+298' :
                                 prev.clientAddress.country === 'GL' ? '+299' :
                                 prev.clientAddress.country === 'GI' ? '+350' :
                                 prev.clientAddress.country === 'AL' ? '+355' :
                                 prev.clientAddress.country === 'AM' ? '+374' :
                                 prev.clientAddress.country === 'AZ' ? '+994' :
                                 prev.clientAddress.country === 'BY' ? '+375' :
                                 prev.clientAddress.country === 'BA' ? '+387' :
                                 prev.clientAddress.country === 'GE' ? '+995' :
                                 prev.clientAddress.country === 'KG' ? '+996' :
                                 prev.clientAddress.country === 'KZ' ? '+7' :
                                 prev.clientAddress.country === 'MD' ? '+373' :
                                 prev.clientAddress.country === 'ME' ? '+382' :
                                 prev.clientAddress.country === 'MK' ? '+389' :
                                 prev.clientAddress.country === 'RS' ? '+381' :
                                 prev.clientAddress.country === 'TJ' ? '+992' :
                                 prev.clientAddress.country === 'TM' ? '+993' :
                                 prev.clientAddress.country === 'UA' ? '+380' :
                                 prev.clientAddress.country === 'UZ' ? '+998' :
                                 prev.clientAddress.country === 'XK' ? '+383' :
                                 '+1') : '+1';
                              
                              updated.clientPhone = formatPhoneForWhatsApp(prev.clientPhone, countryCode);
                            }
                            
                            return updated;
                          });
                        }}
                        className={`flex items-center space-x-2 px-3 py-1 rounded-lg border transition-colors ${
                          formData.sendViaWhatsapp 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                        title={formData.sendViaWhatsapp ? 'Sending via WhatsApp' : 'Sending via Email (default)'}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          {formData.sendViaWhatsapp ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-medium">
                          {formData.sendViaWhatsapp ? 'WhatsApp ✓' : 'WhatsApp'}
                        </span>
                      </button>
                    )}
                    
                    <button
                      onClick={handleOpenClientModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowClientSelector(!showClientSelector)}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {formData.clientName ? 'Change Client' : 'Add Client'}
                      </button>
                      
                      {/* Client Selector Dropdown */}
                      {showClientSelector && (
                        <div className="absolute top-full right-1 z-10 mt-2 border w-80 bg-white rounded-lg shadow-lg">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">Select Client</h4>
                        <button
                          onClick={() => setShowClientSelector(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      </div>
                      
                      {clients.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {clients.map((client) => (
                            <button
                              key={client._id}
                              onClick={() => selectClient(client)}
                              className="w-full text-left p-2 hover:bg-gray-100 rounded border"
                            >
                                <div className="font-medium text-black">
                                {client.company ? client.company : client.name}
                              </div>
                              {client.company && (
                                  <div className="text-sm text-black">Contact Person: {client.name}</div>
                              )}
                              <div className="text-sm text-gray-600">{client.email}</div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-center py-4">No clients found</div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t">
                        <button
                          onClick={createNewClient}
                          className="w-full text-center py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Create New Client
                        </button>
                      </div>
                    </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium text-gray-700">
                    {formData.clientCompany ? formData.clientCompany : formData.clientName || 'Client Name'}
                  </div>
                  {formData.clientCompany && (
                      <div className="text-black">
                      Contact Person: {formData.clientName || 'Client Name'}
                    </div>
                  )}
                  <div className="text-gray-700 space-y-1">
                    {formData.clientAddress.street && (
                      <div>{formData.clientAddress.street}</div>
                    )}
                    {(formData.clientAddress.city || formData.clientAddress.state || formData.clientAddress.zipCode) && (
                      <div className="flex space-x-2">
                        {formData.clientAddress.city && (
                          <span>{formData.clientAddress.city}</span>
                        )}
                        {formData.clientAddress.state && (
                          <span>{formData.clientAddress.state}</span>
                        )}
                        {formData.clientAddress.zipCode && (
                          <span>{formData.clientAddress.zipCode}</span>
                        )}
                      </div>
                    )}
                    <div className="text-gray-700">
                      {formData.clientAddress.country 
                        ? countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country 
                        : 'Country'}
                    </div>
                  </div>
                  {/* Email field - only show in Email mode */}
                  {!formData.sendViaWhatsapp && (
                    <div className="text-gray-700 flex items-center">
                      {formData.clientEmail || 'Email'}
                    </div>
                  )}
                  <div className="text-gray-700 flex items-center">
                    {formData.clientPhone || 'Phone'}
                    {formData.sendViaWhatsapp && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        WhatsApp
                      </span>
                    )}
                  </div>
                </div>

                {/* CC Clients Section */}
                <div className="mt-6 pt-4 border-t border-gray-200 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      CC Others
                    </h4>
                    <button
                      onClick={() => setShowCcClientSelector(!showCcClientSelector)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {formData.ccClients && formData.ccClients.length > 0 ? 'Add More' : 'Add CC'}
                    </button>
                  </div>

                  {/* CC Client Selector Dropdown */}
                  {showCcClientSelector && (
                    <div className="absolute top-full left-0 z-10 mt-2 w-80 max-w-full bg-white border border-gray-300 rounded-lg shadow-lg">
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-gray-900">Select CC Clients</h4>
                          <button
                            onClick={() => setShowCcClientSelector(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </button>
                        </div>
                        
                        {clients.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {clients.map((client) => {
                              // Filter out clients that are already CC'd or are the primary client
                              const isAlreadyCc = formData.ccClients?.some(cc => cc.email === client.email);
                              const isPrimaryClient = formData.clientEmail === client.email;
                              
                              if (isAlreadyCc || isPrimaryClient) {
                                return null;
                              }

                              return (
                                <button
                                  key={client._id}
                                  onClick={() => selectCcClient(client)}
                                  className="w-full text-left p-2 hover:bg-gray-100 rounded border"
                                >
                                  <div className="font-medium">
                                    {client.company ? client.company : client.name}
                                  </div>
                                  {client.company && (
                                    <div className="text-sm text-gray-500">Contact Person: {client.name}</div>
                                  )}
                                  <div className="text-sm text-gray-600">{client.email}</div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-4">No clients found</div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t">
                          <button
                            onClick={createNewCcClient}
                            className="w-full text-center py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Create New Client
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CC Clients List */}
                  {formData.ccClients && formData.ccClients.length > 0 && (
                    <div className="space-y-2">
                      {formData.ccClients.map((ccClient, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {ccClient.company ? ccClient.company : ccClient.name}
                            </div>
                            {ccClient.company && (
                              <div className="text-xs text-gray-500">Contact Person: {ccClient.name}</div>
                            )}
                            <div className="text-xs text-gray-600">{ccClient.email}</div>
                          </div>
                          <button
                            onClick={() => removeCcClient(ccClient.email)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <div className="relative currency-dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
                  >
                      <div className="flex items-center space-x-2">
                        {formData.currency && (
                          <Image
                            src={getCurrencyIcon(formData.currency)}
                            alt={formData.currency}
                            width={20}
                            height={20}
                            className="rounded-sm"
                            onError={(e) => {
                              // Fallback to app logo if currency image fails to load
                              e.currentTarget.src = '/chainsnobg.png';
                            }}
                          />
                        )}
                    <span className={formData.currency ? 'text-gray-900' : 'text-gray-500'}>
                      {formData.currency 
                        ? `${formData.currency} - ${getCurrencyByCode(formData.currency)?.name || 'Unknown'}`
                        : 'Select currency'}
                    </span>
                      </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCurrencyDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCurrencyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-20">
                      {/* Search input */}
                      <div className="p-2 border-b border-gray-200 bg-gray-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                              <input
                      type="text"
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                      placeholder="Search currencies..."
                      className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-black placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                        </div>
                      </div>
                      
                      {/* Currency list */}
                      <div className="max-h-48 overflow-y-auto">
                        {/* Fiat Currencies */}
                        <div className="px-2 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Fiat Currencies
                        </div>
                        {fiatCurrencies
                          .filter(currency => 
                            currency.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
                            currency.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                            currency.symbol.toLowerCase().includes(currencySearch.toLowerCase())
                          )
                          .map(currency => (
                          <button
                            key={currency.code}
                            type="button"
                            onClick={() => {
                              handleInputChange('currency', currency.code);
                              setShowCurrencyDropdown(false);
                              setCurrencySearch('');
                            }}
                            className="w-full px-3 py-2 text-left text-gray-900 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center space-x-3">
                                <Image
                                  src={getCurrencyIcon(currency.code)}
                                  alt={currency.code}
                                  width={16}
                                  height={16}
                                  className="rounded-sm flex-shrink-0"
                                  onError={(e) => {
                                    // Fallback to app logo if currency image fails to load
                                    e.currentTarget.src = '/chainsnobg.png';
                                  }}
                                />
                              <span className="text-sm">{currency.name}</span>
                              <span className="text-blue-600 text-xs font-medium">{currency.symbol}</span>
                            </div>
                            <span className="text-gray-500 text-xs font-medium">{currency.code}</span>
                          </button>
                        ))}
                        
                        {/* Cryptocurrencies */}
                        <div className="px-2 py-1 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Cryptocurrencies
                        </div>
                        {cryptoCurrencies
                          .filter(currency => 
                            currency.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
                            currency.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                            currency.symbol.toLowerCase().includes(currencySearch.toLowerCase())
                          )
                          .map(currency => (
                          <button
                            key={currency.code}
                            type="button"
                            onClick={() => {
                              handleInputChange('currency', currency.code);
                              setShowCurrencyDropdown(false);
                              setCurrencySearch('');
                            }}
                            className="w-full px-3 py-2 text-left text-gray-900 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center space-x-3">
                                <Image
                                  src={getCurrencyIcon(currency.code)}
                                  alt={currency.code}
                                  width={16}
                                  height={16}
                                  className="rounded-sm flex-shrink-0"
                                  onError={(e) => {
                                    // Fallback to app logo if currency image fails to load
                                    e.currentTarget.src = '/chainsnobg.png';
                                  }}
                                />
                              <span className="text-sm">{currency.name}</span>
                              <span className="text-blue-600 text-xs font-medium">{currency.symbol}</span>
                            </div>
                            <span className="text-gray-500 text-xs font-medium">{currency.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="regular"
                      checked={formData.invoiceType === 'regular'}
                      onChange={(e) => handleInputChange('invoiceType', e.target.value)}
                      className="mr-2 "
                    />
                    <span className="text-sm text-gray-600">Regular</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="recurring"
                      checked={formData.invoiceType === 'recurring'}
                      onChange={(e) => handleInputChange('invoiceType', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Recurring</span>
                  </label>
                </div>
              </div>

              {/* Multi-Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Options</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enableMultiCurrency}
                      onChange={(e) => handleInputChange('enableMultiCurrency', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Enable Multi-Currency</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
            
            {/* Payment Method Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Saved Payment Method
              </label>
              <PaymentMethodSelector
                methods={savedPaymentMethods.map(method => {
                  // Type-safe mapping to PaymentMethodSelector's expected format
                  const methodWithExtras = method as typeof method & {
                    isDefault?: boolean;
                    fiatDetails?: typeof method.fiatDetails & { currency?: string };
                    cryptoDetails?: typeof method.cryptoDetails & { 
                      currency?: string;
                      safeDetails?: {
                        safeAddress: string;
                        owners: string[];
                        threshold: number;
                        chainId?: number;
                      };
                    };
                  };
                  
                  return {
                    _id: methodWithExtras._id,
                    name: methodWithExtras.name,
                    type: methodWithExtras.type,
                    isDefault: methodWithExtras.isDefault,
                    fiatDetails: methodWithExtras.fiatDetails ? {
                      subtype: methodWithExtras.fiatDetails.subtype === 'phone' ? undefined : (methodWithExtras.fiatDetails.subtype as 'bank' | 'mpesa_paybill' | 'mpesa_till' | undefined),
                      bankName: methodWithExtras.fiatDetails.bankName,
                      currency: methodWithExtras.fiatDetails.currency,
                    } : undefined,
                    cryptoDetails: methodWithExtras.cryptoDetails ? {
                      address: methodWithExtras.cryptoDetails.address,
                      network: methodWithExtras.cryptoDetails.network,
                      currency: methodWithExtras.cryptoDetails.currency || 'USDT',
                      safeDetails: methodWithExtras.cryptoDetails.safeDetails,
                    } : undefined,
                  };
                })}
                selectedMethodId={selectedPaymentMethodId}
                onSelect={handlePaymentMethodSelect}
                showSafeWallets={true}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
                <div className="space-y-3 text-gray-600">
                  <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="fiat"
                      checked={formData.paymentMethod === 'fiat'}
                      onChange={(e) => {
                        handleInputChange('paymentMethod', e.target.value);
                        // Auto-select USD for fiat payments
                        autoSelectCurrencyForPaymentMethod(e.target.value);
                      }}
                      className="mr-3"
                    />
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <div className="font-medium text-gray-700">Local currency ({formData.currency})</div>
                        <div className="text-sm text-gray-700">
                          {formData.companyAddress.country === 'KE' ? ' M-pesa & more' : 'Bank Transfer'}
                        </div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="crypto"
                      checked={formData.paymentMethod === 'crypto'}
                      onChange={(e) => {
                        handleInputChange('paymentMethod', e.target.value);
                        // Auto-select USDT for crypto payments
                        autoSelectCurrencyForPaymentMethod(e.target.value);
                      }}
                      className="mr-3"
                    />
                    <div className="flex items-center">
                      <Wallet className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <div className="font-medium text-gray-700">Crypto</div>
                        <div className="text-sm text-gray-700">Cryptocurrency payment</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Details</label>
                {formData.paymentMethod === 'fiat' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Payment Type</label>
                      <div className="space-y-2">
                        <label className="flex items-center text-gray-600">
                          <input
                            type="radio"
                            value="bank"
                            checked={formData.fiatPaymentSubtype === 'bank'}
                            onChange={(e) => handleFiatPaymentSubtypeChange(e.target.value)}
                            className="mr-2 text-gray-600"
                          />
                          <CreditCard className="h-4 w-4 text-green-600 mr-2" />
                          Bank Transfer
                        </label>
                        {isLocalCurrency() && (
                          <>
                            <label className="flex items-center text-gray-600">
                              <input
                                type="radio"
                                value="phone"
                                checked={formData.fiatPaymentSubtype === 'phone'}
                                onChange={(e) => handleFiatPaymentSubtypeChange(e.target.value)}
                                className="mr-2 text-gray-600"
                              />
                              <Smartphone className="h-4 w-4 text-blue-600 mr-2" />
                              Phone Number
                            </label>
                            <label className="flex items-center text-gray-600">
                              <input
                                type="radio"
                                value="mpesa_paybill"
                                checked={formData.fiatPaymentSubtype === 'mpesa_paybill'}
                                onChange={(e) => handleFiatPaymentSubtypeChange(e.target.value)}
                                className="mr-2 text-gray-600"
                              />
                              <Smartphone className="h-4 w-4 text-orange-600 mr-2" />
                              M-Pesa Paybill
                            </label>
                            <label className="flex items-center text-gray-600">
                              <input
                                type="radio"
                                value="mpesa_till"
                                checked={formData.fiatPaymentSubtype === 'mpesa_till'}
                                onChange={(e) => handleFiatPaymentSubtypeChange(e.target.value)}
                                className="mr-2 text-gray-600"
                              />
                              <Smartphone className="h-4 w-4 text-orange-600 mr-2" />
                              M-Pesa Till Number
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {formData.fiatPaymentSubtype === 'phone' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Phone Number</label>
                          <input
                            type="tel"
                            value={formData.paymentPhoneNumber || ''}
                            onChange={(e) => handleInputChange('paymentPhoneNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="e.g., +1234567890"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={formData.businessName || ''}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Your business name (optional)"
                          />
                        </div>
                      </div>
                    )}
                    
                    {formData.fiatPaymentSubtype === 'bank' && (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm text-gray-700">Bank Name</label>
                            <div className="relative">
                              <select
                                value={formData.bankCountryCode || 'KE'}
                                onChange={(e) => handleInputChange('bankCountryCode', e.target.value)}
                                className="text-xs bg-white text-gray-900 border border-gray-300 rounded outline-none cursor-pointer pr-4 appearance-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="GH">Ghana</option>
                                <option value="KE">Kenya</option>
                                <option value="NG">Nigeria</option>
                                <option value="AE">UAE</option>
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-600 pointer-events-none" />
                            </div>
                          </div>
                          <BankSelector
                            countryCode={formData.bankCountryCode || 'KE'}
                            value={formData.bankName || ''}
                            onBankSelectAction={handleBankSelect}
                            onInputChangeAction={(value) => handleInputChange('bankName', value)}
                            placeholder="Search for a bank or type custom bank name..."
                            allowCustom={true}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">SWIFT Code</label>
                          <input
                            type="text"
                            value={formData.swiftCode || ''}
                            onChange={(e) => handleInputChange('swiftCode', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="SWIFT/BIC code"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={formData.accountNumber || ''}
                            onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Account Name</label>
                          <input
                            type="text"
                            value={formData.accountName || ''}
                            onChange={(e) => handleInputChange('accountName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account holder name"
                          />
                        </div>
                        {/* Custom bank fields - only shown for custom banks with toggle */}
                        {isCustomBank && (
                          <div className="pt-2 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setShowCustomBankFields(!showCustomBankFields)}
                              className="flex items-center justify-between w-full text-left text-xs text-gray-500 hover:text-gray-700 mb-3"
                            >
                              <span>Additional bank details (optional)</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${showCustomBankFields ? 'rotate-180' : ''}`} />
                            </button>
                            {showCustomBankFields && (
                              <DynamicBankFields
                                fields={formData.customBankFields || {}}
                                onFieldsChange={(fields) => handleInputChange('customBankFields', fields)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {formData.fiatPaymentSubtype === 'mpesa_paybill' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Paybill Number</label>
                          <input
                            type="text"
                            value={formData.paybillNumber || ''}
                            onChange={(e) => handleInputChange('paybillNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="e.g., 123456"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={formData.mpesaAccountNumber || ''}
                            onChange={(e) => handleInputChange('mpesaAccountNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Account number for paybill"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={formData.businessName || ''}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Your business name (optional)"
                          />
                        </div>
                      </div>
                    )}
                    
                    {formData.fiatPaymentSubtype === 'mpesa_till' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Till Number</label>
                          <input
                            type="text"
                            value={formData.tillNumber || ''}
                            onChange={(e) => handleInputChange('tillNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="e.g., 1234567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={formData.businessName || ''}
                            onChange={(e) => handleInputChange('businessName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                            placeholder="Your business name (optional)"
                          />
                        </div>
                      </div>
                    )}
                    {/* Save Payment Method Button */}
                    <SavePaymentMethodButton
                      formData={formData}
                      isAlreadySaved={(() => {
                        // Check if current form data matches any saved payment method
                        return savedPaymentMethods.some(method => {
                          if (formData.paymentMethod === 'fiat' && method.type === 'fiat') {
                            if (formData.fiatPaymentSubtype === 'bank') {
                              return method.fiatDetails?.bankName === formData.bankName &&
                                     method.fiatDetails?.accountNumber === formData.accountNumber;
                            } else if (formData.fiatPaymentSubtype === 'mpesa_paybill') {
                              return method.fiatDetails?.paybillNumber === formData.paybillNumber &&
                                     method.fiatDetails?.mpesaAccountNumber === formData.mpesaAccountNumber;
                            } else if (formData.fiatPaymentSubtype === 'mpesa_till') {
                              return method.fiatDetails?.tillNumber === formData.tillNumber;
                            } else if (formData.fiatPaymentSubtype === 'phone') {
                              return method.fiatDetails?.paymentPhoneNumber === formData.paymentPhoneNumber;
                            }
                          }
                          return false;
                        });
                      })()}
                      onSaveSuccess={(savedMethodId) => {
                        // Refresh payment methods list
                        loadSavedPaymentMethods().then(() => {
                          // Auto-select the newly saved payment method
                          if (savedMethodId) {
                            setSelectedPaymentMethodId(savedMethodId);
                            handlePaymentMethodSelect(savedMethodId);
                          }
                        });
                      }}
                    />
                  </div>
                ) : formData.paymentMethod === 'crypto' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Choose your payment network</label>
                      <div className="relative network-dropdown-container">
                        <button
                          type="button"
                          onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
                        >
                            <div className="flex items-center space-x-2">
                              {formData.paymentNetwork && (
                                <Image
                                  src={getNetworkIcon(formData.paymentNetwork)}
                                  alt={formData.paymentNetwork}
                                  width={20}
                                  height={20}
                                  className="rounded-sm"
                                  onError={(e) => {
                                    // Fallback to app logo if network image fails to load
                                    e.currentTarget.src = '/chainsnobg.png';
                                  }}
                                />
                              )}
                          <span className={formData.paymentNetwork ? 'text-gray-900' : 'text-gray-500'}>
                            {formData.paymentNetwork 
                              ? networks.find(n => n.id === formData.paymentNetwork)?.name || formData.paymentNetwork
                              : 'Select network'}
                          </span>
                            </div>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showNetworkDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showNetworkDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-20">
                            {/* Search input */}
                            <div className="p-2 border-b border-gray-200 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <input
                      type="text"
                      value={networkSearch}
                      onChange={(e) => setNetworkSearch(e.target.value)}
                      placeholder="Search networks..."
                      className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-black placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                              </div>
                            </div>
                            
                            {/* Network list */}
                            <div className="max-h-48 overflow-y-auto">
                              {networks
                                .filter(network => 
                                  network.name.toLowerCase().includes(networkSearch.toLowerCase()) ||
                                  network.id.toLowerCase().includes(networkSearch.toLowerCase())
                                )
                                .map(network => (
                                <button
                                  key={network.id}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange('paymentNetwork', network.id);
                                    // Clear chainId and tokenAddress if not Celo, or sync with currency if Celo
                                    setFormData(prev => {
                                      if (network.id === 'celo') {
                                        // Sync tokenAddress with current currency when Celo is selected
                                        const currentCurrency = String(prev.currency || '').toUpperCase();
                                        let tokenAddress = CELO_TOKENS.cUSD.address; // Default
                                        if (currentCurrency === 'USDT') {
                                          tokenAddress = CELO_TOKENS.USDT.address;
                                        } else if (currentCurrency === 'CUSD') {
                                          tokenAddress = CELO_TOKENS.cUSD.address;
                                        }
                                        return {
                                          ...prev,
                                          chainId: 42220,
                                          tokenAddress
                                        };
                                      } else {
                                        return {
                                          ...prev,
                                          chainId: undefined,
                                          tokenAddress: undefined
                                        };
                                      }
                                    });
                                    setShowNetworkDropdown(false);
                                    setNetworkSearch('');
                                  }}
                                  className="w-full px-3 py-2 text-left text-gray-900 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center space-x-3">
                                      <Image
                                        src={getNetworkIcon(network.id)}
                                        alt={network.id}
                                        width={16}
                                        height={16}
                                        className="rounded-sm flex-shrink-0"
                                        onError={(e) => {
                                          // Fallback to money icon if network image fails to load
                                          e.currentTarget.src = '/currency-flags/money-icon.png';
                                        }}
                                      />
                                    <span className="text-sm">{network.name}</span>
                                  </div>
                                  <span className="text-gray-500 text-xs font-medium">{network.id}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Token Selection - Only show when a chain with tokens is selected (e.g., Celo) */}
                    {formData.paymentNetwork === 'celo' && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Token</label>
                        <select
                          value={formData.tokenAddress || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Use handleInputChange to trigger sync logic (only if value exists)
                            if (value) {
                              handleInputChange('tokenAddress', value);
                            } else {
                              // Clear tokenAddress and don't sync currency if cleared
                              setFormData(prev => ({ ...prev, tokenAddress: undefined }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white font-medium"
                        >
                          <option value="">Select token</option>
                          <option value="native">CELO (Native)</option>
                          <option value={CELO_TOKENS.cUSD.address}>cUSD</option>
                          <option value={CELO_TOKENS.USDT.address}>USDT</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Where do you want to receive your payment?</label>
                      <ReceivingAddressInput
                        value={formData.paymentAddress || ''}
                        onChangeAction={(address, metadata) => {
                          setFormData(prev => ({
                            ...prev,
                            paymentAddress: address,
                            receivingMethod: metadata?.mode || 'manual',
                            receivingWalletType: metadata?.walletType || null,
                            // Update chain and token if provided by wallet connection
                            chainId: metadata?.chainId || prev.chainId,
                            tokenAddress: metadata?.tokenAddress || prev.tokenAddress,
                          }));
                        }}
                        network={formData.paymentNetwork}
                        chainId={formData.chainId}
                        tokenAddress={formData.tokenAddress}
                      />
                    </div>
                    {/* Save Payment Method Button */}
                    <SavePaymentMethodButton
                      formData={formData}
                      isAlreadySaved={(() => {
                        // Check if current form data matches any saved payment method
                        return savedPaymentMethods.some(method => {
                          if (formData.paymentMethod === 'crypto' && method.type === 'crypto') {
                            return method.cryptoDetails?.address === formData.paymentAddress &&
                                   method.cryptoDetails?.network === formData.paymentNetwork;
                          }
                          return false;
                        });
                      })()}
                      onSaveSuccess={(savedMethodId) => {
                        // Refresh payment methods list
                        loadSavedPaymentMethods().then(() => {
                          // Auto-select the newly saved payment method
                          if (savedMethodId) {
                            setSelectedPaymentMethodId(savedMethodId);
                            handlePaymentMethodSelect(savedMethodId);
                          }
                        });
                      }}
                    />
                  </div>
                ) : null}
                    </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <h3 className="text-lg font-semibold text-gray-900">Invoice Items</h3>
              <div className="flex space-x-2">
                {!hasAnyDiscounts && (
                  <button
                    onClick={() => {
                      // Add a small discount to the first item to enable discount functionality
                      if (formData.items.length > 0) {
                        handleItemChange(0, 'discount', 5);
                      }
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Discount</span>
                  </button>
                )}

                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    {hasAnyDiscounts && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Tax</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter description"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                          placeholder="0"
                        />
                      </td>
                      {hasAnyDiscounts && (
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <input
                                type="number"
                                value={item.discount === 0 ? '' : item.discount}
                                onChange={(e) => handleItemChange(index, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 pr-6 py-1 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="0"
                              />
                              <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                            </div>
                            {item.discount > 0 && (
                              <button
                                onClick={() => handleItemChange(index, 'discount', 0)}
                                className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                title="Remove discount"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            value={item.tax === 0 ? '' : item.tax}
                            onChange={(e) => handleItemChange(index, 'tax', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 pr-6 py-1 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                        </div>
                        {/* Multi-Tax Rate Selector */}
                        <div className="mt-1">
                          <select
                            onChange={(e) => {
                              const selectedTax = e.target.value;
                              if (selectedTax) {
                                const [, rate] = selectedTax.split(':');
                                const taxRate = parseFloat(rate);
                                if (!Number.isNaN(taxRate) && taxRate >= 0) {
                                  handleItemChange(index, 'tax', taxRate);
                                }
                              }
                            }}
                            className="w-full text-xs px-1 py-0.5 bg-white border border-gray-200 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:light]"
                            value={(() => {
                              const r = item.tax;
                              if (r === 0) return 'custom:0';
                              if (r === 5) return 'custom:5';
                              if (r === 10) return 'custom:10';
                              if (r === 16) return 'custom:16';
                              if (r === 20) return 'custom:20';
                              if (r === 25) return 'custom:25';
                              if (r === 30) return 'custom:30';
                              const countryTaxes = getTaxRatesByCountry(formData.companyAddress.country);
                              if (countryTaxes) {
                                if (countryTaxes.vat === r) return `vat:${r}`;
                                if (countryTaxes.gst === r) return `gst:${r}`;
                                if (countryTaxes.salesTax === r) return `salesTax:${r}`;
                                if (countryTaxes.corporateTax === r) return `corporateTax:${r}`;
                                if (countryTaxes.personalTax === r) return `personalTax:${r}`;
                              }
                              return '';
                            })()}
                          >
                            <option value="">Select tax type</option>
                            <optgroup label="Common Rates">
                              <option value="custom:0">0% - No Tax</option>
                              <option value="custom:5">5% - Reduced Rate</option>
                              <option value="custom:10">10% - Standard Rate</option>
                              <option value="custom:16">16% - Kenya VAT</option>
                              <option value="custom:20">20% - High Rate</option>
                              <option value="custom:25">25% - Luxury Rate</option>
                              <option value="custom:30">30% - Premium Rate</option>
                            </optgroup>
                            <optgroup label="Country Tax Rates">
                              {(() => {
                                const countryTaxes = getTaxRatesByCountry(formData.companyAddress.country);
                                if (countryTaxes) {
                                  return (
                                    <>
                                      {countryTaxes.vat && <option value={`vat:${countryTaxes.vat}`}>VAT {countryTaxes.vat}%</option>}
                                      {countryTaxes.gst && <option value={`gst:${countryTaxes.gst}`}>GST {countryTaxes.gst}%</option>}
                                      {countryTaxes.salesTax && <option value={`salesTax:${countryTaxes.salesTax}`}>Sales Tax {countryTaxes.salesTax}%</option>}
                                      {countryTaxes.corporateTax && <option value={`corporateTax:${countryTaxes.corporateTax}`}>Corporate Tax {countryTaxes.corporateTax}%</option>}
                                      {countryTaxes.personalTax && <option value={`personalTax:${countryTaxes.personalTax}`}>Personal Tax {countryTaxes.personalTax}%</option>}
                                    </>
                                  );
                                }
                                return null;
                              })()}
                            </optgroup>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {getCurrencySymbol()}{(item.amount ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {formData.items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-full sm:w-64 space-y-2">
                <div className="flex justify-between text-gray-800">
                  <span>Amount without tax</span>
                  <span>{getCurrencySymbol()}{(formData.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Total Tax amount</span>
                  <span>{getCurrencySymbol()}{(formData.totalTax ?? 0).toFixed(2)}</span>
                </div>
                {!formData.withholdingTaxEnabled ? (
                  <div className="flex justify-between text-gray-800 items-center gap-2">
                    <span className="text-sm text-gray-700">Withholding tax</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sub = formData.subtotal ?? 0;
                        const tax = formData.totalTax ?? 0;
                        const ratePercent = formData.withholdingTaxRatePercent ?? 5;
                        const rate = ratePercent / 100;
                        setFormData(prev => ({
                          ...prev,
                          withholdingTaxEnabled: true,
                          withholdingTaxRatePercent: ratePercent,
                          total: sub + tax - (sub + tax) * rate
                        }));
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Add withholding tax
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-800 items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-2">
                      <span className="text-gray-800">Withholding tax (</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="w-14 px-1 py-0.5 text-sm bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={formData.withholdingTaxRatePercent ?? 5}
                        onChange={(e) => {
                          const sub = formData.subtotal ?? 0;
                          const tax = formData.totalTax ?? 0;
                          const n = parseFloat(e.target.value);
                          const ratePercent = Number.isNaN(n) ? 5 : Math.max(0, Math.min(100, n));
                          const rate = ratePercent / 100;
                          setFormData(prev => ({
                            ...prev,
                            withholdingTaxRatePercent: ratePercent,
                            total: sub + tax - (sub + tax) * rate
                          }));
                        }}
                      />
                      <span className="text-gray-800">%)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-red-600">
                        -{getCurrencySymbol()}{(((formData.subtotal ?? 0) + (formData.totalTax ?? 0)) * ((formData.withholdingTaxRatePercent ?? 5) / 100)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const sub = formData.subtotal ?? 0;
                          const tax = formData.totalTax ?? 0;
                          setFormData(prev => ({ ...prev, withholdingTaxEnabled: false, total: sub + tax }));
                        }}
                        className="p-0.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                        title="Remove withholding tax"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700 text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>{getCurrencySymbol()}{(formData.total ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>{getCurrencySymbol()}{(formData.total ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memo and Files */}
          <div className="p-4 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Memo</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                  placeholder="Add a memo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attached files</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No file attached yet.</p>
                  <p className="text-xs text-gray-500 mt-1">Click to upload files</p>
                </div>
                {(formData.attachedFiles?.length || 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.attachedFiles?.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <File className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Download and Send Buttons */}
        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4 mt-8 mb-6">
          {/* Download Dropdown */}
          <div className="relative download-dropdown-container">
            <button
              onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            
            {showDownloadDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    handleDownloadPdf();
                    setShowDownloadDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <File className="h-4 w-4 text-red-500" />
                  <span className="text-gray-900">Download as PDF</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadCsv();
                    setShowDownloadDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <File className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-900">Download as CSV</span>
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={handleSendInvoice}
            disabled={loading || sendingInvoice}
            className="flex items-center justify-center space-x-2 px-6 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            {sendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            <span>Send Invoice</span>
          </button>
        </div>

        {/* Client Creation Modal */}
        {showNewClientModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 p-4 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center py-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative touch-manipulation shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create New Client</h3>
                  <button
                    onClick={() => setShowNewClientModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors touch-manipulation active:scale-95 p-2 -m-2"
                  >
                    ×
                  </button>
                </div>
                
                <ClientCreationForm 
                  onSubmit={handleCreateClient}
                  onCancel={() => setShowNewClientModal(false)}
                  isLoading={creatingClient}
                />
              </div>
            </div>
          </div>
        )}

        {/* CC Client Creation Modal */}
        {showCcClientCreationModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 p-4 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center py-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative touch-manipulation shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create New CC Client</h3>
                  <button
                    onClick={() => setShowCcClientCreationModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors touch-manipulation active:scale-95 p-2 -m-2"
                  >
                    ×
                  </button>
                </div>
                
                <ClientCreationForm 
                  onSubmit={handleCreateCcClient}
                  onCancel={() => setShowCcClientCreationModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Company Edit Modal */}
        {showCompanyEditModal && (
          <div 
            className="bg-black/40 backdrop-blur-sm z-[9999] overflow-hidden" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              width: '100vw',
              height: '100vh',
              margin: 0,
              padding: '1rem',
              zIndex: 9999
            }}
          >
            <div className="min-h-full flex items-center justify-center py-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative shadow-xl touch-manipulation">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Company Information</h3>
                  <button
                    onClick={() => setShowCompanyEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors touch-manipulation active:scale-95 p-2 -m-2"
                  >
                    ×
                  </button>
                </div>
                
                <CompanyEditForm 
                  formData={formData}
                  onSubmit={(updatedData) => {
                    setFormData(prev => ({ ...prev, ...updatedData }));
                    setShowCompanyEditModal(false);
                  }}
                  onCancel={() => setShowCompanyEditModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Client Edit Modal */}
        {showClientEditModal && (
          <div 
            className="bg-black/40 backdrop-blur-sm z-[9999] overflow-hidden" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              width: '100vw',
              height: '100vh',
              margin: 0,
              padding: '1rem',
              zIndex: 9999
            }}
          >
            <div className="min-h-full flex items-center justify-center py-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative shadow-xl touch-manipulation">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Client Information</h3>
                  <button
                    onClick={() => setShowClientEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors touch-manipulation active:scale-95 p-2 -m-2"
                  >
                    ×
                  </button>
                </div>
                
                <ClientEditForm 
                  formData={formData}
                  formatPhoneForWhatsApp={formatPhoneForWhatsApp}
                  extractCountryCodeFromPhone={extractCountryCodeFromPhone}
                  setFormData={setFormData}
                  onSubmit={(updatedData) => {
                    setFormData(prev => ({ ...prev, ...updatedData }));
                    
                    // Auto-detect best sending method after client edit
                    // WhatsApp is disabled, so always use email
                    setTimeout(() => {
                      // Force email mode since WhatsApp is disabled
                      setFormData(prev => ({ ...prev, sendViaWhatsapp: false }));
                    }, 100);
                    
                    setShowClientEditModal(false);
                  }}
                  onCancel={() => setShowClientEditModal(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden PDF View for PDF Generation */}
      <div ref={pdfRef} className="hidden">
        <InvoicePdfView formData={formData} invoiceNumber={formData.invoiceNumber} />
      </div>

      </div>
    </div>
  );
}

// Client Creation Form Component
function ClientCreationForm({ 
  onSubmit, 
  onCancel,
  isLoading = false
}: { 
  onSubmit: (clientData: Omit<Client, '_id'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showAddressFields, setShowAddressFields] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert structured address to string format for backward compatibility
    const clientData = {
      ...formData,
      address: `${formData.address.street}, ${formData.address.city}, ${formData.address.state} ${formData.address.zipCode}, ${formData.address.country}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '')
    };
    onSubmit(clientData);
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input
          type="text"
          value={formData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Company name (optional)"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Phone number"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <input
          type="text"
          value={formData.address.city}
          onChange={(e) => handleInputChange('address.city', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={formData.address.country ? 'text-gray-900' : 'text-gray-500'}>
              {formData.address.country 
                ? countries.find(c => c.code === formData.address.country)?.name 
                : 'Select Country'}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showCountryDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md max-h-60 overflow-y-auto z-20 shadow-lg">
              {/* Search input */}
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Country list */}
              <div className="max-h-48 overflow-y-auto">
                {countries
                  .filter(country => 
                    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                    country.phoneCode.includes(countrySearch) ||
                    country.code.toLowerCase().includes(countrySearch.toLowerCase())
                  )
                  .map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      handleInputChange('address.country', country.code);
                      setShowCountryDropdown(false);
                      setCountrySearch('');
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-sm">{country.name}</span>
                    <span className="text-blue-600 text-xs font-medium">{country.phoneCode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!showAddressFields && (
        <div>
          <button
            type="button"
            onClick={() => setShowAddressFields(true)}
            disabled={isLoading}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Address
          </button>
        </div>
      )}

      {showAddressFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              value={formData.address.street}
              onChange={(e) => handleInputChange('address.street', e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) => handleInputChange('address.state', e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                value={formData.address.zipCode}
                onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </>
      )}
      
      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <span>Create Client</span>
          )}
        </button>
      </div>
    </form>
  );
} 

// Company Edit Form Component
function CompanyEditForm({
  formData,
  onSubmit,
  onCancel
}: {
  formData: InvoiceFormData;
  onSubmit: (updatedData: Partial<InvoiceFormData>) => void;
  onCancel: () => void;
}) {
  const [editData, setEditData] = useState({
    companyName: formData.companyName,
    companyEmail: formData.companyEmail,
    companyPhone: formData.companyPhone,
    companyAddress: {
      street: formData.companyAddress.street,
      city: formData.companyAddress.city,
      state: formData.companyAddress.state,
      zipCode: formData.companyAddress.zipCode,
      country: formData.companyAddress.country
    },
    companyTaxNumber: formData.companyTaxNumber,
    companyLogo: formData.companyLogo
  });
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedLogoId, setSelectedLogoId] = useState<string | undefined>(undefined);

  // Load logos and find the currently selected logo
  useEffect(() => {
    const loadLogos = async () => {
      try {
        const response = await fetch('/api/user/logos');
        const data = await response.json();
        
        if (data.success && data.logos) {
          // Find the logo that matches the current companyLogo URL
          if (editData.companyLogo) {
            const currentLogo = data.logos.find((logo: {id: string, name: string, url: string, isDefault: boolean, createdAt: Date}) => logo.url === editData.companyLogo);
            if (currentLogo) {
              setSelectedLogoId(currentLogo.id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading logos:', error);
      }
    };

    loadLogos();
  }, [editData.companyLogo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(editData);
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('companyAddress.')) {
      const addressField = field.split('.')[1];
      setEditData(prev => ({
        ...prev,
        companyAddress: {
          ...prev.companyAddress,
          [addressField]: value
        }
      }));
    } else {
      setEditData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleLogoSelect = (logo: {id: string, name: string, url: string, isDefault: boolean, createdAt: Date}) => {
    setEditData(prev => ({
      ...prev,
      companyLogo: logo.url
    }));
    setSelectedLogoId(logo.id);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Logo Selection Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
        <LogoSelector
          onLogoSelectAction={handleLogoSelect}
          selectedLogoId={selectedLogoId}
          className="mb-4"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          value={editData.companyName}
          onChange={(e) => handleInputChange('companyName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={editData.companyEmail}
          onChange={(e) => handleInputChange('companyEmail', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={editData.companyPhone}
          onChange={(e) => handleInputChange('companyPhone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
        <input
          type="text"
          value={editData.companyTaxNumber}
          onChange={(e) => handleInputChange('companyTaxNumber', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
            type="text"
            value={editData.companyAddress.street}
            onChange={(e) => handleInputChange('companyAddress.street', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={editData.companyAddress.city}
            onChange={(e) => handleInputChange('companyAddress.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={editData.companyAddress.state}
            onChange={(e) => handleInputChange('companyAddress.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
          <input
            type="text"
            value={editData.companyAddress.zipCode}
            onChange={(e) => handleInputChange('companyAddress.zipCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
            >
              <span className={editData.companyAddress.country ? 'text-gray-900' : 'text-gray-500'}>
                {editData.companyAddress.country 
                  ? countries.find(c => c.code === editData.companyAddress.country)?.name 
                  : 'Select Country'}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showCountryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md max-h-60 overflow-y-auto z-20 shadow-lg">
                {/* Search input */}
                <div className="p-2 border-b border-gray-200 bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search countries..."
                      className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-black placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
                
                {/* Country list */}
                <div className="max-h-48 overflow-y-auto">
                  {countries
                    .filter(country => 
                      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      country.phoneCode.includes(countrySearch) ||
                      country.code.toLowerCase().includes(countrySearch.toLowerCase())
                    )
                    .map(country => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        handleInputChange('companyAddress.country', country.code);
                        setShowCountryDropdown(false);
                        setCountrySearch('');
                      }}
                      className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                    >
                      <span className="text-sm">{country.name}</span>
                      <span className="text-blue-600 text-xs font-medium">{country.phoneCode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}

// Client Edit Form Component
function ClientEditForm({
  formData,
  formatPhoneForWhatsApp,
  extractCountryCodeFromPhone,
  setFormData,
  onSubmit,
  onCancel
}: {
  formData: InvoiceFormData;
  formatPhoneForWhatsApp: (phone: string, countryCode?: string) => string;
  extractCountryCodeFromPhone: (phone: string) => string | null;
  setFormData: React.Dispatch<React.SetStateAction<InvoiceFormData>>;
  onSubmit: (updatedData: Partial<InvoiceFormData>) => void;
  onCancel: () => void;
}) {
  const [editData, setEditData] = useState({
    clientName: formData.clientName,
    clientCompany: formData.clientCompany,
    clientEmail: formData.clientEmail,
    clientPhone: formData.clientPhone,
    clientAddress: {
      street: formData.clientAddress.street,
      city: formData.clientAddress.city,
      state: formData.clientAddress.state,
      zipCode: formData.clientAddress.zipCode,
      country: formData.clientAddress.country
    }
  });
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showAddressFields, setShowAddressFields] = useState(
    !!(formData.clientAddress.street || formData.clientAddress.state || formData.clientAddress.zipCode)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(editData);
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('clientAddress.')) {
      const addressField = field.split('.')[1];
      setEditData(prev => ({
        ...prev,
        clientAddress: {
          ...prev.clientAddress,
          [addressField]: value
        }
      }));
    } else {
      setEditData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={editData.clientName}
          onChange={(e) => handleInputChange('clientName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input
          type="text"
          value={editData.clientCompany}
          onChange={(e) => handleInputChange('clientCompany', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          placeholder="Company name (optional)"
        />
      </div>

      <div>
        {/* Email field - only show in Email mode */}
        {!formData.sendViaWhatsapp && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={editData.clientEmail}
              onChange={(e) => handleInputChange('clientEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
              required
            />
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone {formData.sendViaWhatsapp && <span className="text-red-500">*</span>}
        </label>
        <input
          type="tel"
          value={editData.clientPhone}
          onChange={(e) => {
            let value = e.target.value;
            
            // Auto-format phone number when WhatsApp is selected
            if (formData.sendViaWhatsapp) {
              // If user types a number starting with 0, auto-format it
              if (value && value.match(/^0\d/)) {
                value = formatPhoneForWhatsApp(value);
              }
              
              // Auto-detect country from phone number with country code
              if (value && value.startsWith('+')) {
                const detectedCountry = extractCountryCodeFromPhone(value);
                if (detectedCountry) {
                  // Update the country in the form data
                  setFormData(prev => ({
                    ...prev,
                    clientAddress: {
                      ...prev.clientAddress,
                      country: detectedCountry
                    }
                  }));
                }
              }
            }
            
            handleInputChange('clientPhone', value);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          placeholder={formData.sendViaWhatsapp ? "+1234567890 (include country code)" : "Phone number"}
        />
        {formData.sendViaWhatsapp && (
          <p className="text-xs text-gray-500 mt-1">
            Include country code for WhatsApp (e.g., +1234567890). Numbers starting with 0 will be auto-formatted.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <input
          type="text"
          value={editData.clientAddress.city}
          onChange={(e) => handleInputChange('clientAddress.city', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
          >
            <span className={editData.clientAddress.country ? 'text-gray-900' : 'text-gray-500'}>
              {editData.clientAddress.country 
                ? countries.find(c => c.code === editData.clientAddress.country)?.name 
                : 'Select Country'}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showCountryDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md max-h-60 overflow-y-auto z-20 shadow-lg">
              {/* Search input */}
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Country list */}
              <div className="max-h-48 overflow-y-auto">
                {countries
                  .filter(country => 
                    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                    country.phoneCode.includes(countrySearch) ||
                    country.code.toLowerCase().includes(countrySearch.toLowerCase())
                  )
                  .map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      handleInputChange('clientAddress.country', country.code);
                      setShowCountryDropdown(false);
                      setCountrySearch('');
                    }}
                    className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-sm">{country.name}</span>
                    <span className="text-blue-600 text-xs font-medium">{country.phoneCode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!showAddressFields && (
        <div>
          <button
            type="button"
            onClick={() => setShowAddressFields(true)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Address
          </button>
        </div>
      )}

      {showAddressFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              value={editData.clientAddress.street}
              onChange={(e) => handleInputChange('clientAddress.street', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={editData.clientAddress.state}
                onChange={(e) => handleInputChange('clientAddress.state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                value={editData.clientAddress.zipCode}
                onChange={(e) => handleInputChange('clientAddress.zipCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddressFields(false);
                // Clear only street, state, and zipCode when hiding (keep city and country)
                setEditData(prev => ({
                  ...prev,
                  clientAddress: {
                    ...prev.clientAddress,
                    street: '',
                    state: '',
                    zipCode: ''
                  }
                }));
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Remove Address
            </button>
          </div>
        </>
      )}

      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
} 