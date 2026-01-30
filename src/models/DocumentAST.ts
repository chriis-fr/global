/**
 * Neutral Document AST - org-agnostic output from PDF parser.
 * Org mapping config points into this structure (e.g. meta.reference_numbers.task_order).
 */
export interface DocumentAST {
  meta: {
    title: string;
    reference_numbers: Record<string, string>;
  };
  parties: {
    issuer: string;
    recipient: string;
  };
  items: Array<{
    label: string;
    quantity: number;
    unit_price: number | null;
    status?: string;
  }>;
  dates: {
    due: string;
    signed: string;
  };
  raw_lines?: string[];
}

/**
 * Per-organization PDF-to-invoice mapping config.
 * Keys = invoice field names; values = dot path into DocumentAST.
 */
export interface OrgPdfMappingConfig {
  invoiceNumber?: string;   // e.g. "meta.reference_numbers.contract" (leave unmapped to generate)
  invoiceTitle?: string;    // e.g. "meta.reference_numbers.task_order" -> editable "Invoice" heading
  issueDate?: string;       // e.g. "dates.signed"
  dueDate?: string;        // e.g. "dates.due"
  clientName?: string;     // e.g. "parties.recipient"
  clientEmail?: string;
  clientCompany?: string;
  companyName?: string;    // e.g. "parties.issuer"
  currency?: string;
  total?: string;          // e.g. "meta.reference_numbers.total"
  subtotal?: string;
  tax?: string;
  notes?: string;
  /** Line items: source array path and field map */
  lineItems?: {
    source: string;        // e.g. "items"
    map: {
      description?: string;  // e.g. "label"
      quantity?: string;
      unitPrice?: string;
      amount?: string;
      status?: string;
    };
  };
}

/** Named mapping entry (user-defined name for easy selection when uploading). */
export interface PdfMappingEntry {
  name: string;
  config: OrgPdfMappingConfig;
  isDefault?: boolean;
}
