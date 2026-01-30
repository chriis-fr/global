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

export const INVOICE_FIELD_KEYS: (keyof import('@/models/DocumentAST').OrgPdfMappingConfig)[] = [
  'invoiceNumber',
  'invoiceTitle',
  'issueDate',
  'dueDate',
  'clientName',
  'companyName',
  'total',
  'notes',
];

export const INVOICE_FIELD_LABELS: Record<string, string> = {
  invoiceNumber: 'Invoice number',
  invoiceTitle: 'Invoice title',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  clientName: 'Client name',
  companyName: 'Company name',
  total: 'Total amount',
  notes: 'Notes',
};

/** Document AST item field paths (for line items mapping). */
export const ITEM_FIELD_PATH_OPTIONS: { value: string; label: string }[] = [
  { value: 'label', label: 'Label / Description' },
  { value: 'description', label: 'Description' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unit_price', label: 'Unit price' },
  { value: 'status', label: 'Status' },
  { value: 'code', label: 'Code' },
  { value: 'index', label: 'Index (row #)' },
];
