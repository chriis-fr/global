import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface AutoSendInvoiceData {
  _id: string;
  invoiceNumber: string;
  clientEmail: string;
  greetingName: string;
  total: number;
  currency: string;
  dueDate: string;
  companyName: string;
  clientName: string;
  paymentMethods: string[];
}

// Add PDF caching utility (same as create page)
const pdfCache = new Map<string, string>();

export const autoSendApprovedInvoice = async (invoiceData: AutoSendInvoiceData): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🚀 [AutoSend] Starting auto-send process for invoice:', invoiceData.invoiceNumber);
    
    // Step 1: Generate PDF using the exact same logic as the create page
    console.log('📄 [AutoSend] Generating PDF...');
    const pdfBuffer = await generateInvoicePDF(invoiceData._id);
    
    if (!pdfBuffer) {
      throw new Error('Failed to generate PDF');
    }
    
    console.log('✅ [AutoSend] PDF generated successfully');
    
    // Step 2: Send the invoice using the same API as individual accounts
    console.log('📧 [AutoSend] Sending invoice email...');
    const response = await fetch('/api/invoices/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoiceData._id,
        recipientEmail: invoiceData.clientEmail,
        pdfBuffer: pdfBuffer,
        attachedFiles: [] // No additional files for now
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ [AutoSend] Invoice sent successfully!');
      return {
        success: true,
        message: `Invoice approved and automatically sent to ${invoiceData.clientEmail}! It has been delivered to the recipient with PDF attachment.`
      };
    } else {
      console.error('❌ [AutoSend] Failed to send invoice:', result.message);
      return {
        success: false,
        message: `Invoice was approved but failed to send: ${result.message}`
      };
    }
    
  } catch (error) {
    console.error('❌ [AutoSend] Error in auto-send process:', error);
    return {
      success: false,
      message: `Invoice was approved but failed to auto-send: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Use the exact same generateOptimizedPdf function as the create page
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

// Use the exact same optimizeCanvasForPdf function as the create page
const optimizeCanvasForPdf = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const maxWidth = 800;
  const maxHeight = 1200;
  
  if (canvas.width <= maxWidth && canvas.height <= maxHeight) {
    return canvas;
  }
  
  const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const newWidth = canvas.width * ratio;
  const newHeight = canvas.height * ratio;
  
  const optimizedCanvas = document.createElement('canvas');
  optimizedCanvas.width = newWidth;
  optimizedCanvas.height = newHeight;
  
  const ctx = optimizedCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  }
  
  return optimizedCanvas;
};

// Use the exact same addWatermark function as the create page
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
    const invoiceText = `#${invoiceNumber}`;
    const invoiceTextWidth = pdf.getTextWidth(invoiceText);
    const invoiceX = (pageWidth - invoiceTextWidth) / 2;
    const invoiceY = y + 20;
    pdf.text(invoiceText, invoiceX, invoiceY);
  }
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
};

const generateInvoicePDF = async (invoiceId: string): Promise<string | null> => {
  try {
    console.log('📄 [PDF Generation] Starting PDF generation for invoice:', invoiceId);
    
    // Fetch invoice data
    const response = await fetch(`/api/invoices/${invoiceId}?convertToPreferred=true`);
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('Failed to fetch invoice data');
    }
    
    const invoice = data.data;
    
    // Create a temporary container for PDF generation (exact same as create page)
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

    // Generate the exact same invoice structure as the create page
    pdfContainer.innerHTML = generateInvoiceHTML(invoice);
    
    // Append to body temporarily
    document.body.appendChild(pdfContainer);

    // Wait for images to load (exact same as create page)
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

    // Generate optimized PDF (exact same as create page)
    const { pdf, base64: pdfBase64 } = await generateOptimizedPdf(pdfContainer, invoice.invoiceNumber || 'temp');

    // Remove the temporary element
    document.body.removeChild(pdfContainer);

    // Add watermark (exact same as create page)
    addWatermark(pdf, invoice.invoiceNumber || 'temp');
    
    console.log('✅ [PDF Generation] PDF generated successfully');
    return pdfBase64;
    
  } catch (error) {
    console.error('❌ [PDF Generation] Error generating PDF:', error);
    return null;
  }
};

