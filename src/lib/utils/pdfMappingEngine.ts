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

/** Normalize label for lookup: lowercase, trim, collapse spaces, normalize dash variants. */
function normalizeLabelKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-'); // hyphen, en-dash, em-dash, etc -> hyphen
}

/** Look up value in map - tries exact key, normalized key, and fuzzy match (dash variants). */
function lookupByLabel<T>(
  map: Record<string, T> | undefined,
  rawLabel: string
): T | undefined {
  if (!map) return undefined;
  const exact = rawLabel.trim().toLowerCase();
  if (map[exact] !== undefined) return map[exact];
  const normalized = normalizeLabelKey(rawLabel);
  if (map[normalized] !== undefined) return map[normalized];
  for (const [k, v] of Object.entries(map)) {
    if (normalizeLabelKey(k) === normalized) return v;
  }
  return undefined;
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
  // Fallback: when mapping doesn't map total but document has meta.reference_numbers.total (e.g. task order PDFs)
  if (out.totalAmount == null) {
    const v = get('meta.reference_numbers.total');
    if (v != null) {
      const n = parseFloat(String(v).replace(/,/g, ''));
      if (!Number.isNaN(n) && n > 0) {
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
    // Detect collapse: when multiple different raw codes map to the same display name, use raw for all (avoid mixing distinct items)
    const displayToRawSet = new Map<string, Set<string>>();
    for (const item of arr as Record<string, unknown>[]) {
      const raw = String(getByPath(item, descriptionPath) ?? '') || String(getByPath(item, 'label') ?? '');
      const display = lookupByLabel(mapping.lineItemDescriptions, raw);
      if (display) {
        const key = raw.trim().toLowerCase();
        if (!displayToRawSet.has(display)) displayToRawSet.set(display, new Set());
        displayToRawSet.get(display)!.add(key);
      }
    }
    const collapsedDisplays = new Set<string>();
    for (const [display, rawSet] of displayToRawSet) {
      if (rawSet.size > 1) collapsedDisplays.add(display);
    }
    out.items = arr.map((item: Record<string, unknown>) => {
      const rawDescription = String(getByPath(item, descriptionPath) ?? '') || String(getByPath(item, 'label') ?? '');
      const displayName = lookupByLabel(mapping.lineItemDescriptions, rawDescription);
      const description =
        displayName && !collapsedDisplays.has(displayName) ? displayName : rawDescription;
      const quantity = map.quantity
        ? Number(getByPath(item, map.quantity)) || 1
        : 1;
      let unitPrice = map.unitPrice
        ? Number(getByPath(item, map.unitPrice)) || 0
        : 0;

      // If no price was found in the PDF, fall back to any preset price for this description
      if (!unitPrice && mapping.lineItemPrices) {
        const preset = lookupByLabel(mapping.lineItemPrices, rawDescription);
        if (preset && typeof preset.unitPrice === 'number' && preset.unitPrice > 0) {
          unitPrice = preset.unitPrice;
        }
      }

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
