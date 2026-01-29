/**
 * Node.js PDF parser for Vercel/serverless.
 * Extracts text, pattern-matched fields, amounts, and table-like rows; builds Document AST.
 */
import { createRequire } from 'module';
import type { DocumentAST } from '@/models/DocumentAST';

const require = createRequire(import.meta.url || (typeof __filename !== 'undefined' ? __filename : process.cwd() + '/package.json'));

export interface LayoutField {
  value: string;
  page: number;
  position: { x: number; y: number; width?: number; height?: number };
  confidence: number;
  source: string;
}

export interface PatternField extends LayoutField {
  field_type?: string;
  original_line?: string;
}

export interface TableField extends LayoutField {
  table_data?: Record<string, string>;
  table_index?: number;
  row_index?: number;
}

export interface ParseResult {
  success: true;
  fields: Array<PatternField | TableField | LayoutField>;
  document_ast: DocumentAST;
  stats: {
    total_fields: number;
    pattern_fields: number;
    table_fields: number;
    amount_fields: number;
    layout_included: number;
  };
}

export interface ParseError {
  success: false;
  error: string;
  traceback?: string;
}

/** Extract lines from full text (one line per array item). */
function extractLinesFromText(text: string, numPages: number): LayoutField[] {
  const lines: LayoutField[] = [];
  const raw = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  raw.forEach((line, i) => {
    lines.push({
      value: line,
      page: numPages > 0 ? Math.min(1 + Math.floor((i / Math.max(1, raw.length)) * numPages), numPages) : 1,
      position: { x: 0, y: i },
      confidence: 0.9,
      source: 'layout',
    });
  });
  return lines;
}

const PATTERNS: Record<string, RegExp[]> = {
  invoice_number: [
    /invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /invoice\s+number\s*:?\s*([A-Z0-9\-]+)/i,
    /inv\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
  ],
  date: [
    /date\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
  ],
  due_date: [
    /due\s+date\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i,
    /due\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i,
  ],
  total: [
    /total\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /amount\s+due\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
  ],
  subtotal: [
    /subtotal\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /sub-total\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
  ],
  tax: [
    /tax\s*\(?vat\)?\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /vat\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
  ],
  client_name: [
    /bill\s+to\s*:?\s*(.+)/i,
    /client\s*:?\s*(.+)/i,
    /customer\s*:?\s*(.+)/i,
  ],
  company_name: [
    /from\s*:?\s*(.+)/i,
    /company\s*:?\s*(.+)/i,
  ],
  email: [
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  ],
  phone: [
    /phone\s*:?\s*([+]?[\d\s\-()]+)/i,
    /tel\s*:?\s*([+]?[\d\s\-()]+)/i,
  ],
};

function patternMatchFields(lines: LayoutField[]): PatternField[] {
  const patternFields: PatternField[] = [];
  for (const lineObj of lines) {
    const lineText = (lineObj.value || '').toUpperCase();
    for (const [fieldType, regexList] of Object.entries(PATTERNS)) {
      for (const pattern of regexList) {
        const match = lineText.match(pattern);
        if (match) {
          const extracted = (match[1] ?? match[0] ?? '').trim();
          if (!extracted) continue;
          patternFields.push({
            ...lineObj,
            value: extracted,
            confidence: 0.85,
            source: 'pattern',
            field_type: fieldType,
            original_line: lineObj.value,
          });
          break;
        }
      }
    }
  }
  return patternFields;
}

const AMOUNT_KEYWORDS = /(total|subtotal|amount|tax|vat|due|balance|price|fee)\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/gi;
const CURRENCY_AMOUNT = /\$\s*([\d,]+\.?\d{0,2})|(?:USD|KES|EUR|GBP)\s*([\d,]+\.?\d{0,2})/gi;

