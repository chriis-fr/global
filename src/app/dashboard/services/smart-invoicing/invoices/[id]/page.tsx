'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Edit3,
  Trash2,
  Building2,
  User,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  Download,
  File,
  ChevronDown as ChevronDownIcon,
  Receipt
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { countries } from '@/data/countries';
import { getCurrencyByCode } from '@/data/currencies';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  invoiceName?: string;
  issueDate?: string;
  dueDate?: string;
  companyLogo?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  companyTaxNumber?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  currency?: string;
  paymentMethod?: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  enableMultiCurrency?: boolean;
  invoiceType?: 'regular' | 'recurring';
  items?: Array<{
    id?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    tax?: number;
    amount?: number;
  }>;
  subtotal?: number;
  totalTax?: number;
  total?: number;
  totalAmount?: number;
  memo?: string;
  status?: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue';
  createdAt?: string;
  updatedAt?: string;
  companyDetails?: {
    name: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    taxNumber?: string;
  };
  clientDetails?: {
    companyName: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  paymentSettings?: {
    method: 'fiat' | 'crypto';
    cryptoNetwork?: string;
    walletAddress?: string;
    bankAccount?: {
      bankName?: string;
      accountNumber?: string;
      routingNumber?: string;
    };
    currency?: string;
    enableMultiCurrency?: boolean;
  };
}

