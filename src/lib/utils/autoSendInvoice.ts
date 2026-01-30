import { generatePdfBase64 } from '@/lib/utils/pdfDocument';
import type { InvoicePdfData } from '@/components/invoicing/InvoicePdfDocument';

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

/** API invoice shape (from GET /api/invoices/:id) - same fields as invoice details page uses for PDF. */
interface ApiInvoice {
  invoiceName?: string;
  issueDate?: string;
  dueDate?: string;
  companyLogo?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
  companyTaxNumber?: string;
  companyDetails?: { name?: string; addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string; taxNumber?: string };
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
  clientDetails?: { companyName?: string; firstName?: string; lastName?: string; addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string };
  currency?: string;
  paymentMethod?: string;
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  paymentSettings?: {
    method?: string;
    cryptoNetwork?: string;
    walletAddress?: string;
    bankAccount?: { bankName?: string; accountNumber?: string; routingNumber?: string };
    currency?: string;
  };
  items?: Array<{
    id?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    tax?: number;
    taxRate?: number;
    amount?: number;
  }>;
  subtotal?: number;
  totalTax?: number;
  taxAmount?: number;
  total?: number;
  totalAmount?: number;
  withholdingTaxAmount?: number;
  withholdingTaxRatePercent?: number;
  memo?: string;
}

/** Map API invoice to InvoicePdfData - same format as invoice details page and email. */
function invoiceToPdfData(inv: ApiInvoice): InvoicePdfData {
  const companyAddr = inv.companyAddress ?? (inv.companyDetails ? {
    street: inv.companyDetails.addressLine1 ?? '',
    city: inv.companyDetails.city ?? '',
    state: inv.companyDetails.region ?? '',
    zipCode: inv.companyDetails.postalCode ?? '',
    country: inv.companyDetails.country ?? '',
  } : undefined);
  const clientAddr = inv.clientAddress ?? (inv.clientDetails ? {
    street: inv.clientDetails.addressLine1 ?? '',
    city: inv.clientDetails.city ?? '',
    state: inv.clientDetails.region ?? '',
    zipCode: inv.clientDetails.postalCode ?? '',
    country: inv.clientDetails.country ?? '',
  } : undefined);
  const addr = (r: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | undefined) => ({
    street: r?.street ?? '',
    city: r?.city ?? '',
    state: r?.state ?? '',
    zipCode: r?.zipCode ?? '',
    country: r?.country ?? '',
  });
  const paymentMethod = (inv.paymentMethod ?? inv.paymentSettings?.method) === 'crypto' ? 'crypto' : 'fiat';
  const bank = inv.paymentSettings?.bankAccount;
  return {
    invoiceName: inv.invoiceName ?? 'Invoice',
    issueDate: inv.issueDate ?? '',
    dueDate: inv.dueDate ?? '',
    companyName: inv.companyName ?? inv.companyDetails?.name ?? '',
    companyEmail: inv.companyEmail ?? '',
    companyPhone: inv.companyPhone ?? '',
    companyAddress: addr(companyAddr),
    companyTaxNumber: inv.companyTaxNumber ?? inv.companyDetails?.taxNumber,
    companyLogo: inv.companyLogo,
    clientName: inv.clientName ?? ([inv.clientDetails?.firstName, inv.clientDetails?.lastName].filter(Boolean).join(' ') || (inv.clientDetails?.companyName ?? '')),
    clientCompany: inv.clientDetails?.companyName,
    clientEmail: inv.clientEmail ?? '',
    clientPhone: inv.clientPhone ?? '',
    clientAddress: addr(clientAddr),
    currency: inv.currency ?? inv.paymentSettings?.currency ?? 'USD',
    paymentMethod,
    paymentNetwork: inv.paymentNetwork ?? inv.paymentSettings?.cryptoNetwork,
    paymentAddress: inv.paymentAddress ?? inv.paymentSettings?.walletAddress,
    bankName: inv.bankName ?? bank?.bankName,
    accountNumber: inv.accountNumber ?? bank?.accountNumber,
    routingNumber: inv.routingNumber ?? bank?.routingNumber,
    items: (inv.items ?? []).map((item) => {
      const rawTax = item.tax ?? item.taxRate;
      return {
        id: item.id,
        description: typeof item.description === 'string' ? item.description : (item.description ?? '').toString(),
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        discount: item.discount ?? 0,
        tax: Number(rawTax ?? 0),
        amount: item.amount ?? 0,
      };
    }),
    subtotal: inv.subtotal ?? 0,
    totalTax: Number(inv.totalTax ?? inv.taxAmount ?? 0),
    total: inv.total ?? inv.totalAmount ?? 0,
    withholdingTaxEnabled: (inv.withholdingTaxAmount ?? 0) > 0,
    withholdingTaxAmount: inv.withholdingTaxAmount,
    withholdingTaxRatePercent: inv.withholdingTaxRatePercent,
    memo: inv.memo,
  };
}

export const autoSendApprovedInvoice = async (invoiceData: AutoSendInvoiceData): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🚀 [AutoSend] Starting auto-send process for invoice:', invoiceData.invoiceNumber);

    // Fetch full invoice (no currency conversion - same as email)
    const response = await fetch(`/api/invoices/${invoiceData._id}?convertToPreferred=false`);
    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Failed to fetch invoice data');
    }

    const invoice = data.data as ApiInvoice;

    // Generate PDF using same react-pdf format as email (InvoicePdfDocument variant='invoice')
    console.log('📄 [AutoSend] Generating PDF (react-pdf, same as email)...');
    const pdfData = invoiceToPdfData(invoice);
    const pdfBuffer = await generatePdfBase64(pdfData, invoice.invoiceNumber ?? invoiceData.invoiceNumber ?? undefined, 'invoice');

    if (!pdfBuffer) {
      throw new Error('Failed to generate PDF');
    }

    console.log('✅ [AutoSend] PDF generated successfully');

    // Send the invoice using the same API as individual accounts
    console.log('📧 [AutoSend] Sending invoice email...');
    const sendResponse = await fetch('/api/invoices/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoiceData._id,
        recipientEmail: invoiceData.clientEmail,
        pdfBuffer,
        attachedFiles: [],
      }),
    });

    const result = await sendResponse.json();

    if (result.success) {
      console.log('✅ [AutoSend] Invoice sent successfully!');
      return {
        success: true,
        message: `Invoice approved and automatically sent to ${invoiceData.clientEmail}! It has been delivered to the recipient with PDF attachment.`,
      };
    } else {
      console.error('❌ [AutoSend] Failed to send invoice:', result.message);
      return {
        success: false,
        message: `Invoice was approved but failed to send: ${result.message}`,
      };
    }
  } catch (error) {
    console.error('❌ [AutoSend] Error in auto-send process:', error);
    return {
      success: false,
      message: `Invoice was approved but failed to auto-send: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
