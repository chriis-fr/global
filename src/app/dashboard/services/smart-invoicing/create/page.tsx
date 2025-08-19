'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

import Link from 'next/link';
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
  Send,
  AlertCircle,
  LayoutDashboard,
  ChevronDown,
  Search,
  Mail,
  File,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { fiatCurrencies, cryptoCurrencies, getCurrencyByCode } from '@/data/currencies';
import { countries, getTaxRatesByCountry } from '@/data/countries';
import { networks } from '@/data/networks';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoicePdfView from '@/components/invoicing/InvoicePdfView';
import { LogoSelector } from '@/components/LogoSelector';
import { setCriticalOperation } from '@/components/dashboard/NotificationBadge';
import BankSelector from '@/components/BankSelector';
import { Bank } from '@/data';

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
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  swiftCode?: string;
  bankCode?: string;
  branchCode?: string;
  accountName?: string;
  accountNumber?: string;
  branchAddress?: string;
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
    country: 'US'
  },
  currency: 'USD',
  paymentMethod: 'fiat',
  paymentNetwork: '',
  paymentAddress: '',
  bankName: '',
  swiftCode: '',
  bankCode: '',
  branchCode: '',
  accountName: '',
  accountNumber: '',
  branchAddress: '',
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

// Add this utility function at the top of the file, after imports
const optimizeCanvasForPdf = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const optimizedCanvas = document.createElement('canvas');
  const ctx = optimizedCanvas.getContext('2d');
  
  // Optimize dimensions for PDF while maintaining quality
  const maxWidth = 1200; // Reduced from 1600 (800 * 2)
  const maxHeight = 1600;
  
  let { width, height } = canvas;
  
  // Scale down if too large
  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;
  }
  
  optimizedCanvas.width = width;
  optimizedCanvas.height = height;
  
  // Enable image smoothing for better quality
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, width, height);
  }
  
  return optimizedCanvas;
};

// Add PDF caching utility
const pdfCache = new Map<string, string>();

const generateOptimizedPdf = async (pdfContainer: HTMLElement, cacheKey?: string): Promise<{ pdf: jsPDF; base64: string }> => {
  // Ensure cacheKey is always a string
  const safeCacheKey = cacheKey || 'temp';
  
  // Check cache first
  if (pdfCache.has(safeCacheKey)) {
    const cachedBase64 = pdfCache.get(safeCacheKey)!;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // Note: We can't directly restore PDF from base64, but we can return the cached base64
    return { pdf, base64: cachedBase64 };
  }



  // Generate PDF using html2canvas with optimized options
  const canvas = await html2canvas(pdfContainer, {
    logging: false,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scale: 1.5, // Reduced from 2 for better size/quality balance
    width: 800,
    height: pdfContainer.scrollHeight,
    scrollX: 0,
    scrollY: 0,
    // Add performance optimizations
    removeContainer: true,
    foreignObjectRendering: false, // Disable for better performance
    imageTimeout: 15000 // 15 second timeout for images
  });



  // Optimize canvas
  const optimizedCanvas = optimizeCanvasForPdf(canvas);
  
  // Create PDF with optimized settings
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true // Enable PDF compression
  });

  const imgWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (optimizedCanvas.height * imgWidth) / optimizedCanvas.width;

  // If the content is too tall, split into multiple pages
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentHeight = pageHeight - (2 * margin);
  
  if (imgHeight <= contentHeight) {
    // Single page - use JPEG for smaller size
    const imageData = optimizedCanvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imageData, 'JPEG', margin, margin, imgWidth - (2 * margin), imgHeight);
  } else {
    // Multiple pages - optimized for performance
    const pages = Math.ceil(imgHeight / contentHeight);
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      
      const sourceY = i * contentHeight * (optimizedCanvas.width / (imgWidth - (2 * margin)));
      const sourceHeight = Math.min(contentHeight * (optimizedCanvas.width / (imgWidth - (2 * margin))), optimizedCanvas.height - sourceY);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = optimizedCanvas.width;
      tempCanvas.height = sourceHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx?.drawImage(optimizedCanvas, 0, sourceY, optimizedCanvas.width, sourceHeight, 0, 0, optimizedCanvas.width, sourceHeight);
      
      // Use JPEG for smaller size
      const imageData = tempCanvas.toDataURL('image/jpeg', 0.85);
      pdf.addImage(imageData, 'JPEG', margin, margin, imgWidth - (2 * margin), Math.min(contentHeight, imgHeight - (i * contentHeight)));
    }
  }

  // Convert to base64 with optimization
  const pdfBase64 = pdf.output('datauristring').split(',')[1];
  
  // Cache the result
  pdfCache.set(safeCacheKey, pdfBase64);
  // Limit cache size to prevent memory issues
  if (pdfCache.size > 10) {
    const firstKey = pdfCache.keys().next().value;
    if (firstKey) {
      pdfCache.delete(firstKey);
    }
  }



  return { pdf, base64: pdfBase64 };
};



