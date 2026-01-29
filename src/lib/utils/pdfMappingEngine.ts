/**
 * Mapping engine: apply org-specific config to Document AST -> invoice data.
 * Generic, never changes per org.
 */
import type { DocumentAST, OrgPdfMappingConfig } from '@/models/DocumentAST';
import type { CreateInvoiceInput } from '@/models/Invoice';

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function parseDate(val: unknown): Date | undefined {
  if (val == null) return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Apply organization PDF mapping config to Document AST.
 * Returns partial invoice input (prefill for draft).
 */
export function applyPdfMapping(
  documentAst: DocumentAST,
  mapping: OrgPdfMappingConfig
): Partial<CreateInvoiceInput> {
  const out: Partial<CreateInvoiceInput> = {};

  const get = (path: string) => getByPath(documentAst, path);

  if (mapping.invoiceNumber) {
    const v = get(mapping.invoiceNumber);
    if (v != null) out.invoiceNumber = String(v);
  }
  if (mapping.invoiceTitle) {
    const v = get(mapping.invoiceTitle);
    if (v != null) (out as Record<string, unknown>).invoiceTitle = String(v);
  }
  if (mapping.issueDate) {
    const v = get(mapping.issueDate);
    const d = parseDate(v);
    if (d) out.issueDate = d;
  }
  if (mapping.dueDate) {
    const v = get(mapping.dueDate);
    const d = parseDate(v);
    if (d) out.dueDate = d;
  }
  if (mapping.clientName) {
    const v = get(mapping.clientName);
    if (v != null) {
      out.clientDetails = out.clientDetails ?? ({} as CreateInvoiceInput['clientDetails']);
      (out.clientDetails as unknown as Record<string, string>).name = String(v);
    }
  }
  if (mapping.clientEmail) {
    const v = get(mapping.clientEmail);
    if (v != null) {
      out.clientDetails = out.clientDetails ?? ({} as CreateInvoiceInput['clientDetails']);
      (out.clientDetails as unknown as Record<string, string>).email = String(v);
    }
  }
  if (mapping.companyName) {
    const v = get(mapping.companyName);
    if (v != null) {
      out.companyDetails = out.companyDetails ?? ({} as CreateInvoiceInput['companyDetails']);
      (out.companyDetails as unknown as Record<string, string>).name = String(v);
    }
  }
  if (mapping.currency) {
    const v = get(mapping.currency);
    if (v != null) out.currency = String(v);
  }
  if (mapping.total) {
    const v = get(mapping.total);
    if (v != null) {
      const n = parseFloat(String(v).replace(/,/g, ''));
      if (!Number.isNaN(n)) {
        out.totalAmount = n;
        out.subtotal = out.subtotal ?? n;
      }
    }
  }
  if (mapping.notes) {
    const v = get(mapping.notes);
    if (v != null) out.notes = String(v);
  }

  // Line items: use config or default map (items[].label -> description, quantity, unit_price)
  const itemsSource = mapping.lineItems?.source ?? 'items';
  const arr = get(itemsSource);
  const map = mapping.lineItems?.map ?? {
    description: 'label',
    quantity: 'quantity',
    unitPrice: 'unit_price',
  };
  if (Array.isArray(arr) && arr.length > 0) {
    // AST items use "label" for the description text; config may say "description" — resolve to label when needed
    const descriptionPath = (map.description === 'description' || map.description === 'Description') ? 'label' : (map.description || 'label');
    out.items = arr.map((item: Record<string, unknown>) => {
      const description = String(getByPath(item, descriptionPath) ?? '') || String(getByPath(item, 'label') ?? '');
      const quantity = map.quantity
        ? Number(getByPath(item, map.quantity)) || 1
        : 1;
      const unitPrice = map.unitPrice
        ? Number(getByPath(item, map.unitPrice)) || 0
        : 0;
      return {
        description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        taxRate: 0,
      };
    });
    if (out.items?.length) {
      out.subtotal = out.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
      if (out.totalAmount == null) out.totalAmount = out.subtotal;
    }
  }

  return out;
}