function extractAmounts(lines: LayoutField[]): PatternField[] {
  const amountFields: PatternField[] = [];
  const seen = new Set<string>();
  for (const lineObj of lines) {
    const lineText = lineObj.value || '';
    let m: RegExpExecArray | null;
    AMOUNT_KEYWORDS.lastIndex = 0;
    while ((m = AMOUNT_KEYWORDS.exec(lineText)) !== null) {
      const amount = (m[2] || '').replace(/,/g, '').trim();
      if (amount && !seen.has(amount)) {
        try {
          if (parseFloat(amount) > 0) {
            seen.add(amount);
            amountFields.push({
              ...lineObj,
              value: amount,
              confidence: 0.95,
              source: 'amount',
              field_type: 'total',
              original_line: lineText,
            });
          }
        } catch {
          /* skip */
        }
      }
    }
    CURRENCY_AMOUNT.lastIndex = 0;
    while ((m = CURRENCY_AMOUNT.exec(lineText)) !== null) {
      const amount = (m[1] || m[2] || '').replace(/,/g, '').trim();
      if (amount && !seen.has(amount)) {
        try {
          if (parseFloat(amount) > 0) {
            seen.add(amount);
            amountFields.push({
              ...lineObj,
              value: amount,
              confidence: 0.95,
              source: 'amount',
              field_type: 'total',
              original_line: lineText,
            });
          }
        } catch {
          /* skip */
        }
      }
    }
  }
  return amountFields;
}

/** Build table-like fields from pdf-parse getTable() (rows = string[][]). */
function tableFieldsFromRows(rows: string[][], pageNum: number): TableField[] {
  const tableFields: TableField[] = [];
  if (rows.length < 2) return tableFields;
  const headers = rows[0].map((c, i) => String(c ?? '').trim() || `col_${i}`);
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowData: Record<string, string> = {};
    const parts: string[] = [];
    row.forEach((cell, colIdx) => {
      const val = String(cell ?? '').trim();
      if (val) {
        parts.push(val);
        rowData[headers[colIdx] ?? `col_${colIdx}`] = val;
      }
    });
    if (parts.length > 0) {
      tableFields.push({
        value: parts.join(' | '),
        page: pageNum,
        position: { x: 0, y: rowIdx, width: 0, height: 0 },
        confidence: 0.95,
        source: 'table',
        table_data: rowData,
        table_index: 0,
        row_index: rowIdx,
      });
    }
  }
  return tableFields;
}

/** Strip trailing day ordinals (e.g. 17th, 1st) from text — often due-date text bleeding into line-item descriptions. */
function stripTrailingDateOrdinal(s: string): string {
  return s.replace(/\s*\d{1,2}(?:st|nd|rd|th)$/i, '').trim();
}

/** Strip trailing "25th Nov COMPLETE" / "th NovCOMPLETE" style date+status from descriptions. */
function stripTrailingDateAndComplete(s: string): string {
  return s
    .replace(/\s*\d{0,2}(?:st|nd|rd|th)?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i, '')
    .trim();
}

/** True if label is only date/status junk (e.g. "th NovCOMPLETE", "25th Nov COMPLETE") — should not be a line item. */
function isDateStatusJunkOnly(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  // "th NovCOMPLETE", "25th Nov COMPLETE", "COMPLETE", "Nov COMPLETE", etc.
  if (/^COMPLETE\s*$/i.test(t)) return true;
  if (/^(?:\d{1,2}(?:st|nd|rd|th)\s*)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i.test(t)) return true;
  if (/^th\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i.test(t)) return true;
  return false;
}

const numberedRow = /^(\d+)\.?\s*(\d*)\s*(.+)$/;