export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [formData, setFormData] = useState<InvoiceFormData>(defaultInvoiceData);
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
  
  // CC Clients state
  const [showCcClientSelector, setShowCcClientSelector] = useState(false);
  const [showCcClientCreationModal, setShowCcClientCreationModal] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Currency dropdown state
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  
  // Network dropdown state
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [networkSearch, setNetworkSearch] = useState('');
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{
    _id: string;
    name: string;
    type: 'fiat' | 'crypto';
    fiatDetails?: {
      bankName: string;
      swiftCode: string;
      bankCode: string;
      branchCode: string;
      accountName: string;
      accountNumber: string;
      branchAddress: string;
    };
    cryptoDetails?: {
      network: string;
      address: string;
    };
  }>>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  // Check if we're editing an existing invoice
  const invoiceId = searchParams.get('id');

  // Check if any items have discounts
      const hasAnyDiscounts = formData.items.some(item => item.discount > 0);
    const hasAnyTaxes = formData.items.some(item => item.tax > 0);
  
  // Download dropdown state
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);



  useEffect(() => {
    // useEffect triggered
    if (invoiceId) {
      loadInvoice(invoiceId);
    } else if (session?.user) {
      // Loading data for user
      loadServiceOnboardingData();
      loadOrganizationData();
      loadClients();
      loadLogoFromSettings();
      loadSavedPaymentMethods();
    }
  }, [invoiceId, session]);

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

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Ensure all required fields are present with defaults
        const loadedData = {
          ...defaultInvoiceData,
          ...data.data,
          attachedFiles: data.data.attachedFiles || [],
          ccClients: data.data.ccClients || []
        };
        setFormData(loadedData);
        setIsEditing(true);
      }
    } catch (error) {
      console.error('Failed to load invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceOnboardingData = async () => {
    try {
      const response = await fetch('/api/onboarding/service?service=smartInvoicing');
      const data = await response.json();
      
      if (data.success && data.data.serviceOnboarding) {
        const onboardingData = data.data.serviceOnboarding;
        
        // Update form data with service onboarding information
        setFormData(prev => {
          const finalCountry = onboardingData.businessInfo?.address?.country || prev.companyAddress.country;
          
          // Service onboarding data loaded
          
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
            currency: onboardingData.invoiceSettings?.defaultCurrency || prev.currency
          };
        });
      }
    } catch (error) {
      console.error('Error loading service onboarding data:', error);
    }
  };

  const loadOrganizationData = async () => {
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
            companyEmail: org.email || prev.companyEmail,
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
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      if (data.success && data.data) {
        setClients(data.data);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadLogoFromSettings = async () => {
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
  };

  const handleInputChange = (field: keyof InvoiceFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankSelect = (bank: Bank) => {
    setFormData(prev => ({
      ...prev,
      bankName: bank.name,
      swiftCode: bank.swift_code,
      bankCode: bank.bank_code || ''
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
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
      alert('This client is already in the CC list.');
      return;
    }

    // Check if client is the primary client
    if (formData.clientEmail === client.email) {
      alert('This client is already the primary recipient.');
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
      }
    } catch (error) {
      console.error('Failed to create client:', error);
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
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate amount
    const item = newItems[index];
    const subtotalBeforeTax = item.quantity * item.unitPrice * (1 - item.discount / 100);
    item.amount = subtotalBeforeTax * (1 + item.tax / 100);
    
    // Recalculate totals
    const subtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - item.discount / 100)), 0);
    const totalTax = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - item.discount / 100) * (item.tax / 100)), 0);
    const total = subtotal + totalTax;
    
    setFormData(prev => ({
      ...prev,
      items: newItems,
      subtotal,
      totalTax,
      total
    }));
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
      const subtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - item.discount / 100)), 0);
      const totalTax = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - item.discount / 100) * (item.tax / 100)), 0);
      const total = subtotal + totalTax;
      
      setFormData(prev => ({
        ...prev,
        items: newItems,
        subtotal,
        totalTax,
        total
      }));
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
        body: JSON.stringify({
          ...formData,
          status: 'draft'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!isEditing && data.success) {
          // Update formData with the new invoice ID and invoice number
          setFormData(prev => ({
            ...prev,
            _id: data.data.id,
            invoiceNumber: data.data.invoiceNumber
          }));
          setIsEditing(true);
        }
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
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
    setCriticalOperation(true); // Disable notification polling during invoice sending

    try {
      // Starting invoice email send...

      let primaryInvoiceId: string;
      let primaryInvoiceNumber: string;

      // If this is a draft invoice (has _id), update it instead of creating new
      if (formData._id) {
        // Updating draft invoice...

        const updateResponse = await fetch(`/api/invoices/${formData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            status: 'sent'
          })
        });

        // Update invoice response status received

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('❌ [Smart Invoicing] Update invoice response error:', errorText);
          throw new Error(`Failed to update invoice: ${updateResponse.status} ${errorText}`);
        }

        const updateData = await updateResponse.json();
        // Update invoice response received

        if (!updateData.success) {
          throw new Error(`Failed to update invoice: ${updateData.message}`);
        }

        primaryInvoiceId = updateData.invoice._id;
        primaryInvoiceNumber = updateData.invoice.invoiceNumber;

        // Draft invoice updated successfully
      } else {
        // Create new invoice
        // Creating new invoice...

        const primaryInvoiceResponse = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            status: 'sent'
          })
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
            invoiceData: {
              ...formData,
              status: 'sent'
            }
          })
        });

        if (!ccInvoiceResponse.ok) {
          throw new Error('Failed to create CC invoices');
        }

        await ccInvoiceResponse.json();
      }

      // Create a simplified version of the invoice for PDF generation (same as handleDownloadPdf)
      const pdfContainer = document.createElement('div');
      pdfContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        color: black;
        font-family: Arial, sans-serif;
        padding: 32px;
        border: none;
        outline: none;
      `;

      // Create the exact invoice structure (same as handleDownloadPdf)
      pdfContainer.innerHTML = `
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 32px; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0;">
                ${formData.invoiceName || 'Invoice'}
              </h1>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
                <div>
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
                    Issued on ${formatDate(formData.issueDate)}
                  </div>
                  <div style="font-size: 14px; color: #6b7280;">
                    Payment due by ${formatDate(formData.dueDate)}
                  </div>
                  ${primaryInvoiceNumber ? `
                    <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                      Invoice: ${primaryInvoiceNumber}
                    </div>
                  ` : ''}
                </div>
                ${formData.companyLogo ? `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${formData.companyLogo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain; background: white;" />
                  </div>
                ` : `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <svg style="width: 32px; height: 32px; color: #9ca3af;" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                    </svg>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; gap: 48px;">
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                </svg>
                From
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.companyName || 'Company Name'}
              </div>
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.companyAddress.street || 'Street Address'}</div>
                <div>${formData.companyAddress.city || 'City'}, ${formData.companyAddress.state || 'State'} ${formData.companyAddress.zipCode || 'ZIP'}</div>
                <div>${formData.companyAddress.country ? countries.find(c => c.code === formData.companyAddress.country)?.name || formData.companyAddress.country : 'Country'}</div>
                <div>Tax: ${formData.companyTaxNumber || 'Tax Number'}</div>
                <div>${formData.companyEmail || 'Email'}</div>
                <div>${formData.companyPhone || 'Phone'}</div>
              </div>
            </div>
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Bill To
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.clientCompany ? formData.clientCompany : formData.clientName || 'Client Name'}
              </div>
              ${formData.clientCompany ? `
              <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                Attn: ${formData.clientName || 'Client Name'}
              </div>
              ` : ''}
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.clientAddress.street || 'Street Address'}</div>
                <div>${formData.clientAddress.city || 'City'}, ${formData.clientAddress.state || 'State'} ${formData.clientAddress.zipCode || 'ZIP'}</div>
                <div>${formData.clientAddress.country ? countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country : 'Country'}</div>
                <div>${formData.clientEmail || 'Email'}</div>
                <div>${formData.clientPhone || 'Phone'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 24px 0;">Invoice Items</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead style="background: #f9fafb;">
              <tr>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Description</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Unit Price</th>
                ${hasAnyDiscounts ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Discount</th>' : ''}
                ${hasAnyTaxes ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Tax</th>' : ''}
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${formData.items.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.description || 'Item description'}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.quantity}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${getCurrencySymbol()}${item.unitPrice.toFixed(2)}</td>
                  ${hasAnyDiscounts ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.discount > 0 ? `${item.discount}%` : ''}</td>` : ''}
                  ${hasAnyTaxes ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.tax > 0 ? `${item.tax}%` : ''}</td>` : ''}
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827;">${getCurrencySymbol()}${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 256px;">
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Amount without tax</span>
                <span>${getCurrencySymbol()}${formData.subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Total Tax amount</span>
                <span>${getCurrencySymbol()}${formData.totalTax.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-bottom: 8px;">
                <span>Total amount</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: #2563eb;">
                <span>Due</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Payment Information</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Payment Method</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
              </div>
              ${formData.paymentMethod === 'crypto' && formData.paymentNetwork ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Network: ${formData.paymentNetwork}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'crypto' && formData.paymentAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Address: ${formData.paymentAddress}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.bankName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Bank: ${formData.bankName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountNumber ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account: ${formData.accountNumber}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.swiftCode ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  SWIFT Code: ${formData.swiftCode}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account Name: ${formData.accountName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.branchAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Branch Address: ${formData.branchAddress}
                </div>
              ` : ''}
            </div>
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Currency</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.currency} (${getCurrencySymbol()})
              </div>
            </div>
          </div>
        </div>

        ${formData.memo ? `
          <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Memo</h3>
            <div style="font-size: 14px; color: #374151; white-space: pre-wrap;">
              ${formData.memo}
            </div>
          </div>
        ` : ''}

        ${formData.invoiceNumber ? `
          <div style="padding: 32px 0; text-align: center;">
            <div style="font-size: 14px; color: #6b7280;">
              Invoice Number: ${formData.invoiceNumber}
            </div>
          </div>
        ` : ''}

        <!-- Footer with watermark and security info -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
            <div style="margin-bottom: 8px; font-weight: 500;">
              Generated by Chains-ERP for ${formData.companyName || 'Company'}
            </div>
            <div style="margin-bottom: 8px; font-size: 11px;">
              Invoice Number: ${formData.invoiceNumber || 'N/A'} | Date: ${formatDate(formData.issueDate)}
            </div>
            <div style="font-size: 10px; color: #d1d5db;">
              Digital Invoice | Secure Payment Processing | Blockchain Verification
            </div>
          </div>
        </div>
      `;

      // Append to body temporarily
      document.body.appendChild(pdfContainer);

      // Wait for images to load
      const images = pdfContainer.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
          return new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
            } else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          });
        }));
      }

      // Generate optimized PDF
      const { pdf, base64: pdfBase64 } = await generateOptimizedPdf(pdfContainer, formData.invoiceNumber || 'temp');

      // Remove the temporary element
      document.body.removeChild(pdfContainer);

      // Add watermark
      addWatermark(pdf);

      console.log('📄 [PDF Generation] Converting PDF to base64...');
      const base64StartTime = Date.now();
      
      const base64EndTime = Date.now();
      console.log('📄 [PDF Generation] PDF base64 conversion completed in', base64EndTime - base64StartTime, 'ms');
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ [Smart Invoicing] Invoice sent successfully:', {
          invoiceNumber: formData.invoiceNumber,
          recipientEmail: formData.clientEmail,
          total: formData.total
        });
        alert('Invoice sent successfully! Check your email for confirmation.');
        // Redirect to invoices page
        router.push('/dashboard/services/smart-invoicing/invoices');
      } else {
        console.error('❌ [Smart Invoicing] Failed to send invoice:', result.message);
        alert(`Failed to send invoice: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to send invoice:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('Request timed out. Please try again or contact support if the issue persists.');
        } else {
          alert(`Failed to send invoice: ${error.message}`);
        }
      } else {
        alert('Failed to send invoice. Please try again.');
      }
    } finally {
      setSendingInvoice(false);
      setCriticalOperation(false); // Re-enable notification polling
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
        className={`${className} border-none outline-none bg-transparent`}
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
          className={`${className} border border-gray-300 rounded px-2 py-1 bg-white`}
          autoFocus
        />
      </div>
    ) : (
      <button
        onClick={() => setEditingField(field)}
        className={`${className} hover:bg-gray-100 px-2 py-1 rounded flex items-center group`}
      >
        {label} {formatDate(value)}
        <Edit3 className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
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
    if (!formData.clientAddress.street || formData.clientAddress.street.trim() === '') {
      errors.push('Client address is required');
    }
    
    // Items validation
    const hasValidItems = formData.items.some((item: { description: string; quantity: number; unitPrice: number }) => 
      item.description && item.description.trim() !== '' && 
      item.quantity > 0 && item.unitPrice > 0
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

    // Invoice number will be generated by the backend API
    // No need to generate it here

    setSendingInvoice(true);

    try {
      console.log('📤 [Smart Invoicing] Starting PDF download...', {
        invoiceNumber: formData.invoiceNumber,
        clientEmail: formData.clientEmail,
        total: formData.total
      });

      // Create a simplified version of the invoice for PDF generation
      const pdfContainer = document.createElement('div');
      pdfContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        color: black;
        font-family: Arial, sans-serif;
        padding: 32px;
        border: none;
        outline: none;
      `;

      // Create the exact invoice structure
      pdfContainer.innerHTML = `
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 32px; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0;">
                ${formData.invoiceName || 'Invoice'}
              </h1>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
                <div>
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
                    Issued on ${formatDate(formData.issueDate)}
                  </div>
                  <div style="font-size: 14px; color: #6b7280;">
                    Payment due by ${formatDate(formData.dueDate)}
                  </div>
                  ${formData.invoiceNumber ? `
                    <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                      Invoice: ${formData.invoiceNumber}
                    </div>
                  ` : ''}
                </div>
                ${formData.companyLogo ? `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${formData.companyLogo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain; background: white;" />
                  </div>
                ` : `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <svg style="width: 32px; height: 32px; color: #9ca3af;" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                    </svg>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; gap: 48px;">
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                </svg>
                From
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.companyName || 'Company Name'}
              </div>
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.companyAddress.street || 'Street Address'}</div>
                <div>${formData.companyAddress.city || 'City'}, ${formData.companyAddress.state || 'State'} ${formData.companyAddress.zipCode || 'ZIP'}</div>
                <div>${formData.companyAddress.country ? countries.find(c => c.code === formData.companyAddress.country)?.name || formData.companyAddress.country : 'Country'}</div>
                <div>Tax: ${formData.companyTaxNumber || 'Tax Number'}</div>
                <div>${formData.companyEmail || 'Email'}</div>
                <div>${formData.companyPhone || 'Phone'}</div>
              </div>
            </div>
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Bill To
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.clientCompany ? formData.clientCompany : formData.clientName || 'Client Name'}
              </div>
              ${formData.clientCompany ? `
              <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                Attn: ${formData.clientName || 'Client Name'}
              </div>
              ` : ''}
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.clientAddress.street || 'Street Address'}</div>
                <div>${formData.clientAddress.city || 'City'}, ${formData.clientAddress.state || 'State'} ${formData.clientAddress.zipCode || 'ZIP'}</div>
                <div>${formData.clientAddress.country ? countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country : 'Country'}</div>
                <div>${formData.clientEmail || 'Email'}</div>
                <div>${formData.clientPhone || 'Phone'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 24px 0;">Invoice Items</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead style="background: #f9fafb;">
              <tr>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Description</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Unit Price</th>
                ${hasAnyDiscounts ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Discount</th>' : ''}
                ${hasAnyTaxes ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Tax</th>' : ''}
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${formData.items.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.description || 'Item description'}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.quantity}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${getCurrencySymbol()}${item.unitPrice.toFixed(2)}</td>
                  ${hasAnyDiscounts ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.discount > 0 ? `${item.discount}%` : ''}</td>` : ''}
                  ${hasAnyTaxes ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.tax > 0 ? `${item.tax}%` : ''}</td>` : ''}
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827;">${getCurrencySymbol()}${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 256px;">
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Amount without tax</span>
                <span>${getCurrencySymbol()}${formData.subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Total Tax amount</span>
                <span>${getCurrencySymbol()}${formData.totalTax.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-bottom: 8px;">
                <span>Total amount</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: #2563eb;">
                <span>Due</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Payment Information</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Payment Method</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
              </div>
              ${formData.paymentMethod === 'crypto' && formData.paymentNetwork ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Network: ${formData.paymentNetwork}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'crypto' && formData.paymentAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Address: ${formData.paymentAddress}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.bankName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Bank: ${formData.bankName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountNumber ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account: ${formData.accountNumber}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.swiftCode ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  SWIFT Code: ${formData.swiftCode}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account Name: ${formData.accountName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.branchAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Branch Address: ${formData.branchAddress}
                </div>
              ` : ''}
            </div>
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Currency</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.currency} (${getCurrencySymbol()})
              </div>
            </div>
          </div>
        </div>

        ${formData.memo ? `
          <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Memo</h3>
            <div style="font-size: 14px; color: #374151; white-space: pre-wrap;">
              ${formData.memo}
            </div>
          </div>
        ` : ''}

        ${formData.invoiceNumber ? `
          <div style="padding: 32px 0; text-align: center;">
            <div style="font-size: 14px; color: #6b7280;">
              Invoice Number: ${formData.invoiceNumber}
            </div>
          </div>
        ` : ''}

        <!-- Footer with watermark and security info -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
            <div style="margin-bottom: 8px; font-weight: 500;">
              Generated by Chains-ERP for ${formData.companyName || 'Company'}
            </div>
            <div style="margin-bottom: 8px; font-size: 11px;">
              Invoice Number: ${formData.invoiceNumber || 'N/A'} | Date: ${formatDate(formData.issueDate)}
            </div>
            <div style="font-size: 10px; color: #d1d5db;">
              Digital Invoice | Secure Payment Processing | Blockchain Verification
            </div>
          </div>
        </div>
      `;

      // Append to body temporarily
      document.body.appendChild(pdfContainer);

      // Wait for images to load
      const images = pdfContainer.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
          return new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
            } else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          });
        }));
      }

            // Generate optimized PDF
      const { pdf, base64: pdfBase64 } = await generateOptimizedPdf(pdfContainer, formData.invoiceNumber || 'temp');

      // Remove the temporary element
      document.body.removeChild(pdfContainer);

      // Add watermark
      addWatermark(pdf);
      
      console.log('📧 [Smart Invoicing] Sending invoice via email...', {
        recipientEmail: formData.clientEmail,
        invoiceNumber: formData.invoiceNumber,
        pdfSize: pdfBase64.length
      });
      
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

      // Send invoice via email
      const response = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: formData._id,
          recipientEmail: formData.clientEmail,
          pdfBuffer: pdfBase64,
          attachedFiles: attachedFilesBase64
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ [Smart Invoicing] Invoice sent successfully:', {
          invoiceNumber: formData.invoiceNumber,
          recipientEmail: formData.clientEmail,
          total: formData.total
        });
        alert('Invoice sent successfully! Check your email for confirmation.');
        // Redirect to invoices page
        router.push('/dashboard/services/smart-invoicing/invoices');
      } else {
        console.error('❌ [Smart Invoicing] Failed to send invoice:', result.message);
        alert(`Failed to send invoice: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to send invoice:', error);
      alert('Failed to send invoice. Please try again.');
    } finally {
      setSendingInvoice(false);
      setCriticalOperation(false); // Re-enable notification polling
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

    // Invoice number will be generated by the backend API
    // No need to generate it here

    try {
      console.log('📤 [Smart Invoicing] Starting CSV download...', {
        invoiceNumber: formData.invoiceNumber,
        clientEmail: formData.clientEmail,
        total: formData.total
      });

      // Create CSV content
      const csvRows = [];
      
      // Header row
      const headers = ['Invoice Details'];
      csvRows.push(headers.join(','));
      
      // Invoice information
      csvRows.push(['Invoice Name', formData.invoiceName || 'Invoice']);
      csvRows.push(['Invoice Number', formData.invoiceNumber || 'N/A']);
      csvRows.push(['Issue Date', formatDate(formData.issueDate)]);
      csvRows.push(['Due Date', formatDate(formData.dueDate)]);
      csvRows.push(['']);
      
      // Company information
      csvRows.push(['Company Information']);
      csvRows.push(['Company Name', formData.companyName]);
      csvRows.push(['Email', formData.companyEmail]);
      csvRows.push(['Phone', formData.companyPhone]);
      csvRows.push(['Address', `${formData.companyAddress.street}, ${formData.companyAddress.city}, ${formData.companyAddress.state} ${formData.companyAddress.zipCode}, ${formData.companyAddress.country}`]);
      csvRows.push(['Tax Number', formData.companyTaxNumber]);
      csvRows.push(['']);
      
      // Client information
      csvRows.push(['Client Information']);
      if (formData.clientCompany) {
        csvRows.push(['Company', formData.clientCompany]);
        csvRows.push(['Contact Person', formData.clientName]);
      } else {
        csvRows.push(['Client Name', formData.clientName]);
      }
      csvRows.push(['Email', formData.clientEmail]);
      csvRows.push(['Phone', formData.clientPhone]);
      csvRows.push(['Address', `${formData.clientAddress.street}, ${formData.clientAddress.city}, ${formData.clientAddress.state} ${formData.clientAddress.zipCode}, ${formData.clientAddress.country}`]);
      csvRows.push(['']);
      
      // Items header
      const itemHeaders = ['Description', 'Quantity', 'Unit Price', 'Tax %', 'Amount'];
      if (hasAnyDiscounts) {
        itemHeaders.splice(3, 0, 'Discount %');
      }
      csvRows.push(['Invoice Items']);
      csvRows.push(itemHeaders.join(','));
      
      // Items data
      formData.items.forEach(item => {
        const itemRow = [
          item.description || 'Item description',
          item.quantity.toString(),
          `${getCurrencySymbol()}${item.unitPrice.toFixed(2)}`,
          item.tax > 0 ? item.tax.toString() + '%' : '',
          `${getCurrencySymbol()}${item.amount.toFixed(2)}`
        ];
        if (hasAnyDiscounts) {
          itemRow.splice(3, 0, item.discount > 0 ? item.discount.toString() + '%' : '');
        }
        csvRows.push(itemRow.join(','));
      });
      
      csvRows.push(['']);
      
      // Summary
      csvRows.push(['Summary']);
      csvRows.push(['Subtotal', `${getCurrencySymbol()}${formData.subtotal.toFixed(2)}`]);
      csvRows.push(['Total Tax', `${getCurrencySymbol()}${formData.totalTax.toFixed(2)}`]);
      csvRows.push(['Total Amount', `${getCurrencySymbol()}${formData.total.toFixed(2)}`]);
      csvRows.push(['']);
      
      // Payment information
      csvRows.push(['Payment Information']);
      csvRows.push(['Payment Method', formData.paymentMethod === 'fiat' ? 'Bank Transfer' : 'Cryptocurrency']);
      csvRows.push(['Currency', formData.currency]);
      
      if (formData.paymentMethod === 'fiat') {
        if (formData.bankName) csvRows.push(['Bank Name', formData.bankName]);
        if (formData.swiftCode) csvRows.push(['SWIFT Code', formData.swiftCode]);
        if (formData.bankCode) csvRows.push(['Bank Code', formData.bankCode]);
        if (formData.branchCode) csvRows.push(['Branch Code', formData.branchCode]);
        if (formData.accountName) csvRows.push(['Account Name', formData.accountName]);
        if (formData.accountNumber) csvRows.push(['Account Number', formData.accountNumber]);
        if (formData.branchAddress) csvRows.push(['Branch Address', formData.branchAddress]);
      } else {
        if (formData.paymentNetwork) csvRows.push(['Network', formData.paymentNetwork]);
        if (formData.paymentAddress) csvRows.push(['Payment Address', formData.paymentAddress]);
      }
      
      csvRows.push(['']);
      
      // Memo
      if (formData.memo) {
        csvRows.push(['Memo']);
        csvRows.push([formData.memo]);
        csvRows.push(['']);
      }
      
      // Footer
      csvRows.push(['Generated by Chains-ERP']);
      csvRows.push([`Invoice Number: ${formData.invoiceNumber || 'N/A'} | Date: ${formatDate(formData.issueDate)}`]);
      
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
        filename: `${formData.invoiceNumber || 'invoice'}_${formatDate(formData.issueDate).replace(/,/g, '')}.csv`
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };



  // Note: Invoice numbers are now generated by the backend API
  // No need to generate them on the frontend

  // Add watermark to PDF
  const addWatermark = (pdf: jsPDF) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add watermark text with better styling
    pdf.setTextColor(240, 240, 240); // Very light gray
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'normal');
    
    // Add watermark in center
    const text = 'DIGITAL INVOICE';
    const textWidth = pdf.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight / 2;
    
    // Add watermark with transparency effect
    pdf.text(text, x, y);
    
    // Reset text color for normal content
    pdf.setTextColor(0, 0, 0);
  };

  const handleSendPdf = async () => {
    const errors = validateInvoiceForPdf();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    // Invoice number will be generated by the backend API
    // No need to generate it here

    setSendingInvoice(true);

    try {
      console.log('📤 [Smart Invoicing] Starting PDF generation and sharing...', {
        invoiceNumber: formData.invoiceNumber,
        clientEmail: formData.clientEmail,
        total: formData.total
      });

      // Create a simplified version of the invoice for PDF generation (same as handleDownloadPdf)
      const pdfContainer = document.createElement('div');
      pdfContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        color: black;
        font-family: Arial, sans-serif;
        padding: 32px;
        border: none;
        outline: none;
      `;

      // Create the exact invoice structure
      pdfContainer.innerHTML = `
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 32px; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0;">
                ${formData.invoiceName || 'Invoice'}
              </h1>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
                <div>
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
                    Issued on ${formatDate(formData.issueDate)}
                  </div>
                  <div style="font-size: 14px; color: #6b7280;">
                    Payment due by ${formatDate(formData.dueDate)}
                  </div>
                  ${formData.invoiceNumber ? `
                    <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                      Invoice: ${formData.invoiceNumber}
                    </div>
                  ` : ''}
                </div>
                ${formData.companyLogo ? `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${formData.companyLogo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain; background: white;" />
                  </div>
                ` : `
                  <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <svg style="width: 32px; height: 32px; color: #9ca3af;" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                    </svg>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; gap: 48px;">
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5zM12 22c-4.75-1.11-8-4.67-8-9V8l8-4v18z"/>
                </svg>
                From
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.companyName || 'Company Name'}
              </div>
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.companyAddress.street || 'Street Address'}</div>
                <div>${formData.companyAddress.city || 'City'}, ${formData.companyAddress.state || 'State'} ${formData.companyAddress.zipCode || 'ZIP'}</div>
                <div>${formData.companyAddress.country ? countries.find(c => c.code === formData.companyAddress.country)?.name || formData.companyAddress.country : 'Country'}</div>
                <div>Tax: ${formData.companyTaxNumber || 'Tax Number'}</div>
                <div>${formData.companyEmail || 'Email'}</div>
                <div>${formData.companyPhone || 'Phone'}</div>
              </div>
            </div>
            <div style="flex: 1;">
              <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0; display: flex; align-items: center;">
                <svg style="width: 20px; height: 20px; color: #6b7280; margin-right: 8px;" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Bill To
              </h3>
              <div style="font-weight: 500; margin-bottom: 8px;">
                ${formData.clientCompany ? formData.clientCompany : formData.clientName || 'Client Name'}
              </div>
              ${formData.clientCompany ? `
              <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                Attn: ${formData.clientName || 'Client Name'}
              </div>
              ` : ''}
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <div>${formData.clientAddress.street || 'Street Address'}</div>
                <div>${formData.clientAddress.city || 'City'}, ${formData.clientAddress.state || 'State'} ${formData.clientAddress.zipCode || 'ZIP'}</div>
                <div>${formData.clientAddress.country ? countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country : 'Country'}</div>
                <div>${formData.clientEmail || 'Email'}</div>
                <div>${formData.clientPhone || 'Phone'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 24px 0;">Invoice Items</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead style="background: #f9fafb;">
              <tr>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Description</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Unit Price</th>
                ${hasAnyDiscounts ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Discount</th>' : ''}
                ${hasAnyTaxes ? '<th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Tax</th>' : ''}
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 500; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${formData.items.map(item => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.description || 'Item description'}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.quantity}</td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${getCurrencySymbol()}${item.unitPrice.toFixed(2)}</td>
                  ${hasAnyDiscounts ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.discount > 0 ? `${item.discount}%` : ''}</td>` : ''}
                  ${hasAnyTaxes ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.tax > 0 ? `${item.tax}%` : ''}</td>` : ''}
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827;">${getCurrencySymbol()}${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 256px;">
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Amount without tax</span>
                <span>${getCurrencySymbol()}${formData.subtotal.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <span>Total Tax amount</span>
                <span>${getCurrencySymbol()}${formData.totalTax.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-bottom: 8px;">
                <span>Total amount</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: #2563eb;">
                <span>Due</span>
                <span>${getCurrencySymbol()}${formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Payment Information</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Payment Method</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
              </div>
              ${formData.paymentMethod === 'crypto' && formData.paymentNetwork ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Network: ${formData.paymentNetwork}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'crypto' && formData.paymentAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Address: ${formData.paymentAddress}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.bankName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Bank: ${formData.bankName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountNumber ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account: ${formData.accountNumber}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.swiftCode ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  SWIFT Code: ${formData.swiftCode}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.accountName ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Account Name: ${formData.accountName}
                </div>
              ` : ''}
              ${formData.paymentMethod === 'fiat' && formData.branchAddress ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Branch Address: ${formData.branchAddress}
                </div>
              ` : ''}
            </div>
            <div>
              <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Currency</h4>
              <div style="font-size: 14px; color: #6b7280;">
                ${formData.currency} (${getCurrencySymbol()})
              </div>
            </div>
          </div>
        </div>

        ${formData.memo ? `
          <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Memo</h3>
            <div style="font-size: 14px; color: #374151; white-space: pre-wrap;">
              ${formData.memo}
            </div>
          </div>
        ` : ''}

        ${formData.invoiceNumber ? `
          <div style="padding: 32px 0; text-align: center;">
            <div style="font-size: 14px; color: #6b7280;">
              Invoice Number: ${formData.invoiceNumber}
            </div>
          </div>
        ` : ''}

        <!-- Footer with watermark and security info -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
            <div style="margin-bottom: 8px; font-weight: 500;">
              Generated by Chains-ERP for ${formData.companyName || 'Company'}
            </div>
            <div style="margin-bottom: 8px; font-size: 11px;">
              Invoice Number: ${formData.invoiceNumber || 'N/A'} | Date: ${formatDate(formData.issueDate)}
            </div>
            <div style="font-size: 10px; color: #d1d5db;">
              Digital Invoice | Secure Payment Processing | Blockchain Verification
            </div>
          </div>
        </div>
      `;

      // Append to body temporarily
      document.body.appendChild(pdfContainer);

      // Wait for images to load
      const images = pdfContainer.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(Array.from(images).map(img => {
          return new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
            } else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          });
        }));
      }

      // Generate optimized PDF
      const { pdf } = await generateOptimizedPdf(pdfContainer, formData.invoiceNumber || 'temp');

      // Remove the temporary element
      document.body.removeChild(pdfContainer);

      // Add watermark
      addWatermark(pdf);

      // Save invoice to database
      await saveInvoiceToDatabase(formData);

      // Generate secure shareable link
      const pdfBase64Full = pdf.output('datauristring');
      
      // Create a shareable link (you can implement your own file sharing service)
      const shareableLink = `data:application/pdf;base64,${pdfBase64Full.split(',')[1]}`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareableLink).then(() => {
        console.log('📤 [Smart Invoicing] PDF shared successfully:', {
          invoiceNumber: formData.invoiceNumber,
          shareableLink: shareableLink.substring(0, 100) + '...'
        });
        alert('PDF generated and link copied to clipboard! You can now share this secure link.');
      }).catch(() => {
        console.log('📤 [Smart Invoicing] PDF generated but clipboard access denied');
        alert('PDF generated successfully! You can download and share the file.');
      });

      // Redirect to invoices page
      router.push('/dashboard/services/smart-invoicing/invoices');

    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to share PDF:', error);
      alert('Failed to share PDF. Please try again.');
    } finally {
      setSendingInvoice(false);
    }
  };

  // Save invoice to database
  const saveInvoiceToDatabase = async (invoiceData: InvoiceFormData) => {
    try {
            console.log('💾 [Smart Invoicing] Saving invoice to database');

      // Convert File objects to metadata for database storage
      const attachedFilesMetadata = (invoiceData.attachedFiles || []).map(file => ({
        filename: file.name,
        originalName: file.name,
        size: file.size,
        contentType: file.type,
        uploadedAt: new Date()
      }));

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...invoiceData,
          attachedFiles: attachedFilesMetadata,
          status: 'pending', // Set as pending when sent
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ [Smart Invoicing] Invoice saved to database:', {
          id: result.invoice._id,
          invoiceNumber: result.invoice.invoiceNumber
        });
        // Update the form data with the saved invoice ID
        handleInputChange('_id', result.invoice._id);
        return result.invoice;
      } else {
        console.error('❌ [Smart Invoicing] Failed to save invoice:', result.message);
        return null;
      }
    } catch (error) {
      console.error('❌ [Smart Invoicing] Error saving invoice:', error);
      return null;
    }
  };

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
            bankName: selectedMethod.fiatDetails?.bankName || '',
            swiftCode: selectedMethod.fiatDetails?.swiftCode || '',
            bankCode: selectedMethod.fiatDetails?.bankCode || '',
            branchCode: selectedMethod.fiatDetails?.branchCode || '',
            accountName: selectedMethod.fiatDetails?.accountName || '',
            accountNumber: selectedMethod.fiatDetails?.accountNumber || '',
            branchAddress: selectedMethod.fiatDetails?.branchAddress || ''
          }));
        } else if (selectedMethod.type === 'crypto') {
          setFormData(prev => ({
            ...prev,
            paymentMethod: 'crypto',
            paymentNetwork: selectedMethod.cryptoDetails?.network || '',
            paymentAddress: selectedMethod.cryptoDetails?.address || ''
          }));
        }
      }
    }
  };

  // Load saved payment methods
  const loadSavedPaymentMethods = async () => {
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
  };

  if (loading && invoiceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading invoice...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isEditing ? 'Update Draft' : 'Save Draft'}</span>
            </button>
            
            <button
              onClick={handleSendPdf}
              disabled={sendingInvoice}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingInvoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{sendingInvoice ? 'Sending...' : 'Send PDF'}</span>
            </button>
          </div>
        </div>



        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
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

        {/* Invoice Document */}
        <div ref={printRef} className="bg-white rounded-lg shadow-lg border max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start space-y-4 sm:space-y-0">
              {/* Left Side - Invoice Name */}
              <div className="flex-1">
                {renderEditableField('invoiceName', formData.invoiceName, 'Invoice #')}
              </div>

              {/* Right Side - Dates and Logo */}
              <div className="text-right space-y-2 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="text-sm text-gray-600">
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
                    onClick={() => setShowCompanyEditModal(true)}
                    className="w-16 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer flex-shrink-0 group relative overflow-hidden"
                  >
                    {formData.companyLogo ? (
                      <>
                        <Image 
                          src={formData.companyLogo} 
                          alt="Company Logo" 
                          width={64}
                          height={64}
                          className="object-contain w-full h-full"
                          unoptimized={formData.companyLogo.startsWith('data:')}
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
                    onClick={() => setShowCompanyEditModal(true)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </h3>
                <div className="flex items-start space-x-4">
                 
                  
                  {/* Company Details */}
                  <div className="flex-1 space-y-2">
                    <div className="font-medium">
                      {formData.companyName || 'Company Name'}
                    </div>
                    <div className="text-gray-600 space-y-1">
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
                    <div className="text-gray-600">
                      Tax: {formData.companyTaxNumber || 'Tax Number'}
                    </div>
                    <div className="text-gray-600">
                      {formData.companyEmail || 'Email'}
                    </div>
                    <div className="text-gray-600">
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
                    <button
                      onClick={() => setShowClientEditModal(true)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowClientSelector(!showClientSelector)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {formData.clientName ? 'Change Client' : 'Add Client'}
                    </button>
                  </div>
                </div>
                
                {/* Client Selector Dropdown */}
                {showClientSelector && (
                  <div className="absolute z-10 mt-2 w-full sm:w-80 bg-white border border-gray-300 rounded-lg shadow-lg">
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
                              <div className="font-medium">
                                {client.company ? client.company : client.name}
                              </div>
                              {client.company && (
                                <div className="text-sm text-gray-500">Attn: {client.name}</div>
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

                <div className="space-y-2">
                  <div className="font-medium">
                    {formData.clientCompany ? formData.clientCompany : formData.clientName || 'Client Name'}
                  </div>
                  {formData.clientCompany && (
                    <div className="text-gray-600">
                      Attn: {formData.clientName || 'Client Name'}
                    </div>
                  )}
                  <div className="text-gray-600 space-y-1">
                    <div>{formData.clientAddress.street || 'Street Address'}</div>
                    <div className="flex space-x-2">
                      <span>{formData.clientAddress.city || 'City'}</span>
                      <span>{formData.clientAddress.state || 'State'}</span>
                      <span>{formData.clientAddress.zipCode || 'ZIP'}</span>
                    </div>
                    <div>{formData.clientAddress.country ? countries.find(c => c.code === formData.clientAddress.country)?.name || formData.clientAddress.country : 'Country'}</div>
                  </div>
                  <div className="text-gray-600">
                    {formData.clientEmail || 'Email'}
                  </div>
                  <div className="text-gray-600">
                    {formData.clientPhone || 'Phone'}
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
                                    <div className="text-sm text-gray-500">Attn: {client.name}</div>
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
                              <div className="text-xs text-gray-500">Attn: {ccClient.name}</div>
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
                    <span className={formData.currency ? 'text-gray-900' : 'text-gray-500'}>
                      {formData.currency 
                        ? `${formData.currency} - ${getCurrencyByCode(formData.currency)?.name || 'Unknown'}`
                        : 'Select currency'}
                    </span>
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
                      className="mr-2"
                    />
                    <span className="text-sm">Regular</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="recurring"
                      checked={formData.invoiceType === 'recurring'}
                      onChange={(e) => handleInputChange('invoiceType', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Recurring</span>
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
                    <span className="text-sm">Enable Multi-Currency</span>
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
              <select
                value={selectedPaymentMethodId || ''}
                onChange={(e) => handlePaymentMethodSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white font-medium"
              >
                <option value="">-- Select a saved payment method --</option>
                {savedPaymentMethods.map((method) => (
                  <option key={method._id} value={method._id}>
                    {method.name} ({method.type === 'fiat' ? 'Bank Transfer' : 'Crypto'})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
                <div className="space-y-3">
                  <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="fiat"
                      checked={formData.paymentMethod === 'fiat'}
                      onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <div className="font-medium">Fiat ({formData.currency})</div>
                        <div className="text-sm text-gray-500">Bank transfer</div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="crypto"
                      checked={formData.paymentMethod === 'crypto'}
                      onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex items-center">
                      <Wallet className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <div className="font-medium">Crypto</div>
                        <div className="text-sm text-gray-500">Cryptocurrency payment</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Details</label>
                {formData.paymentMethod === 'crypto' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Choose your payment network</label>
                      <div className="relative network-dropdown-container">
                        <button
                          type="button"
                          onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
                        >
                          <span className={formData.paymentNetwork ? 'text-gray-900' : 'text-gray-500'}>
                            {formData.paymentNetwork 
                              ? networks.find(n => n.id === formData.paymentNetwork)?.name || formData.paymentNetwork
                              : 'Select network'}
                          </span>
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
                                    setShowNetworkDropdown(false);
                                    setNetworkSearch('');
                                  }}
                                  className="w-full px-3 py-2 text-left text-gray-900 hover:bg-blue-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center space-x-3">
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
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Where do you want to receive your payment?</label>
                      <input
                        type="text"
                        value={formData.paymentAddress || ''}
                        onChange={(e) => handleInputChange('paymentAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Enter wallet address"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-4 pr-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
                      <BankSelector
                        countryCode={formData.companyAddress.country}
                        value={formData.bankName || ''}
                        onBankSelectAction={handleBankSelect}
                        onInputChangeAction={(value) => handleInputChange('bankName', value)}
                        placeholder="Search for a bank..."
                        disabled={!formData.companyAddress.country}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">SWIFT Code</label>
                      <input
                        type="text"
                        value={formData.swiftCode || ''}
                        onChange={(e) => handleInputChange('swiftCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="SWIFT/BIC code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Bank Code</label>
                      <input
                        type="text"
                        value={formData.bankCode || ''}
                        onChange={(e) => handleInputChange('bankCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Bank code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Branch Code</label>
                      <input
                        type="text"
                        value={formData.branchCode || ''}
                        onChange={(e) => handleInputChange('branchCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Branch code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Account Name</label>
                      <input
                        type="text"
                        value={formData.accountName || ''}
                        onChange={(e) => handleInputChange('accountName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Account holder name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={formData.accountNumber || ''}
                        onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Branch Address</label>
                      <textarea
                        value={formData.branchAddress || ''}
                        onChange={(e) => handleInputChange('branchAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                        placeholder="Branch address"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
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
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter description"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      {hasAnyDiscounts && (
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <input
                                type="number"
                                value={item.discount}
                                onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 pr-6 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                max="100"
                                step="0.01"
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
                            value={item.tax}
                            onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 pr-6 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max="100"
                            step="0.01"
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
                                if (taxRate > 0) {
                                  handleItemChange(index, 'tax', taxRate);
                                }
                              }
                            }}
                            className="w-full text-xs px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value=""
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
                      <td className="py-3 px-4 font-medium">
                        {getCurrencySymbol()}{item.amount.toFixed(2)}
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
                <div className="flex justify-between text-gray-600">
                  <span>Amount without tax</span>
                  <span>{getCurrencySymbol()}{formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Tax amount</span>
                  <span>{getCurrencySymbol()}{formData.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>{getCurrencySymbol()}{formData.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>{getCurrencySymbol()}{formData.total.toFixed(2)}</span>
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
                  <span>Download as PDF</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadCsv();
                    setShowDownloadDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <File className="h-4 w-4 text-blue-500" />
                  <span>Download as CSV</span>
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
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Client</h3>
                <button
                  onClick={() => setShowNewClientModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <ClientCreationForm 
                onSubmit={handleCreateClient}
                onCancel={() => setShowNewClientModal(false)}
              />
            </div>
          </div>
        )}

        {/* CC Client Creation Modal */}
        {showCcClientCreationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New CC Client</h3>
                <button
                  onClick={() => setShowCcClientCreationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
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
        )}

        {/* Company Edit Modal */}
        {showCompanyEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Company Information</h3>
                <button
                  onClick={() => setShowCompanyEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
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
        )}

        {/* Client Edit Modal */}
        {showClientEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto relative shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Client Information</h3>
                <button
                  onClick={() => setShowClientEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
              
              <ClientEditForm 
                formData={formData}
                onSubmit={(updatedData) => {
                  setFormData(prev => ({ ...prev, ...updatedData }));
                  setShowClientEditModal(false);
                }}
                onCancel={() => setShowClientEditModal(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hidden PDF View for PDF Generation */}
      <div ref={pdfRef} className="hidden">
        <InvoicePdfView formData={formData} invoiceNumber={formData.invoiceNumber} />
      </div>

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
      >
        <LayoutDashboard className="h-6 w-6" />
      </Link>
    </div>
  );
}

// Client Creation Form Component
function ClientCreationForm({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (clientData: Omit<Client, '_id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    taxId: '',
    notes: '',
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input
          type="text"
          value={formData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
        <input
          type="text"
          value={formData.address.street}
          onChange={(e) => handleInputChange('address.street', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={formData.address.city}
            onChange={(e) => handleInputChange('address.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={formData.address.state}
            onChange={(e) => handleInputChange('address.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
          <input
            type="text"
            value={formData.address.zipCode}
            onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
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
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
        <input
          type="text"
          value={formData.taxId}
          onChange={(e) => handleInputChange('taxId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
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
          Create Client
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
  onSubmit,
  onCancel
}: {
  formData: InvoiceFormData;
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={editData.clientEmail}
          onChange={(e) => handleInputChange('clientEmail', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={editData.clientPhone}
          onChange={(e) => handleInputChange('clientPhone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
        />
      </div>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={editData.clientAddress.city}
            onChange={(e) => handleInputChange('clientAddress.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={editData.clientAddress.state}
            onChange={(e) => handleInputChange('clientAddress.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
          <input
            type="text"
            value={editData.clientAddress.zipCode}
            onChange={(e) => handleInputChange('clientAddress.zipCode', e.target.value)}
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