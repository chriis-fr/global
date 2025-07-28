'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save,
  Check,
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
  Search
} from 'lucide-react';
import { fiatCurrencies, cryptoCurrencies, getCurrencyByCode } from '@/data/currencies';
import { countries } from '@/data/countries';
import { networks } from '@/data/networks';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoicePdfView from '@/components/invoicing/InvoicePdfView';

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
  accountNumber?: string;
  routingNumber?: string;
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
  status: 'draft'
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
  const printRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Check if we're editing an existing invoice
  const invoiceId = searchParams.get('id');

  useEffect(() => {
    if (invoiceId) {
      loadInvoice(invoiceId);
    } else if (session?.user) {
      loadServiceOnboardingData();
      loadOrganizationData();
      loadClients();
    }
  }, [invoiceId, session]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setFormData(data.data);
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
        setFormData(prev => ({
          ...prev,
          companyName: onboardingData.businessInfo?.name || prev.companyName,
          companyEmail: onboardingData.businessInfo?.email || prev.companyEmail,
          companyPhone: onboardingData.businessInfo?.phone || prev.companyPhone,
          companyAddress: {
            street: onboardingData.businessInfo?.address?.street || prev.companyAddress.street,
            city: onboardingData.businessInfo?.address?.city || prev.companyAddress.city,
            state: onboardingData.businessInfo?.address?.state || prev.companyAddress.state,
            zipCode: onboardingData.businessInfo?.address?.zipCode || prev.companyAddress.zipCode,
            country: onboardingData.businessInfo?.address?.country || prev.companyAddress.country
          },
          companyTaxNumber: onboardingData.businessInfo?.taxId || prev.companyTaxNumber,
          currency: onboardingData.invoiceSettings?.defaultCurrency || prev.currency
        }));
        
        console.log('✅ [Invoice Create] Service onboarding data loaded from:', data.data.storageLocation);
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
        setFormData(prev => ({
          ...prev,
          companyName: org.name || prev.companyName,
          companyEmail: org.email || prev.companyEmail,
          companyPhone: org.phone || prev.companyPhone,
          companyAddress: {
            street: org.address?.street || prev.companyAddress.street,
            city: org.address?.city || prev.companyAddress.city,
            state: org.address?.state || prev.companyAddress.state,
            zipCode: org.address?.zipCode || prev.companyAddress.zipCode,
            country: org.address?.country || prev.companyAddress.country
          }
        }));
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

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const selectClient = (client: Client) => {
    setFormData(prev => ({
      ...prev,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone || '',
      clientAddress: {
        street: client.address || '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      }
    }));
    setShowClientSelector(false);
  };

  const createNewClient = () => {
    setShowNewClientModal(true);
    setShowClientSelector(false);
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
    setLoading(true);
    try {
      const url = isEditing ? `/api/invoices/${formData._id}` : '/api/invoices';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'sent'
        })
      });
      
      if (response.ok) {
        router.push('/dashboard/services/smart-invoicing');
      }
    } catch (error) {
      console.error('Failed to send invoice:', error);
    } finally {
      setLoading(false);
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
        onChange={(e) => handleInputChange(field, e.target.value)}
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
          onChange={(e) => handleInputChange(field, e.target.value)}
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

    const element = pdfRef.current;
    if (!element) {
      return;
    }

    try {
      // Clone the element to avoid modifying the live DOM
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Create a style element with explicit CSS overrides for oklch colors
      const style = document.createElement('style');
      style.textContent = `
        .bg-gray-50 { background-color: #f9fafb !important; }
        .bg-white { background-color: #ffffff !important; }
        .text-gray-900 { color: #111827 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-green-600 { color: #059669 !important; }
        .text-blue-600 { color: #2563eb !important; }
        .border-gray-200 { border-color: #e5e7eb !important; }
        .border-t { border-top-width: 1px !important; }
        .divide-y > * + * { border-top-width: 1px !important; border-color: #e5e7eb !important; }
        .divide-gray-200 > * + * { border-color: #e5e7eb !important; }
      `;
      clone.appendChild(style);
      
      // Temporarily append to body for rendering
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);
      
      const canvas = await html2canvas(clone, {
        logging: false,
        removeContainer: true
      });
      
      // Remove the clone
      document.body.removeChild(clone);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`invoice-${formData.invoiceName || 'document'}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
  };

  const handleSendPdf = async () => {
    const errors = validateInvoiceForPdf();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const element = pdfRef.current;
    if (!element) {
      return;
    }

    setSendingInvoice(true);

    try {
      // Clone the element to avoid modifying the live DOM
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Create a style element with explicit CSS overrides for oklch colors
      const style = document.createElement('style');
      style.textContent = `
        .bg-gray-50 { background-color: #f9fafb !important; }
        .bg-white { background-color: #ffffff !important; }
        .text-gray-900 { color: #111827 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-green-600 { color: #059669 !important; }
        .text-blue-600 { color: #2563eb !important; }
        .border-gray-200 { border-color: #e5e7eb !important; }
        .border-t { border-top-width: 1px !important; }
        .divide-y > * + * { border-top-width: 1px !important; border-color: #e5e7eb !important; }
        .divide-gray-200 > * + * { border-color: #e5e7eb !important; }
      `;
      clone.appendChild(style);
      
      // Temporarily append to body for rendering
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);
      
      const canvas = await html2canvas(clone, {
        logging: false,
        removeContainer: true
      });
      
      // Remove the clone
      document.body.removeChild(clone);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Convert PDF to base64 for email attachment
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      
      // Send invoice via email
      const response = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: formData._id,
          recipientEmail: formData.clientEmail,
          pdfBuffer: pdfBase64
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Invoice sent successfully!');
        // Optionally redirect to dashboard or invoice list
        router.push('/dashboard/services/smart-invoicing');
      } else {
        alert(`Failed to send invoice: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to send invoice:', error);
      alert('Failed to send invoice. Please try again.');
    } finally {
      setSendingInvoice(false);
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
              onClick={handleSendInvoice}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Send Invoice</span>
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
                {renderEditableField('invoiceName', formData.invoiceName, 'Invoice')}
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
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer flex-shrink-0">
                    {formData.companyLogo ? (
                      <Image 
                        src={formData.companyLogo} 
                        alt="Company Logo" 
                        width={64}
                        height={64}
                        className="w-full h-full object-cover rounded-lg" 
                      />
                    ) : (
                      <Upload className="h-6 w-6 text-gray-400" />
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
                <div className="space-y-2">
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
                    <div>{formData.companyAddress.country || 'Country'}</div>
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
                              <div className="font-medium">{client.name}</div>
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
                    {formData.clientName || 'Client Name'}
                  </div>
                  <div className="text-gray-600 space-y-1">
                    <div>{formData.clientAddress.street || 'Street Address'}</div>
                    <div className="flex space-x-2">
                      <span>{formData.clientAddress.city || 'City'}</span>
                      <span>{formData.clientAddress.state || 'State'}</span>
                      <span>{formData.clientAddress.zipCode || 'ZIP'}</span>
                    </div>
                    <div>{formData.clientAddress.country || 'Country'}</div>
                  </div>
                  <div className="text-gray-600">
                    {formData.clientEmail || 'Email'}
                  </div>
                  <div className="text-gray-600">
                    {formData.clientPhone || 'Phone'}
                  </div>
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
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <optgroup label="Fiat Currencies">
                    {fiatCurrencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Cryptocurrencies">
                    {cryptoCurrencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </optgroup>
                </select>
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
                      <select
                        value={formData.paymentNetwork || ''}
                        onChange={(e) => handleInputChange('paymentNetwork', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Network</option>
                        {networks.map(network => (
                          <option key={network.id} value={network.id}>
                            {network.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Where do you want to receive your payment?</label>
                      <input
                        type="text"
                        value={formData.paymentAddress || ''}
                        onChange={(e) => handleInputChange('paymentAddress', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter wallet address"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={formData.bankName || ''}
                        onChange={(e) => handleInputChange('bankName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Bank name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={formData.accountNumber || ''}
                          onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Account number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Routing Number</label>
                        <input
                          type="text"
                          value={formData.routingNumber || ''}
                          onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Routing number"
                        />
                      </div>
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
              <button
                onClick={addItem}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
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
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        <span className="text-gray-500 ml-1">%</span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.tax}
                          onChange={(e) => handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                        <span className="text-gray-500 ml-1">%</span>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a memo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attached files</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No file attached yet.</p>
                  <p className="text-xs text-gray-500 mt-1">Click to upload files</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Buttons */}
        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4 mt-8 mb-6">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
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

        {/* Client Creation Modal */}
        {showNewClientModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
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

        {/* Company Edit Modal */}
        {showCompanyEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Company Information</h3>
                <button
                  onClick={() => setShowCompanyEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
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
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Client Information</h3>
                <button
                  onClick={() => setShowClientEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
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
    address: '',
    company: '',
    taxId: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input
          type="text"
          value={formData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
        <input
          type="text"
          value={formData.taxId}
          onChange={(e) => handleInputChange('taxId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
    companyTaxNumber: formData.companyTaxNumber
  });
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          value={editData.companyName}
          onChange={(e) => handleInputChange('companyName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={editData.companyEmail}
          onChange={(e) => handleInputChange('companyEmail', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={editData.companyPhone}
          onChange={(e) => handleInputChange('companyPhone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
        <input
          type="text"
          value={editData.companyTaxNumber}
          onChange={(e) => handleInputChange('companyTaxNumber', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
        <input
          type="text"
          value={editData.companyAddress.street}
          onChange={(e) => handleInputChange('companyAddress.street', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={editData.companyAddress.city}
            onChange={(e) => handleInputChange('companyAddress.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={editData.companyAddress.state}
            onChange={(e) => handleInputChange('companyAddress.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={editData.clientEmail}
          onChange={(e) => handleInputChange('clientEmail', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={editData.clientPhone}
          onChange={(e) => handleInputChange('clientPhone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
        <input
          type="text"
          value={editData.clientAddress.street}
          onChange={(e) => handleInputChange('clientAddress.street', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={editData.clientAddress.city}
            onChange={(e) => handleInputChange('clientAddress.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={editData.clientAddress.state}
            onChange={(e) => handleInputChange('clientAddress.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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