/**
 * Available Document AST paths for org PDF mapping.
 * Used in Configure PDF mapping UI.
 */
export const PDF_AST_PATH_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Don\'t map —' },
  { value: 'meta.title', label: 'Document title' },
  { value: 'meta.reference_numbers.task_order', label: 'Task order #' },
  { value: 'meta.reference_numbers.contract', label: 'Contract #' },
  { value: 'meta.reference_numbers.invoice_number', label: 'Invoice #' },
  { value: 'meta.reference_numbers.total', label: 'Total amount' },
  { value: 'parties.issuer', label: 'Company / Issuer' },
  { value: 'parties.recipient', label: 'Client / Recipient' },
  { value: 'dates.signed', label: 'Issue / Signed date' },
  { value: 'dates.due', label: 'Due date' },
];

// Only expose the few fields we actually want to auto-fill from PDFs.
// Invoice number, client/company names, totals and notes are set manually in the invoice UI,
// so we hide those here to keep this screen simple.
export const INVOICE_FIELD_KEYS: (keyof import('@/models/DocumentAST').OrgPdfMappingConfig)[] = [
  'invoiceTitle',
  'dueDate',
];

export const INVOICE_FIELD_LABELS: Record<string, string> = {
  invoiceTitle: 'Invoice title',
  dueDate: 'Due date',
};

/** Document AST item field paths (for line items mapping). */
export const ITEM_FIELD_PATH_OPTIONS: { value: string; label: string }[] = [
  // For description we always use the AST "label" field, shown here as plain Description
  { value: 'label', label: 'Description (from row text)' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unit_price', label: 'Unit price' },
  { value: 'status', label: 'Status' },
  { value: 'code', label: 'Code' },
  { value: 'index', label: 'Index (row #)' },
];