/** Merge continuation lines (e.g. "MVS" after "Quality Control for Chapter 336 of") into the previous line for accurate descriptions. */
function mergeContinuationLines(lines: LayoutField[]): LayoutField[] {
  const out: LayoutField[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const line = (lineObj.value ?? '').trim();
    const nextLine = i + 1 < lines.length ? (lines[i + 1].value ?? '').trim() : '';
    const isNumbered = numberedRow.test(line);
    const isContinuation =
      nextLine.length > 0 &&
      nextLine.length <= 120 &&
      !numberedRow.test(nextLine) &&
      !isDateStatusJunkOnly(nextLine) &&
      !/^(deliverable|#|date|for:|name:)/i.test(nextLine);
    if (isNumbered && isContinuation) {
      out.push({ ...lineObj, value: `${line} ${nextLine}`.trim() });
      i++; // skip next line
    } else {
      out.push(lineObj);
    }
  }
  return out;
}

/**
 * Heuristic: lines that look like "1.348 Script Writing...", "2.349 Script...", "1. CODE Description"
 * Leading number is row index, NOT quantity. Each row = one deliverable with quantity 1.
 * Description = everything after the leading number/code (the actual deliverable text).
 */
function heuristicTableFromLines(lines: LayoutField[]): TableField[] {
  const tableFields: TableField[] = [];
  // Match: 1.348Script..., 1. 348 Script..., 1. Script Writing... (leading digits, optional .code, rest = description)
  lines.forEach((lineObj, i) => {
    const line = (lineObj.value ?? '').trim();
    const m = line.match(numberedRow);
    if (!m || !m[3] || m[3].length < 2) return;
    const rowIndex = m[1];
    const code = m[2]?.trim() ?? '';
    const description = stripTrailingDateAndComplete(stripTrailingDateOrdinal(m[3].trim()));
    const rowData: Record<string, string> = {
      index: rowIndex,
      quantity: '1',
      code,
      description,
      label: description,
    };
    tableFields.push({
      ...lineObj,
      position: { ...lineObj.position, width: 0, height: 0 },
      source: 'table',
      table_data: rowData,
      table_index: 0,
      row_index: i,
    });
  });
  return tableFields;
}

function buildDocumentAst(
  layoutFields: LayoutField[],
  patternFields: PatternField[],
  tableFields: TableField[]
): DocumentAST {
  const meta: DocumentAST['meta'] = { title: '', reference_numbers: {} };
  const parties: DocumentAST['parties'] = { issuer: '', recipient: '' };
  const items: DocumentAST['items'] = [];
  const dates: DocumentAST['dates'] = { due: '', signed: '' };
  const rawLines: string[] = [];

  for (const f of patternFields) {
    const ft = f.field_type ?? '';
    const val = (f.value ?? '').trim();
    if (!val) continue;
    if (ft === 'invoice_number') meta.reference_numbers.invoice_number = val;
    else if (ft === 'date') dates.signed = val;
    else if (ft === 'due_date') dates.due = val;
    else if (ft === 'client_name') parties.recipient = val;
    else if (ft === 'company_name') parties.issuer = val;
    else if (ft === 'total' || ft === 'subtotal' || ft === 'tax') {
      meta.reference_numbers[ft] = val;
    }
  }

  for (const lineObj of layoutFields) {
    const line = (lineObj.value ?? '').trim();
    rawLines.push(line);
    const lower = line.toLowerCase();
    if (lower.includes('task order') || lower.includes('t.o')) {
      // Prefer number after # (e.g. "Task Order: #TS1-ND-0013" -> TS1-ND-0013); else skip so we don't capture "Task"
      const m = line.match(/#\s*([A-Z0-9\-]+)/i);
      if (m) meta.reference_numbers.task_order = m[1].trim();
    }
    if (lower.includes('contract') && lower.includes('number')) {
      const idx = line.indexOf(':');
      if (idx >= 0) meta.reference_numbers.contract = line.slice(idx + 1).trim();
    }
    if (line.toUpperCase().startsWith('FOR:') && line.length > 5) {
      const name = line.slice(4).trim();
      if (!parties.issuer) parties.issuer = name;
      else parties.recipient = name;
    }
  }

  for (const lineObj of layoutFields) {
    const line = (lineObj.value ?? '').trim();
    if (line.length > 2 && !/^(deliverable|#|date)/i.test(line)) {
      meta.title = line;
      break;
    }
  }

  for (const f of tableFields) {
    const td = f.table_data ?? {};
    const fullLine = (f.value ?? '').trim();
    const rawLabel =
      (td['label'] ?? td['Description'] ?? td['description'] ?? td['Deliverable'] ?? '').trim() || fullLine;
    let label = stripTrailingDateAndComplete(stripTrailingDateOrdinal(rawLabel)) || fullLine;
    // Skip rows that are only date/status junk (e.g. "th NovCOMPLETE") — not real line items
    if (isDateStatusJunkOnly(label)) continue;
    const row: (typeof items)[0] = {
      label: label || fullLine,
      quantity: 1,
      unit_price: null,
      status: td['Status'] ?? td['status'] ?? '',
    };
    for (const [k, v] of Object.entries(td)) {
      const kl = k.toLowerCase();
      if (kl === 'label' || kl.includes('desc')) {
        const val = String(v ?? '').trim();
        if (val) {
          const cleaned = stripTrailingDateAndComplete(stripTrailingDateOrdinal(val));
          if (!isDateStatusJunkOnly(cleaned)) row.label = cleaned;
        }
      } else if (kl === 'quantity' || kl.includes('qty') || kl.includes('quantity') || kl === 'index') {
        const n = parseInt(String(v).replace(/,/g, ''), 10);
        if (!Number.isNaN(n) && n > 0) row.quantity = n;
      } else if (kl.includes('price') || kl.includes('amount')) {
        const n = parseFloat(String(v).replace(/,/g, ''));
        if (!Number.isNaN(n)) row.unit_price = n;
      } else if (kl.includes('status')) row.status = v ?? row.status;
    }
    if (isDateStatusJunkOnly(row.label)) continue;
    if (row.label || row.status) items.push(row);
  }

  return {
    meta,
    parties,
    items,
    dates,
    raw_lines: rawLines.slice(0, 50),
  };
}

/** Parse PDF buffer and return fields + document_ast. */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult | ParseError> {
  try {
    // pdf-parse v1.1.1: load lib directly to avoid index.js test block that reads ./test/data/05-versions-space.pdf from cwd
    const pdf = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text?: string; numpages?: number }>;
    const data = await pdf(buffer);
    const text = (data as { text?: string }).text ?? '';
    const numPages = (data as { numpages?: number }).numpages ?? 1;

    const layoutFields = extractLinesFromText(text, numPages);
    const mergedLayout = mergeContinuationLines(layoutFields);
    const patternFields = patternMatchFields(layoutFields);
    const amountFields = extractAmounts(layoutFields);
    const tableFields = heuristicTableFromLines(mergedLayout);

    const allFields: Array<PatternField | TableField | LayoutField> = [];
    const seenValues = new Set<string>();

    for (const f of patternFields) {
      const v = (f.value ?? '').trim().toLowerCase();
      if (v && !seenValues.has(v)) {
        allFields.push(f);
        seenValues.add(v);
      }
    }
    for (const f of tableFields) {
      const v = (f.value ?? '').trim().toLowerCase();
      if (v && v.length > 3 && !seenValues.has(v)) {
        allFields.push(f);
        seenValues.add(v);
      }
    }
    for (const f of amountFields) {
      const v = (f.value ?? '').trim();
      if (v && !seenValues.has(v)) {
        allFields.push(f);
        seenValues.add(v);
      }
    }

    const skipPrefixes = ['deliverable', '#', 'date', 'description', 'due', 'status', 'index'];
    for (const field of layoutFields) {
      const fieldValue = (field.value ?? '').trim();
      const fieldLower = fieldValue.toLowerCase();
      if (!fieldValue || fieldValue.length < 4) continue;
      if (seenValues.has(fieldLower)) continue;
      if (skipPrefixes.some((p) => fieldLower.startsWith(p) && fieldValue.length < 25)) continue;
      if (fieldValue.replace(/[.\s,]/g, '').match(/^\d+$/)) continue;
      allFields.push(field);
      seenValues.add(fieldLower);
    }

    const orderKey = (x: { source?: string; confidence?: number }) => {
      const s = x.source ?? '';
      if (s === 'pattern') return 0;
      if (s === 'table') return 1;
      if (s === 'amount') return 2;
      return 3;
    };
    allFields.sort((a, b) => orderKey(a) - orderKey(b) || (b.confidence ?? 0) - (a.confidence ?? 0));

    const document_ast = buildDocumentAst(layoutFields, patternFields, tableFields);

    return {
      success: true,
      fields: allFields,
      document_ast,
      stats: {
        total_fields: allFields.length,
        pattern_fields: patternFields.length,
        table_fields: tableFields.length,
        amount_fields: amountFields.length,
        layout_included: allFields.filter((f) => f.source === 'layout').length,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      error: error.message,
      traceback: error.stack,
    };
  }
}
