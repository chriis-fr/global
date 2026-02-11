/**
 * Built-in PDF format presets for accurate extraction.
 * Users see these in the format dropdown when uploading PDFs.
 */
import type { OrgPdfMappingConfig } from '@/models/DocumentAST';

export interface PdfFormatPreset {
  id: string;
  name: string;
  description: string;
  config: OrgPdfMappingConfig;
}

/** Built-in presets — always available, ensures accuracy for known formats. No hardcoded prices. */
export const PDF_FORMAT_PRESETS: PdfFormatPreset[] = [
  {
    id: 'task-order-cu-pp-qc',
    name: 'Task Order (CU, PP, QC, Holiday/Weekend)',
    description: 'For task order PDFs with deliverable codes (CU1, CU3, PP2, PP4, PP5, QC1) and chapters. Includes Holiday/Weekend compensation.',
    config: {
      invoiceTitle: 'meta.reference_numbers.task_order',
      issueDate: 'dates.signed',
      dueDate: 'dates.due',
      companyName: 'parties.issuer',
      clientName: 'parties.recipient',
      total: 'meta.reference_numbers.total',
      lineItems: {
        source: 'items',
        map: {
          description: 'label',
          quantity: 'quantity',
          unitPrice: 'unit_price',
          status: 'status',
        },
      },
    },
  },
  {
    id: 'standard-invoice',
    name: 'Standard Invoice',
    description: 'Generic invoice with task order #, contract #, dates, parties, and line items.',
    config: {
      invoiceTitle: 'meta.title',
      issueDate: 'dates.signed',
      dueDate: 'dates.due',
      companyName: 'parties.issuer',
      clientName: 'parties.recipient',
      total: 'meta.reference_numbers.total',
      subtotal: 'meta.reference_numbers.subtotal',
      tax: 'meta.reference_numbers.tax',
      lineItems: {
        source: 'items',
        map: {
          description: 'label',
          quantity: 'quantity',
          unitPrice: 'unit_price',
          status: 'status',
        },
      },
    },
  },
];

export function getPresetByName(name: string): PdfFormatPreset | undefined {
  return PDF_FORMAT_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function getPresetById(id: string): PdfFormatPreset | undefined {
  return PDF_FORMAT_PRESETS.find((p) => p.id === id);
}