// Generate the exact same HTML structure as the create page
const generateInvoiceHTML = (invoice: any): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrencySymbol = () => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'KES': 'KSh',
      'NGN': '₦',
      'GHS': '₵',
      'ZAR': 'R'
    };
    return symbols[invoice.currency] || invoice.currency;
  };

  // Check if there are any discounts or taxes
  const hasAnyDiscounts = invoice.items?.some((item: any) => item.discount > 0);
  const hasAnyTaxes = invoice.items?.some((item: any) => item.tax > 0);

  return `
    <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 32px; margin-bottom: 32px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0;">
            ${invoice.invoiceName || 'Invoice'}
          </h1>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
            <div>
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
                Issued on ${formatDate(invoice.issueDate || invoice.createdAt)}
              </div>
              <div style="font-size: 14px; color: #6b7280;">
                Payment due by ${formatDate(invoice.dueDate)}
              </div>
              ${invoice.invoiceNumber ? `
                <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                  Invoice: ${invoice.invoiceNumber}
                </div>
              ` : ''}
            </div>
            ${invoice.companyDetails?.logo ? `
              <div style="width: 64px; height: 64px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <img src="${invoice.companyDetails.logo}" alt="Company Logo" style="width: 100%; height: 100%; object-fit: contain; background: white;" />
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
            ${invoice.companyDetails?.name || invoice.companyName || 'Company Name'}
          </div>
          <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
            <div>${invoice.companyDetails?.address || 'Street Address'}</div>
            <div>${invoice.companyDetails?.email || 'Email'}</div>
            <div>${invoice.companyDetails?.phone || 'Phone'}</div>
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
            ${invoice.clientDetails?.companyName || invoice.clientName || 'Client Name'}
          </div>
          ${invoice.clientDetails?.companyName ? `
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
            Attn: ${invoice.clientDetails?.firstName} ${invoice.clientDetails?.lastName}
          </div>
          ` : ''}
          <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
            <div>${invoice.clientDetails?.address || 'Street Address'}</div>
            <div>${invoice.clientDetails?.email || 'Email'}</div>
            <div>${invoice.clientDetails?.phone || 'Phone'}</div>
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
          ${invoice.items?.map((item: any) => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.description || item.name || 'Item description'}</td>
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.quantity || 1}</td>
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${getCurrencySymbol()}${(item.rate || item.price || 0).toFixed(2)}</td>
              ${hasAnyDiscounts ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.discount > 0 ? `${item.discount}%` : ''}</td>` : ''}
              ${hasAnyTaxes ? `<td style="padding: 12px 16px; font-size: 14px; color: #111827;">${item.tax > 0 ? `${item.tax}%` : ''}</td>` : ''}
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827;">${getCurrencySymbol()}${(item.amount || (item.quantity || 1) * (item.rate || item.price || 0)).toFixed(2)}</td>
            </tr>
          `).join('') || `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">Service</td>
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">1</td>
              <td style="padding: 12px 16px; font-size: 14px; color: #111827;">${getCurrencySymbol()}${(invoice.total || 0).toFixed(2)}</td>
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #111827;">${getCurrencySymbol()}${(invoice.total || 0).toFixed(2)}</td>
            </tr>
          `}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end;">
        <div style="width: 256px;">
          <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
            <span>Amount without tax</span>
            <span>${getCurrencySymbol()}${(invoice.subtotal || invoice.total || 0).toFixed(2)}</span>
          </div>
          ${invoice.totalTax > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #6b7280; font-size: 14px; margin-bottom: 8px;">
              <span>Total Tax amount</span>
              <span>${getCurrencySymbol()}${invoice.totalTax.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-bottom: 8px;">
            <span>Total amount</span>
            <span>${getCurrencySymbol()}${(invoice.total || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600; color: #2563eb;">
            <span>Due</span>
            <span>${getCurrencySymbol()}${(invoice.total || 0).toFixed(2)}</span>
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
            ${invoice.paymentSettings?.method === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}
          </div>
          ${invoice.paymentSettings?.method === 'crypto' && invoice.paymentSettings?.cryptoNetwork ? `
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
              Network: ${invoice.paymentSettings.cryptoNetwork}
            </div>
          ` : ''}
          ${invoice.paymentSettings?.method === 'crypto' && invoice.paymentSettings?.walletAddress ? `
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
              Address: ${invoice.paymentSettings.walletAddress}
            </div>
          ` : ''}
        </div>
        <div>
          <h4 style="font-weight: 500; color: #111827; margin: 0 0 8px 0;">Currency</h4>
          <div style="font-size: 14px; color: #6b7280;">
            ${invoice.currency} (${getCurrencySymbol()})
          </div>
        </div>
      </div>
    </div>

    ${invoice.memo ? `
      <div style="padding: 32px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px;">
        <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Memo</h3>
        <div style="font-size: 14px; color: #374151; white-space: pre-wrap;">
          ${invoice.memo}
        </div>
      </div>
    ` : ''}

    ${invoice.invoiceNumber ? `
      <div style="padding: 32px 0; text-align: center;">
        <div style="font-size: 14px; color: #6b7280;">
          Invoice Number: ${invoice.invoiceNumber}
        </div>
      </div>
    ` : ''}

    <!-- Footer with watermark and security info -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        <div style="margin-bottom: 8px; font-weight: 500;">
          Generated by Chains-ERP for ${invoice.companyDetails?.name || invoice.companyName || 'Company'}
        </div>
        <div style="margin-bottom: 8px; font-size: 11px;">
          Invoice Number: ${invoice.invoiceNumber || 'N/A'} | Date: ${formatDate(invoice.issueDate || invoice.createdAt)}
        </div>
        <div style="font-size: 10px; color: #d1d5db;">
          Digital Invoice | Secure Payment Processing | Blockchain Verification
        </div>
      </div>
    </div>
  `;
};