export default function InvoiceViewPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  // Check if any items have discounts or taxes
  const hasAnyDiscounts = invoice?.items?.some(item => (item.discount || 0) > 0) || false;
  const hasAnyTaxes = invoice?.items?.some(item => (item.tax || 0) > 0) || false;

  // PDF generation functions
  const optimizeCanvasForPdf = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const optimizedCanvas = document.createElement('canvas');
    const ctx = optimizedCanvas.getContext('2d');
    if (!ctx) return canvas;

    // Set optimized dimensions
    const maxWidth = 800;
    const maxHeight = 1200;
    const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1);
    
    optimizedCanvas.width = canvas.width * scale;
    optimizedCanvas.height = canvas.height * scale;

    // Draw with optimization
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, optimizedCanvas.width, optimizedCanvas.height);

    return optimizedCanvas;
  };

  const generateOptimizedPdf = async (pdfContainer: HTMLElement): Promise<{ pdf: jsPDF; base64: string }> => {
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
      compress: true
    });

    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (optimizedCanvas.height * imgWidth) / optimizedCanvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    // Add image to PDF - use JPEG for better quality and smaller size
    const imgData = optimizedCanvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Generate base64
    const base64 = pdf.output('datauristring').split(',')[1];
    
    return { pdf, base64 };
  };

  const addWatermark = (pdf: jsPDF, invoiceNumber?: string) => {
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
    
    // Add invoice number watermark if provided
    if (invoiceNumber) {
      pdf.setFontSize(16);
      const invoiceText = `Invoice: ${invoiceNumber}`;
      const invoiceTextWidth = pdf.getTextWidth(invoiceText);
      const invoiceX = (pageWidth - invoiceTextWidth) / 2;
      const invoiceY = y + 20; // Below the main watermark
      
      pdf.text(invoiceText, invoiceX, invoiceY);
    }
    
    // Reset text color for normal content
    pdf.setTextColor(0, 0, 0);
  };

  const loadInvoice = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${id}?convertToPreferred=true`);
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('📊 [Invoice View] Loaded invoice data:', {
          id: data.data._id,
          invoiceNumber: data.data.invoiceNumber,
          status: data.data.status,
          total: data.data.total,
          totalAmount: data.data.totalAmount,
          subtotal: data.data.subtotal,
          totalTax: data.data.totalTax,
          items: data.data.items?.length || 0,
          itemsData: data.data.items
        });
        
        // Redirect draft invoices to create page for editing
        if (data.data.status === 'draft') {
          console.log('📝 [Invoice View] Redirecting draft invoice to create page for editing');
          router.push(`/dashboard/services/smart-invoicing/create?id=${data.data._id}`);
          return;
        }
        
        setInvoice(data.data);
      } else {
        console.error('❌ [Invoice View] Failed to load invoice:', data.message);
        router.push('/dashboard/services/smart-invoicing/invoices?refresh=true');
      }
    } catch (error) {
      console.error('❌ [Invoice View] Error loading invoice:', error);
      router.push('/dashboard/services/smart-invoicing/invoices');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load invoice only once when component mounts and ID is available
  useEffect(() => {
    const invoiceId = params.id as string;
    if (invoiceId && session?.user && !invoice) {
      loadInvoice(invoiceId);
    }
  }, [params.id, session?.user, invoice, loadInvoice]);

  const handleDeleteInvoice = async () => {
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/dashboard/services/smart-invoicing/invoices?refresh=true');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
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

  const getCurrencySymbol = (currency: string) => {
    return getCurrencyByCode(currency)?.symbol || currency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': 
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if user has permission to mark invoice as paid
  const canMarkAsPaid = () => {
    if (!session?.user) return false;
    
    // Individual users can always mark their own invoices as paid
    if (!session.user.organizationId || session.user.organizationId === session.user.id) {
      return true;
    }
    
    // For organization users, check if they are admin or have proper rights
    // For now, we'll allow organization members to mark invoices as paid
    // You can add more specific permission checks here later
    return true;
  };

  // Check if invoice can be marked as paid
  const canMarkInvoiceAsPaid = () => {
    if (!invoice) return false;
    
    // Only allow marking as paid if status is 'sent' or 'pending'
    const allowedStatuses = ['sent', 'pending'];
    return allowedStatuses.includes(invoice.status || '') && canMarkAsPaid();
  };

  const handleMarkAsPaid = async () => {
    if (!invoice || !canMarkInvoiceAsPaid() || !confirm('Are you sure you want to mark this invoice as paid?')) return;
    
    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/invoices/${invoice._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'paid'
        }),
      });
      
      if (response.ok) {
        // Reload the invoice to get updated status
        await loadInvoice(invoice._id);
        alert('Invoice marked as paid successfully!');
        // Set flag for immediate refresh on other side
        sessionStorage.setItem('lastPaymentAction', Date.now().toString());
      } else {
        const errorData = await response.json();
        alert(`Failed to mark invoice as paid: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
      alert('Failed to mark invoice as paid');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle CSV download
  const handleDownloadCsv = () => {
    if (!invoice) return;

    try {
      console.log('📤 [Smart Invoicing] Starting CSV download for invoice:', invoice.invoiceNumber);

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
      const companyName = invoice.companyName || invoice.companyDetails?.name || 'N/A';
      const companyEmail = invoice.companyEmail || 'N/A';
      const companyPhone = invoice.companyPhone || 'N/A';
      const companyTaxNumber = invoice.companyTaxNumber || invoice.companyDetails?.taxNumber || 'N/A';
      
      // Handle company address
      let companyAddress = 'N/A';
      if (invoice.companyAddress) {
        companyAddress = `${invoice.companyAddress.street || ''}, ${invoice.companyAddress.city || ''}, ${invoice.companyAddress.state || ''} ${invoice.companyAddress.zipCode || ''}, ${invoice.companyAddress.country || ''}`;
      } else if (invoice.companyDetails) {
        companyAddress = `${invoice.companyDetails.addressLine1 || ''}, ${invoice.companyDetails.city || ''}, ${invoice.companyDetails.region || ''} ${invoice.companyDetails.postalCode || ''}, ${invoice.companyDetails.country || ''}`;
      }
      
      // Get client details
      const clientName = invoice.clientName || [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 'N/A';
      const clientCompany = invoice.clientDetails?.companyName || 'N/A';
      const clientEmail = invoice.clientEmail || 'N/A';
      const clientPhone = invoice.clientPhone || 'N/A';
      
      // Handle client address
      let clientAddress = 'N/A';
      if (invoice.clientAddress) {
        clientAddress = `${invoice.clientAddress.street || ''}, ${invoice.clientAddress.city || ''}, ${invoice.clientAddress.state || ''} ${invoice.clientAddress.zipCode || ''}, ${invoice.clientAddress.country || ''}`;
      } else if (invoice.clientDetails) {
        clientAddress = `${invoice.clientDetails.addressLine1 || ''}, ${invoice.clientDetails.city || ''}, ${invoice.clientDetails.region || ''}, ${invoice.clientDetails.postalCode || ''}, ${invoice.clientDetails.country || ''}`;
      }
      
      // Get payment details
      const paymentMethod = invoice.paymentMethod || invoice.paymentSettings?.method;
      const paymentMethodText = paymentMethod === 'fiat' ? 'Bank Transfer' : 'Cryptocurrency';
      const bankAccount = invoice.paymentSettings?.bankAccount;
      const bankName = bankAccount?.bankName || 'N/A';
      const accountNumber = bankAccount?.accountNumber || 'N/A';
      const routingNumber = bankAccount?.routingNumber || 'N/A';
      const network = invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork || 'N/A';
      const paymentAddress = invoice.paymentAddress || invoice.paymentSettings?.walletAddress || 'N/A';
      
      // Get original currency (preserve the invoice's original currency)
      const originalCurrency = invoice.currency || invoice.paymentSettings?.currency || 'USD';
      
      // Create one row per invoice (combine all items into a single description)
      const itemsDescription = invoice.items && invoice.items.length > 0 
        ? invoice.items.map(item => `${item.description || 'Item'} (Qty: ${item.quantity || 0}, Price: ${item.unitPrice?.toFixed(2) || '0.00'})`).join('; ')
        : 'No items';
      
      const totalQuantity = invoice.items ? invoice.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
      
      const row = [
        `"${invoice.invoiceNumber || 'N/A'}"`,
        `"${invoice.invoiceName || 'Invoice'}"`,
        `"${formatDate(invoice.issueDate || '')}"`,
        `"${formatDate(invoice.dueDate || '')}"`,
        `"${invoice.status || 'Draft'}"`,
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
        `"${invoice.subtotal?.toFixed(2) || '0.00'}"`,
        `"${invoice.totalTax?.toFixed(2) || '0.00'}"`,
        `"${invoice.totalAmount?.toFixed(2) || '0.00'}"`,
        `"${originalCurrency}"`,
        `"${paymentMethodText}"`,
        `"${bankName}"`,
        `"${accountNumber}"`,
        `"${routingNumber}"`,
        `"${network}"`,
        `"${paymentAddress}"`,
        `"${invoice.memo || ''}"`,
        `"${formatDate(invoice.createdAt || '')}"`
      ];
      csvRows.push(row.join(','));
      
      // Convert to CSV string
      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ [Smart Invoicing] CSV downloaded successfully:', {
        invoiceNumber: invoice.invoiceNumber,
        filename: `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.csv`,
        currency: originalCurrency
      });
      
    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };

  // Handle PDF download
  const handleDownloadPdf = async () => {
    if (!invoice) return;

    try {
      setDownloadingPdf(true);
      console.log('📤 [Smart Invoicing] Starting PDF download for invoice:', invoice.invoiceNumber);

      // Create a temporary container for PDF generation
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '-9999px';
      pdfContainer.style.width = '800px';
      pdfContainer.style.backgroundColor = '#ffffff';
      pdfContainer.style.padding = '40px';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(pdfContainer);

      // Generate the PDF content HTML
      const pdfContent = `
        <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px;">
            <div>
              <h1 style="color: #1f2937; font-size: 32px; font-weight: bold; margin: 0;">${invoice.invoiceName || 'INVOICE'}</h1>
              <p style="color: #6b7280; font-size: 16px; margin: 5px 0 0 0;">Invoice #: ${invoice.invoiceNumber || 'N/A'}</p>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
              <!-- Dates -->
              <div style="text-align: right;">
                <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">
                  <span style="display: inline-flex; align-items: center; margin-bottom: 3px;">
                    📅 Issued on ${formatDate(invoice.issueDate || new Date().toISOString())}
                  </span>
                </div>
                <div style="color: #6b7280; font-size: 14px;">
                  <span style="display: inline-flex; align-items: center;">
                    🕐 Payment due by ${formatDate(invoice.dueDate || new Date().toISOString())}
                  </span>
                </div>
              </div>
              <!-- Logo -->
              ${invoice.companyLogo ? `<img src="${invoice.companyLogo}" alt="Company Logo" style="max-height: 60px; max-width: 200px;">` : ''}
            </div>
          </div>

          <!-- Company and Client Info -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
            <div style="flex: 1; margin-right: 20px;">
              <h3 style="color: #374151; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">From:</h3>
              <div style="color: #4b5563; line-height: 1.6;">
                <p style="font-weight: bold; margin: 0 0 5px 0; font-size: 16px;">${invoice.companyName || invoice.companyDetails?.name || 'Company Name'}</p>
                <p style="margin: 0 0 5px 0;">${invoice.companyEmail || 'N/A'}</p>
                <p style="margin: 0 0 5px 0;">${invoice.companyPhone || 'N/A'}</p>
                <p style="margin: 0 0 5px 0;">
                  ${invoice.companyAddress ? 
                    `${invoice.companyAddress.street || ''}, ${invoice.companyAddress.city || ''}, ${invoice.companyAddress.state || ''} ${invoice.companyAddress.zipCode || ''}, ${invoice.companyAddress.country || ''}` :
                    invoice.companyDetails ? 
                    `${invoice.companyDetails.addressLine1 || ''}, ${invoice.companyDetails.city || ''}, ${invoice.companyDetails.region || ''} ${invoice.companyDetails.postalCode || ''}, ${invoice.companyDetails.country || ''}` :
                    'N/A'
                  }
                </p>
                <p style="margin: 0;">Tax Number: ${invoice.companyTaxNumber || invoice.companyDetails?.taxNumber || 'N/A'}</p>
              </div>
            </div>
            <div style="flex: 1; margin-left: 20px;">
              <h3 style="color: #374151; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">To:</h3>
              <div style="color: #4b5563; line-height: 1.6;">
                <p style="font-weight: bold; margin: 0 0 5px 0; font-size: 16px;">${invoice.clientName || [invoice.clientDetails?.firstName, invoice.clientDetails?.lastName].filter(Boolean).join(' ') || 'Client Name'}</p>
                ${invoice.clientDetails?.companyName ? `<p style="margin: 0 0 5px 0; font-weight: bold;">${invoice.clientDetails.companyName}</p>` : ''}
                <p style="margin: 0 0 5px 0;">${invoice.clientEmail || 'N/A'}</p>
                <p style="margin: 0 0 5px 0;">${invoice.clientPhone || 'N/A'}</p>
                <p style="margin: 0 0 5px 0;">
                  ${invoice.clientAddress ? 
                    `${invoice.clientAddress.street || ''}, ${invoice.clientAddress.city || ''}, ${invoice.clientAddress.state || ''} ${invoice.clientAddress.zipCode || ''}, ${invoice.clientAddress.country || ''}` :
                    invoice.clientDetails ? 
                    `${invoice.clientDetails.addressLine1 || ''}, ${invoice.clientDetails.city || ''}, ${invoice.clientDetails.region || ''}, ${invoice.clientDetails.postalCode || ''}, ${invoice.clientDetails.country || ''}` :
                    'N/A'
                  }
                </p>
              </div>
            </div>
          </div>

          <!-- Invoice Details -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 40px; background: #f9fafb; padding: 20px; border-radius: 8px;">
            <div>
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Issue Date</p>
              <p style="margin: 0; font-weight: bold; color: #374151;">${formatDate(invoice.issueDate || '')}</p>
            </div>
            <div>
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Due Date</p>
              <p style="margin: 0; font-weight: bold; color: #374151;">${formatDate(invoice.dueDate || '')}</p>
            </div>
            <div>
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Status</p>
              <p style="margin: 0; font-weight: bold; color: #374151;">${invoice.status || 'Draft'}</p>
            </div>
            <div>
              <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Currency</p>
              <p style="margin: 0; font-weight: bold; color: #374151;">${invoice.currency || 'USD'}</p>
            </div>
          </div>

          <!-- Items Table -->
          <div style="margin-bottom: 40px;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 15px; text-align: left; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Description</th>
                  <th style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Qty</th>
                  <th style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Unit Price</th>
                  ${hasAnyDiscounts ? '<th style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Discount</th>' : ''}
                  ${hasAnyTaxes ? '<th style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Tax</th>' : ''}
                  <th style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map(item => `
                  <tr>
                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.description || 'Item description'}</td>
                    <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.quantity || 0}</td>
                    <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151;">${getCurrencySymbol(invoice.currency || '')}${item.unitPrice?.toFixed(2) || '0.00'}</td>
                    ${hasAnyDiscounts ? `<td style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151;">${(item.discount || 0) > 0 ? (item.discount || 0) + '%' : ''}</td>` : ''}
                    ${hasAnyTaxes ? `<td style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151;">${(item.tax || 0) > 0 ? (item.tax || 0) + '%' : ''}</td>` : ''}
                    <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: bold;">${getCurrencySymbol(invoice.currency || '')}${item.amount?.toFixed(2) || '0.00'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6" style="padding: 15px; text-align: center; color: #6b7280;">No items</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Subtotal:</span>
                <span style="font-weight: bold; color: #374151;">${getCurrencySymbol(invoice.currency || '')}${invoice.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Tax:</span>
                <span style="font-weight: bold; color: #374151;">${getCurrencySymbol(invoice.currency || '')}${invoice.totalTax?.toFixed(2) || '0.00'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 15px 0; background: #f9fafb; margin-top: 10px; border-radius: 8px; padding: 15px;">
                <span style="font-size: 18px; font-weight: bold; color: #1f2937;">Total:</span>
                <span style="font-size: 18px; font-weight: bold; color: #1f2937;">${getCurrencySymbol(invoice.currency || '')}${invoice.totalAmount?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          <!-- Payment Information -->
          <div style="margin-bottom: 40px; background: #f9fafb; padding: 20px; border-radius: 8px;">
            <h3 style="color: #374151; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">Payment Information</h3>
            <div style="color: #4b5563; line-height: 1.6;">
              <p style="margin: 0 0 10px 0;"><strong>Payment Method:</strong> ${(invoice.paymentMethod || invoice.paymentSettings?.method) === 'fiat' ? 'Bank Transfer' : 'Cryptocurrency'}</p>
              <p style="margin: 0 0 10px 0;"><strong>Currency:</strong> ${invoice.currency || invoice.paymentSettings?.currency || 'USD'}</p>
              ${(invoice.paymentMethod || invoice.paymentSettings?.method) === 'fiat' ? `
                ${invoice.paymentSettings?.bankAccount?.bankName ? `<p style="margin: 0 0 5px 0;"><strong>Bank:</strong> ${invoice.paymentSettings.bankAccount.bankName}</p>` : ''}
                ${invoice.paymentSettings?.bankAccount?.accountNumber ? `<p style="margin: 0 0 5px 0;"><strong>Account Number:</strong> ${invoice.paymentSettings.bankAccount.accountNumber}</p>` : ''}
                ${invoice.paymentSettings?.bankAccount?.routingNumber ? `<p style="margin: 0 0 5px 0;"><strong>Routing Number:</strong> ${invoice.paymentSettings.bankAccount.routingNumber}</p>` : ''}
              ` : `
                ${invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork ? `<p style="margin: 0 0 5px 0;"><strong>Network:</strong> ${invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork}</p>` : ''}
                ${invoice.paymentAddress || invoice.paymentSettings?.walletAddress ? `<p style="margin: 0 0 5px 0;"><strong>Payment Address:</strong> ${invoice.paymentAddress || invoice.paymentSettings?.walletAddress}</p>` : ''}
              `}
            </div>
          </div>

          <!-- Memo -->
          ${invoice.memo ? `
            <div style="margin-bottom: 40px;">
              <h3 style="color: #374151; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">Notes</h3>
              <p style="color: #4b5563; line-height: 1.6; margin: 0;">${invoice.memo}</p>
            </div>
          ` : ''}

          <!-- Footer -->
          <div style="text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Generated by Chains-ERP</p>
            <p style="margin: 5px 0 0 0;">Invoice Number: ${invoice.invoiceNumber || 'N/A'} | Date: ${formatDate(invoice.issueDate || '')}</p>
          </div>
        </div>
      `;

      pdfContainer.innerHTML = pdfContent;

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
      const { pdf } = await generateOptimizedPdf(pdfContainer);

      // Remove the temporary element
      document.body.removeChild(pdfContainer);

      // Add watermark
      addWatermark(pdf, invoice.invoiceNumber);

      // Download the PDF
      const filename = `${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.issueDate || '').replace(/,/g, '')}.pdf`;
      pdf.save(filename);

      console.log('✅ [Smart Invoicing] PDF downloaded successfully:', {
        invoiceNumber: invoice.invoiceNumber,
        filename: filename,
        currency: invoice.currency
      });

    } catch (error) {
      console.error('❌ [Smart Invoicing] Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle Receipt download
  const handleDownloadReceipt = async () => {
    if (!invoice) return;

    try {
      setDownloadingReceipt(true);
      console.log('📤 [Smart Invoicing] Starting receipt download for invoice:', invoice.invoiceNumber);

      // Create a temporary container for receipt generation
      const receiptContainer = document.createElement('div');
      receiptContainer.style.position = 'absolute';
      receiptContainer.style.left = '-9999px';
      receiptContainer.style.top = '-9999px';
      receiptContainer.style.width = '750px';
      receiptContainer.style.backgroundColor = 'white';
      receiptContainer.style.padding = '30px';
      receiptContainer.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(receiptContainer);

      // Generate receipt HTML
      const receiptHTML = `
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border: 1px solid #e5e7eb; box-sizing: border-box; width: 100%;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
            ${invoice.companyLogo ? `<img src="${invoice.companyLogo}" alt="Company Logo" style="max-height: 50px; margin-bottom: 8px; max-width: 100%;">` : ''}
            <h1 style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0; word-wrap: break-word;">PAYMENT RECEIPT</h1>
            <p style="color: #6b7280; font-size: 12px; margin: 3px 0 0 0; word-wrap: break-word;">Receipt #${invoice.invoiceNumber || 'N/A'}</p>
          </div>

          <!-- Payment Details -->
          <div style="margin-bottom: 18px;">
            <h2 style="color: #1f2937; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Payment Details</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px; word-wrap: break-word;"><strong>Payment Date:</strong> ${formatDate(invoice.updatedAt || new Date().toISOString())}</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px; word-wrap: break-word;"><strong>Invoice Date:</strong> ${formatDate(invoice.issueDate || '')}</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px; word-wrap: break-word;"><strong>Due Date:</strong> ${formatDate(invoice.dueDate || '')}</p>
              </div>
              <div>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px; word-wrap: break-word;"><strong>Payment Method:</strong> ${invoice.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px; word-wrap: break-word;"><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">PAID</span></p>
              </div>
            </div>
          </div>

          <!-- Company Information -->
          <div style="margin-bottom: 18px;">
            <h2 style="color: #1f2937; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">From</h2>
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 3px 0; font-weight: bold; color: #1f2937; font-size: 14px; word-wrap: break-word;">${invoice.companyName || 'Company Name'}</p>
              <p style="margin: 0 0 3px 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">${invoice.companyEmail || ''}</p>
              <p style="margin: 0 0 3px 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">${invoice.companyPhone || ''}</p>
              ${invoice.companyAddress ? `
                <p style="margin: 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">
                  ${invoice.companyAddress.street || ''}<br>
                  ${invoice.companyAddress.city || ''}, ${invoice.companyAddress.state || ''} ${invoice.companyAddress.zipCode || ''}<br>
                  ${invoice.companyAddress.country || ''}
                </p>
              ` : ''}
            </div>
          </div>

          <!-- Client Information -->
          <div style="margin-bottom: 18px;">
            <h2 style="color: #1f2937; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">To</h2>
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 3px 0; font-weight: bold; color: #1f2937; font-size: 14px; word-wrap: break-word;">${invoice.clientName || 'Client Name'}</p>
              <p style="margin: 0 0 3px 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">${invoice.clientEmail || ''}</p>
              <p style="margin: 0 0 3px 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">${invoice.clientPhone || ''}</p>
              ${invoice.clientAddress ? `
                <p style="margin: 0; color: #6b7280; font-size: 12px; word-wrap: break-word;">
                  ${invoice.clientAddress.street || ''}<br>
                  ${invoice.clientAddress.city || ''}, ${invoice.clientAddress.state || ''} ${invoice.clientAddress.zipCode || ''}<br>
                  ${invoice.clientAddress.country || ''}
                </p>
              ` : ''}
            </div>
          </div>

          <!-- Items -->
          <div style="margin-bottom: 18px;">
            <h2 style="color: #1f2937; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Items Paid</h2>
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; min-width: 300px;">
                <thead style="background: #f9fafb;">
                  <tr>
                    <th style="padding: 8px; text-align: left; font-weight: bold; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-size: 12px; white-space: nowrap;">Description</th>
                    <th style="padding: 8px; text-align: center; font-weight: bold; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-size: 12px; white-space: nowrap;">Qty</th>
                    <th style="padding: 8px; text-align: right; font-weight: bold; color: #1f2937; border-bottom: 1px solid #e5e7eb; font-size: 12px; white-space: nowrap;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoice.items?.map(item => `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-size: 12px; word-wrap: break-word; max-width: 200px;">${item.description || ''}</td>
                      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 12px; white-space: nowrap;">${item.quantity || 0}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-weight: bold; font-size: 12px; white-space: nowrap;">${getCurrencyByCode(invoice.currency || 'USD')?.symbol || '$'}${(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  `).join('') || ''}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total -->
          <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #3b82f6; color: white; border-radius: 6px; flex-wrap: wrap; gap: 10px;">
              <span style="font-size: 16px; font-weight: bold; word-wrap: break-word;">TOTAL PAID:</span>
              <span style="font-size: 20px; font-weight: bold; word-wrap: break-word;">${getCurrencyByCode(invoice.currency || 'USD')?.symbol || '$'}${(invoice.totalAmount || invoice.total || 0).toFixed(2)}</span>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px;">
            <p style="margin: 0; word-wrap: break-word;">Thank you for your payment!</p>
            <p style="margin: 3px 0 0 0; word-wrap: break-word;">This receipt confirms that payment has been received and processed.</p>
            <p style="margin: 8px 0 0 0; font-weight: bold; word-wrap: break-word;">Generated by <span style="color: #3b82f6;">Chains ERP</span> on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      `;

      receiptContainer.innerHTML = receiptHTML;

      // Generate PDF
      const canvas = await html2canvas(receiptContainer, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        height: 1000, // Limit height to fit on one page
        width: 750
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Scale down if content is too tall for one page
      const maxHeight = pageHeight - 20; // Leave 10mm margin on top and bottom
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > maxHeight) {
        const scale = maxHeight / imgHeight;
        finalHeight = maxHeight;
        finalWidth = imgWidth * scale;
      }

      pdf.addImage(imgData, 'PNG', (210 - finalWidth) / 2, 10, finalWidth, finalHeight);

      // Clean up
      document.body.removeChild(receiptContainer);

      // Download the PDF
      const filename = `Receipt_${invoice.invoiceNumber || 'invoice'}_${formatDate(invoice.updatedAt || new Date().toISOString()).replace(/,/g, '')}.pdf`;
      pdf.save(filename);

      console.log('✅ [Smart Invoicing] Receipt downloaded successfully');
    } catch (error) {
      console.error('❌ [Smart Invoicing] Error downloading receipt:', error);
      alert('Failed to download receipt. Please try again.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invoice not found</h2>
          <button
            onClick={() => router.push('/dashboard/services/smart-invoicing/invoices?refresh=true')}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm touch-manipulation active:scale-95 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          
          <div className="flex space-x-4">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(invoice.status || 'draft')}`}>
              {invoice.status === 'sent' ? 'Pending' : 
               invoice.status ? (invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)) : 'Draft'}
            </span>
            
            {/* Download Dropdown */}
            <div className="relative download-dropdown-container">
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                    disabled={downloadingPdf}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                      <File className="h-4 w-4 text-red-500" />
                    )}
                    <span>{downloadingPdf ? 'Generating PDF...' : 'Download as PDF'}</span>
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
            
            {invoice.status === 'draft' && (
              <button
                onClick={() => router.push(`/dashboard/services/smart-invoicing/create?id=${invoice._id}`)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            {canMarkInvoiceAsPaid() && (
              <button
                onClick={handleMarkAsPaid}
                disabled={updatingStatus}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>{updatingStatus ? 'Updating...' : 'Mark as Paid'}</span>
              </button>
            )}
            {invoice?.status === 'paid' && (
              <button
                onClick={handleDownloadReceipt}
                disabled={downloadingReceipt}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingReceipt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                <span>{downloadingReceipt ? 'Generating...' : 'Download Receipt'}</span>
              </button>
            )}
            <button
              onClick={handleDeleteInvoice}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white rounded-lg shadow-lg border max-w-4xl mx-auto">
          {/* Document Header */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
              {/* Left Side - Invoice Name */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceName || 'Invoice'}</h1>
                {invoice.invoiceNumber && (
                  <p className="text-lg text-gray-600 mt-2">Invoice #: {invoice.invoiceNumber}</p>
                )}
              </div>

              {/* Right Side - Dates and Logo */}
              <div className="flex items-center space-x-4">
                {/* Dates */}
                <div className="text-right space-y-2">
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Issued on {formatDate(invoice.issueDate || new Date().toISOString())}</span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="h-4 w-4" />
                      <span>Payment due by {formatDate(invoice.dueDate || new Date().toISOString())}</span>
                    </div>
                  </div>
                </div>
                
                {/* Company Logo */}
                {invoice.companyLogo && (
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    <Image 
                      src={invoice.companyLogo} 
                      alt="Company Logo" 
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                      unoptimized={invoice.companyLogo.startsWith('data:')}
                      style={{ backgroundColor: 'white' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  From
                </h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">{invoice.companyName || invoice.companyDetails?.name || 'Company Name'}</div>
                  <div className="text-gray-600">
                    {invoice.companyAddress?.street || invoice.companyDetails?.addressLine1 ? <div>{invoice.companyAddress?.street || invoice.companyDetails?.addressLine1}</div> : null}
                    {(invoice.companyAddress?.city || invoice.companyDetails?.city || invoice.companyAddress?.state || invoice.companyDetails?.region || invoice.companyAddress?.zipCode || invoice.companyDetails?.postalCode) && (
                      <div>
                        {[invoice.companyAddress?.city || invoice.companyDetails?.city, invoice.companyAddress?.state || invoice.companyDetails?.region, invoice.companyAddress?.zipCode || invoice.companyDetails?.postalCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.companyAddress?.country || invoice.companyDetails?.country ? (
                      <div>{countries.find(c => c.code === (invoice.companyAddress?.country || invoice.companyDetails?.country))?.name}</div>
                    ) : null}
                  </div>
                  {invoice.companyTaxNumber || invoice.companyDetails?.taxNumber ? <div className="text-gray-600">Tax: {invoice.companyTaxNumber || invoice.companyDetails?.taxNumber}</div> : null}
                  {invoice.companyEmail && <div className="text-gray-600">{invoice.companyEmail}</div>}
                  {invoice.companyPhone && <div className="text-gray-600">{invoice.companyPhone}</div>}
                </div>
              </div>

              {/* Client Information */}
              <div className="flex-1 ml-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Bill To
                </h3>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">
                    {invoice.clientDetails?.companyName || 'Client Name'}
                  </div>
                  {invoice.clientDetails?.companyName && (
                    <div className="text-gray-600">
                      Attn: Client Name
                    </div>
                  )}
                  <div className="text-gray-600">
                    {invoice.clientAddress?.street || invoice.clientDetails?.addressLine1 ? <div>{invoice.clientAddress?.street || invoice.clientDetails?.addressLine1}</div> : null}
                    {(invoice.clientAddress?.city || invoice.clientDetails?.city || invoice.clientAddress?.state || invoice.clientDetails?.region || invoice.clientAddress?.zipCode || invoice.clientDetails?.postalCode) && (
                      <div>
                        {[invoice.clientAddress?.city || invoice.clientDetails?.city, invoice.clientAddress?.state || invoice.clientDetails?.region, invoice.clientAddress?.zipCode || invoice.clientDetails?.postalCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {invoice.clientAddress?.country || invoice.clientDetails?.country ? (
                      <div>{countries.find(c => c.code === (invoice.clientAddress?.country || invoice.clientDetails?.country))?.name}</div>
                    ) : null}
                  </div>
                  {invoice.clientEmail && <div className="text-gray-600">{invoice.clientEmail}</div>}
                  {invoice.clientPhone && <div className="text-gray-600">{invoice.clientPhone}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Payment Method</p>
                <p className="font-medium">
                  {invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
                </p>
                {(invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto') && (invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork) && (
                  <p className="text-sm text-gray-600">Network: {invoice.paymentNetwork || invoice.paymentSettings?.cryptoNetwork}</p>
                )}
                {(invoice.paymentMethod === 'crypto' || invoice.paymentSettings?.method === 'crypto') && (invoice.paymentAddress || invoice.paymentSettings?.walletAddress) && (
                  <p className="text-sm text-gray-600">Address: {invoice.paymentAddress || invoice.paymentSettings?.walletAddress}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.bankName || invoice.paymentSettings?.bankAccount?.bankName) && (
                  <p className="text-sm text-gray-600">Bank: {invoice.bankName || invoice.paymentSettings?.bankAccount?.bankName}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.accountNumber || invoice.paymentSettings?.bankAccount?.accountNumber) && (
                  <p className="text-sm text-gray-600">Account: {invoice.accountNumber || invoice.paymentSettings?.bankAccount?.accountNumber}</p>
                )}
                {(invoice.paymentMethod === 'fiat' || invoice.paymentSettings?.method === 'fiat') && (invoice.routingNumber || invoice.paymentSettings?.bankAccount?.routingNumber) && (
                  <p className="text-sm text-gray-600">Routing: {invoice.routingNumber || invoice.paymentSettings?.bankAccount?.routingNumber}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Currency</p>
                <p className="font-medium">{invoice.currency || invoice.paymentSettings?.currency || 'USD'}</p>
                {(invoice.enableMultiCurrency || invoice.paymentSettings?.enableMultiCurrency) && (
                  <p className="text-sm text-blue-600">Multi-currency enabled</p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="p-4 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Invoice Items</h3>
            
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Price</th>
                    {hasAnyDiscounts && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                    )}
                    {hasAnyTaxes && (
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Tax</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => {
                    return (
                      <tr key={item.id || `item-${index}`} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">{item.quantity}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-gray-900">
                            <FormattedNumberDisplay 
                              value={item.unitPrice || 0} 
                            />
                          </div>
                        </td>
                        {hasAnyDiscounts && (
                          <td className="py-3 px-4">
                            <div className="text-gray-900">{(item.discount || 0) > 0 ? `${item.discount || 0}%` : ''}</div>
                          </td>
                        )}
                        {hasAnyTaxes && (
                          <td className="py-3 px-4">
                            <div className="text-gray-900">{(item.tax || 0) > 0 ? `${item.tax || 0}%` : ''}</div>
                          </td>
                        )}
                        <td className="py-3 px-4 font-medium">
                          <div className="text-gray-900">
                            <FormattedNumberDisplay 
                              value={item.amount || 0} 
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Amount without tax</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.subtotal || 0} 
                    />
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Tax amount</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.totalTax || 0} 
                    />
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total amount</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.totalAmount || 0} 
                    />
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold text-blue-600">
                  <span>Due</span>
                  <span>
                    <FormattedNumberDisplay 
                      value={invoice.totalAmount || 0} 
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Memo */}
          {invoice.memo && (
            <div className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{invoice.memo}</p>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 sm:p-8 text-center text-sm text-gray-500">
            <p>Invoice created on {formatDate(invoice.createdAt || '')}</p>
            {invoice.updatedAt !== invoice.createdAt && (
              <p>Last updated on {formatDate(invoice.updatedAt || '')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 