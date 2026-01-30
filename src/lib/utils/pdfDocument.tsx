'use client';

import { pdf } from '@react-pdf/renderer';
import { InvoicePdfDocument, type InvoicePdfData } from '@/components/invoicing/InvoicePdfDocument';

/**
 * Generate a PDF blob using @react-pdf/renderer and InvoicePdfDocument.
 * Use for invoices (variant 'invoice') or payment receipts (variant 'receipt').
 */
export async function generatePdfBlob(
  data: InvoicePdfData,
  documentNumber?: string,
  variant: 'invoice' | 'receipt' = 'invoice'
): Promise<Blob> {
  const blob = await pdf(
    <InvoicePdfDocument
      data={data}
      invoiceNumber={documentNumber}
      variant={variant}
    />
  ).toBlob();
  return blob;
}

/**
 * Generate PDF and return as base64 string (for email attachments, etc.).
 */
export async function generatePdfBase64(
  data: InvoicePdfData,
  documentNumber?: string,
  variant: 'invoice' | 'receipt' = 'invoice'
): Promise<string> {
  const blob = await generatePdfBlob(data, documentNumber, variant);
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
