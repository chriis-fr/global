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
  /** Raw text extracted by pdf-parse – use for debugging parser/mapping. */
  raw_text?: string;
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
    /gross\s+pay\s*\(?[^)]*\)?\s*:?\s*([\d,]+\.?\d*)/i,
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future table extraction
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

/** Strip trailing "25th Nov COMPLETE" / "th NovCOMPLETE" style date+status from descriptions. Never strip "(N completed)". */
function stripTrailingDateAndComplete(s: string): string {
  return s
    .replace(/\s*\d{0,2}(?:st|nd|rd|th)?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i, '')
    .trim();
}

/**
 * Strip pipe-date/status column junk (e.g. "|1|26 --", "21|1|26Completed-") from descriptions.
 * Common in task-order tables where due-date/status cells bleed into the deliverable column.
 */
function stripPipeDateStatus(s: string): string {
  return s
    .replace(/\d{1,2}\|\d{1,2}\|\d{1,2}\s*Completed?-?\s*/gi, ' ')
    .replace(/-?\s*(?:\d{1,2}\|\d{1,2}\|\d{1,2}|\|\d{1,2}\|\d{1,2})\s*-*\s*$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^-+/, '')
    .trim();
}

/**
 * Parse trailing column numbers from task order table rows.
 * Formats: "Description 1 0 9 0 0" (5 cols: Assigned, Extra, Completed, Incomplete, Reassigned)
 *          "Description 1 9 0" (3 cols: Assigned, Completed, Incomplete)
 * Returns { description, completedUnits } so we can append " (N completed)" when applicable.
 */
function parseTrailingColumnNumbers(raw: string): { description: string; completedUnits?: number } {
  const fiveNums = raw.match(/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
  if (fiveNums) {
    const completed = parseInt(fiveNums[4], 10); // 3rd number = Completed
    return {
      description: fiveNums[1].trim(),
      completedUnits: !Number.isNaN(completed) && completed > 0 ? completed : undefined,
    };
  }
  const threeNums = raw.match(/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)$/);
  if (threeNums) {
    const completed = parseInt(threeNums[3], 10); // 2nd number = Completed
    return {
      description: threeNums[1].trim(),
      completedUnits: !Number.isNaN(completed) && completed > 0 ? completed : undefined,
    };
  }
  return { description: raw.trim() };
}

/** Uniform format: "CH 410, PP (9 completed)" — same as scanForTaskOrderCodes for consistency across uploads. */
function formatTaskOrderLabel(text: string): string | null {
  const t = text.replace(/\s+/g, '').trim();
  // Consecutive: CH402TS3-3 → "CH 402, TS (3 completed)"
  const consecutiveCodesPattern = /([A-Z]{2})(\d+)([A-Z]{2}\d+)(?:-(\d+))?/g;
  let m = consecutiveCodesPattern.exec(t);
  if (m) {
    const deliverable = m[1];
    const num = m[2];
    const typeCode = m[3].toUpperCase();
    const type = typeCode.length >= 3 ? typeCode.slice(0, 2) : typeCode;
    const n = m[4] ? parseInt(m[4], 10) : undefined;
    const suffix = n != null && !Number.isNaN(n) ? ` (${n} completed)` : '';
    return `${deliverable} ${num}, ${type}${suffix}`;
  }
  // Standalone: 428PP11-11 → "CH 428, PP (11 completed)"
  const categoryWithUnitsPattern = /(\d+)([A-Z]{2}\d+)(?:-(\d+))?/g;
  m = categoryWithUnitsPattern.exec(t);
  if (m) {
    const chapter = m[1];
    const typeCode = m[2].toUpperCase();
    const type = typeCode.length >= 3 ? typeCode.slice(0, 2) : typeCode;
    const n = m[3] ? parseInt(m[3], 10) : undefined;
    const suffix = n != null && !Number.isNaN(n) ? ` (${n} completed)` : '';
    return `CH ${chapter}, ${type}${suffix}`;
  }
  return null;
}

/** True if label is only date/status junk (e.g. "th NovCOMPLETE", "|1|26 --") — should not be a line item. */
function isDateStatusJunkOnly(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  // "th NovCOMPLETE", "25th Nov COMPLETE", "COMPLETE", "Nov COMPLETE", etc.
  if (/^COMPLETE\s*$/i.test(t)) return true;
  if (/^(?:\d{1,2}(?:st|nd|rd|th)\s*)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i.test(t)) return true;
  if (/^th\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*COMPLETE\s*$/i.test(t)) return true;
  // Pipe-date/status column junk: "|31|26 --", "|1|26 --", "-Manager1|1|26 -" → after stripPipeDateStatus becomes "" or "-Manager"
  const cleaned = stripPipeDateStatus(t);
  if (!cleaned || /^[\s\-]+$/.test(cleaned)) return true;
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

/** Check if a line looks like a markdown table row (starts with | and contains at least one more |). */
function isMarkdownTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.length > 2 && t.includes('|', 1);
}

/** Check if line looks like a markdown table separator (|---|---|). */
function isMarkdownTableSeparator(line: string): boolean {
  return /^\|[\s\-:]+\|/.test(line.trim()) && line.trim().replace(/\s/g, '').replace(/:/g, '-').split('|').every((c) => c === '' || /^-+$/.test(c));
}

/**
 * Parse markdown table blocks from lines (e.g. from ClickUp doc content).
 * Rows with the same Deliverable Description are merged into one line: description + chapters, qty = number of chapters.
 */
function parseMarkdownTableFromLines(lines: LayoutField[]): TableField[] {
  const rows: { description: string; deliverableNum: string; lineObj: LayoutField; rowIndex: number }[] = [];
  let headerCells: string[] = [];
  let tableStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const line = (lineObj.value ?? '').trim();
    if (!isMarkdownTableRow(line)) {
      headerCells = [];
      continue;
    }
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    if (isMarkdownTableSeparator(line)) continue;

    if (headerCells.length === 0) {
      headerCells = cells.map((c, idx) => (c && c.length > 0 ? c : `col_${idx}`));
      tableStartIndex = i;
      continue;
    }

    const rowData: Record<string, string> = {};
    headerCells.forEach((h, idx) => {
      rowData[h] = cells[idx] ?? '';
    });
    const description =
      (rowData['Deliverable Description'] ??
        rowData['Deliverable description'] ??
        rowData['Description'] ??
        rowData['description'] ??
        rowData['label'] ??
        cells.join(' ').trim()
      ).trim();
    if (!description && cells.every((c) => !c)) continue;
    const deliverableNum = (rowData['Deliverable #'] ?? '').trim();
    rows.push({
      description,
      deliverableNum,
      lineObj,
      rowIndex: i - tableStartIndex - 1,
    });
  }

  // Group by description (same description = one line; chapters combined, qty = number of chapters)
  const byDesc = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.description.toLowerCase().trim();
    if (!byDesc.has(key)) byDesc.set(key, []);
    if (r.deliverableNum) byDesc.get(key)!.push(r.deliverableNum);
  }

  const tableFields: TableField[] = [];
  const firstLineObj = rows[0]?.lineObj ?? { value: '', page: 1, position: { x: 0, y: 0 }, confidence: 0.9, source: 'table' };
  let rowIdx = 0;
  for (const r of rows) {
    const key = r.description.toLowerCase().trim();
    const chapters = byDesc.get(key);
    if (!chapters || chapters.length === 0) continue;
    byDesc.delete(key); // emit once per description
    const chaptersStr = [...new Set(chapters)].join(', ');
    const label = chaptersStr ? `${r.description} ${chaptersStr}` : r.description;
    const quantity = chapters.length;
    const rowData: Record<string, string> = {
      label,
      quantity: String(quantity),
      description: r.description,
    };
    tableFields.push({
      ...firstLineObj,
      value: label,
      position: { x: 0, y: rowIdx, width: 0, height: 0 },
      source: 'table',
      table_data: rowData,
      table_index: 0,
      row_index: rowIdx,
    });
    rowIdx++;
  }
  return tableFields;
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
    const rest = m[3].trim();
    const { description: descPart, completedUnits } = parseTrailingColumnNumbers(rest);
    const description = stripPipeDateStatus(stripTrailingDateAndComplete(stripTrailingDateOrdinal(descPart)));
    const rowData: Record<string, string> = {
      index: rowIndex,
      quantity: '1',
      code,
      description,
      label: description,
    };
    if (completedUnits != null) {
      rowData['completed_units'] = String(completedUnits);
    }
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
    if (line.length > 2 && !/^(deliverable|#|date)/i.test(line) && !line.startsWith('|')) {
      meta.title = line;
      break;
    }
  }

  const taskOrderRef = meta.reference_numbers.task_order ?? '';
  const chapterFromTaskOrder = taskOrderRef ? taskOrderRef.match(/-(\d+)$/)?.[1] ?? '' : '';

  for (const f of tableFields) {
    const td = f.table_data ?? {};
    const fullLine = (f.value ?? '').trim();
    const rawLabel =
      (td['label'] ?? td['Description'] ?? td['description'] ?? td['Deliverable'] ?? '').trim() || fullLine;
    let label = stripPipeDateStatus(stripTrailingDateAndComplete(stripTrailingDateOrdinal(rawLabel))) || fullLine;
    // Convert task-order codes (e.g. "429CU9-9", "021CH402") to proper format with "(N completed)" when present
    const formatted =
      formatTaskOrderLabel(rawLabel) || formatTaskOrderLabel(rawLabel.replace(/\s+/g, ''));
    if (formatted) label = formatted;
    // Skip rows that are only date/status junk (e.g. "th NovCOMPLETE") — not real line items
    if (isDateStatusJunkOnly(label)) continue;
    const code = String(td['code'] ?? '').trim();
    const row: (typeof items)[0] = {
      label: label || fullLine,
      quantity: 1,
      unit_price: null,
      status: td['Status'] ?? td['status'] ?? '',
    };
    if (code) {
      (row as typeof row & { _code?: string })._code = code;
    }
    for (const [k, v] of Object.entries(td)) {
      const kl = k.toLowerCase();
      if (kl === 'label' || kl.includes('desc')) {
        const val = String(v ?? '').trim();
        if (val) {
          const useLabel = (k !== 'label' && k !== 'Label') && (td['label'] ?? td['Label']);
          const source = useLabel ? String(td['label'] ?? td['Label'] ?? '').trim() : val;
          const cleaned = stripPipeDateStatus(stripTrailingDateAndComplete(stripTrailingDateOrdinal(source)));
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
    // Apply enhancements after loop so they are not overwritten
    label = row.label ?? '';
    const completedUnits = td['completed_units'] ? parseInt(td['completed_units'], 10) : undefined;
    if (
      completedUnits != null &&
      !Number.isNaN(completedUnits) &&
      completedUnits > 0 &&
      !/\(\d+\s+completed\)$/i.test(label)
    ) {
      label = `${label} (${completedUnits} completed)`;
    }
    if (
      chapterFromTaskOrder &&
      !/–\s*Ch\.\s*\d+/i.test(label) &&
      /^[A-Z]{2}\s*,\s*\d+/i.test(label.trim())
    ) {
      label = `${label.trim()} – Ch. ${chapterFromTaskOrder}`;
    }
    row.label = label;
    if (isDateStatusJunkOnly(label)) continue;
    if (row.label || row.status) items.push(row);
  }

  // Task order: scan rawLines for chapter+category format (413CU3-3--, 021CH402) to produce proper labels.
  // Formats: "CU, 3 – Ch. 413 (3 completed)" when completed units present, "CH, 402 – Ch. 021" otherwise.
  const taskOrderCodePattern = /#TO\d+/;
  const hasTaskOrderRef = rawLines.some((l) => taskOrderCodePattern.test(l));
  const hasHolidayWeekend = rawLines.some(
    (l) => /holiday\/weekend/i.test(l) || (/holiday/i.test(l) && /compensation/i.test(l))
  );
  const itemsContainTemplateJunk = items.some((it) => {
    const lbl = (it.label ?? '').toLowerCase();
    return (
      /do not|delete this template|template/i.test(lbl) ||
      /gross pay\s*\(?ksh\)?/i.test(lbl) ||
      /^day\s*\(jan/i.test(lbl) ||
      /sat\)\s*gross/i.test(lbl)
    );
  });
  const categoryWithUnitsPattern = /(\d+)([A-Z]{2}\d+)(?:-(\d+))?/g;
  // Consecutive codes: CH402TS3-3, CH410PP9-9 → uniform "CH 402, TS (3 completed)" or "CH 410, PP (9 completed)"
  const consecutiveCodesPattern = /([A-Z]{2})(\d+)([A-Z]{2}\d+)(?:-(\d+))?/g;
  const taskOrderChapter = (meta.reference_numbers.task_order ?? '').match(/-(\d+)$/)?.[1] ?? '';

  /** Uniform format: "{deliverable} {number}, {type} ({n} completed)" - simple, same for all rows. */
  const formatUniformLabel = (
    deliverable: string,
    number: string,
    type: string,
    completed: number | undefined
  ): string => {
    const typePart = type.length >= 3 ? type.slice(0, 2) : type;
    if (completed != null && !Number.isNaN(completed) && completed > 0) {
      return `${deliverable} ${number}, ${typePart} (${completed} completed)`;
    }
    return `${deliverable} ${number}, ${typePart}`;
  };

  /** Scan text for task-order codes. Uniform format: "CH 402, TS (3 completed)" or "CH 428, PP (11 completed)". */
  const scanForTaskOrderCodes = (text: string): DocumentAST['items'] => {
    const newItems: DocumentAST['items'] = [];
    const seen = new Set<string>();
    const skipFromPattern1 = new Set<string>();

    // 1) Consecutive codes FIRST: CH402TS3-3 → "CH 402, TS (3 completed)" (uniform)
    consecutiveCodesPattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = consecutiveCodesPattern.exec(text)) !== null) {
      const firstType = m[1].toUpperCase();
      const sharedNum = m[2];
      const secondCode = m[3].toUpperCase();
      const completedUnits = m[4] ? parseInt(m[4], 10) : undefined;
      if (!sharedNum || !secondCode) continue;
      const secondType = secondCode.length >= 3 ? secondCode.slice(0, 2) : secondCode;
      const label = formatUniformLabel(firstType, sharedNum, secondType, completedUnits);
      const key = `merged-${firstType}${sharedNum}-${secondCode}-${completedUnits ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        newItems.push({ label, quantity: 1, unit_price: null, status: '' });
        skipFromPattern1.add(`${taskOrderChapter}-${firstType}${sharedNum}-`);
        skipFromPattern1.add(`${sharedNum}-${secondCode}-${completedUnits ?? ''}`);
      }
    }

    // 2) Standalone: 428PP11-11 → "CH 428, PP (11 completed)" (same uniform format)
    categoryWithUnitsPattern.lastIndex = 0;
    while ((m = categoryWithUnitsPattern.exec(text)) !== null) {
      const chapter = m[1];
      const code = m[2].toUpperCase();
      const completedUnits = m[3] ? parseInt(m[3], 10) : undefined;
      if (!chapter || !code) continue;
      const skipKey = `${chapter}-${code}-${completedUnits ?? ''}`;
      if (skipFromPattern1.has(skipKey)) continue;
      const typePart = code.length >= 3 ? code.slice(0, 2) : code;
      const label = formatUniformLabel('CH', chapter, typePart, completedUnits);
      const key2 = `${chapter}-${code}-${completedUnits ?? ''}`;
      if (!seen.has(key2)) {
        seen.add(key2);
        newItems.push({ label, quantity: 1, unit_price: null, status: '' });
      }
    }
    return newItems;
  };

  const extractTaskOrderItemsFromRawLines = (): DocumentAST['items'] => {
    const newItems: DocumentAST['items'] = [];
    // 1) Line-by-line scan (Cedric-style: codes on single lines)
    for (const line of rawLines) {
      newItems.push(...scanForTaskOrderCodes(line));
    }
    // 2) Full-text scan fallback: similar layouts can produce different line breaks – codes may be split across lines.
    //    Collapse whitespace so "428\nPP11-11" or "428 PP11-11" becomes "428PP11-11" and matches.
    const fullText = rawLines.join('\n');
    const collapsedText = fullText.replace(/\s+/g, '');
    if (fullText.length > 0) {
      const fullScanItems = scanForTaskOrderCodes(collapsedText);
      const existingKeys = new Set(newItems.map((it) => (it.label ?? '').toLowerCase()));
      for (const it of fullScanItems) {
        const key = (it.label ?? '').toLowerCase();
        if (!existingKeys.has(key)) {
          newItems.push(it);
          existingKeys.add(key);
        }
      }
    }
    if (hasHolidayWeekend) {
      const hwIdx = rawLines.findIndex((l) => /holiday/i.test(l));
      const nextIsCompensation = hwIdx >= 0 && rawLines[hwIdx + 1]?.toLowerCase().trim() === 'compensation';
      const label =
        hwIdx >= 0
          ? nextIsCompensation
            ? `${rawLines[hwIdx].trim()} ${rawLines[hwIdx + 1].trim()}`
            : rawLines[hwIdx].trim()
          : 'Holiday/Weekend compensation';
      newItems.push({ label, quantity: 1, unit_price: null, status: '' });
    }
    return newItems;
  };

  if (hasTaskOrderRef || hasHolidayWeekend) {
    const rawLineItems = extractTaskOrderItemsFromRawLines();
    const shouldReplace =
      (items.length <= 5 || itemsContainTemplateJunk) && rawLineItems.length > 0;
    if (shouldReplace) {
      items.splice(0, items.length, ...rawLineItems);
    } else if (rawLineItems.length > 0) {
      // Merge: add rawLine items that table missed (e.g. "CU, 9 – Ch. 429 (9 completed)" from "429CU9-9")
      const existingKeys = new Set(
        items.map((it) =>
          stripTrailingDateAndComplete(stripTrailingDateOrdinal((it.label ?? '').trim())).toLowerCase()
        )
      );
      for (const it of rawLineItems) {
        const key = stripTrailingDateAndComplete(stripTrailingDateOrdinal((it.label ?? '').trim())).toLowerCase();
        if (!existingKeys.has(key)) {
          items.push(it);
          existingKeys.add(key);
        }
      }
    }
  }

  // Merge identical deliverable rows into a single item with quantity > 1 where appropriate.
  // This helps when the PDF repeats the same task/line multiple times instead of using an explicit quantity.
  if (items.length > 0) {
    const mergedMap = new Map<
      string,
      { label: string; quantity: number; unit_price: number | null; status?: string; codes: string[] }
    >();

    const normalizeLabel = (s: string) =>
      stripTrailingDateAndComplete(stripTrailingDateOrdinal((s || '').trim())).toLowerCase();

    for (const item of items as Array<typeof items[0] & { _code?: string }>) {
      const key = normalizeLabel(item.label);
      // If label disappears after normalization, keep as-is (avoid merging junk-only lines).
      if (!key) {
        const passthroughKey = `__raw__:${item.label}:${mergedMap.size}`;
        mergedMap.set(passthroughKey, { ...item, codes: item._code ? [item._code] : [] });
        continue;
      }

      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, { ...item, codes: item._code ? [item._code] : [] });
      } else {
        // Same normalized label: bump quantity and preserve first non-null unit_price/status.
        existing.quantity += item.quantity || 1;
        if (existing.unit_price == null && item.unit_price != null) {
          existing.unit_price = item.unit_price;
        }
        if (!existing.status && item.status) {
          existing.status = item.status;
        }
        if (item._code) {
          if (!existing.codes.includes(item._code)) {
            existing.codes.push(item._code);
          }
        }
      }
    }

    const mergedItems: DocumentAST['items'] = [];
    for (const value of mergedMap.values()) {
      const baseLabel = stripTrailingDateAndComplete(stripTrailingDateOrdinal(value.label));
      const codesLabel =
        value.codes && value.codes.length > 0 ? `${value.codes.join(', ')} ` : '';
      mergedItems.push({
        // Example: "585, 588, 589 Script Writing 20th Jan"
        label: `${codesLabel}${baseLabel}`.trim(),
        quantity: value.quantity > 0 ? value.quantity : 1,
        unit_price: value.unit_price ?? null,
        status: value.status,
      });
    }

    // Replace items with merged version
    (items as DocumentAST['items']).splice(0, items.length, ...mergedItems);
  }

  return {
    meta,
    parties,
    items,
    dates,
    raw_lines: rawLines.slice(0, 50),
  };
}

function parseTextToAstInternal(text: string, numPages: number): ParseResult {
  const layoutFields = extractLinesFromText(text, numPages);
  const mergedLayout = mergeContinuationLines(layoutFields);
  const patternFields = patternMatchFields(layoutFields);
  const amountFields = extractAmounts(layoutFields);
  const markdownTableFields = parseMarkdownTableFromLines(mergedLayout);
  const tableFields =
    markdownTableFields.length > 0 ? markdownTableFields : heuristicTableFromLines(mergedLayout);

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
    raw_text: text,
    stats: {
      total_fields: allFields.length,
      pattern_fields: patternFields.length,
      table_fields: tableFields.length,
      amount_fields: amountFields.length,
      layout_included: allFields.filter((f) => f.source === 'layout').length,
    },
  };
}

/** Parse already-extracted plain text and return fields + document_ast (same output shape as PDF parsing). */
export function parsePdfText(text: string, numPages = 1): ParseResult | ParseError {
  try {
    return parseTextToAstInternal(text ?? '', numPages);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error: error.message, traceback: error.stack };
  }
}

/** Parse PDF buffer and return fields + document_ast. */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult | ParseError> {
  try {
    // pdf-parse v1.1.1: load lib directly to avoid index.js test block that reads ./test/data/05-versions-space.pdf from cwd
    const pdf = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text?: string; numpages?: number }>;
    const data = await pdf(buffer);
    const text = (data as { text?: string }).text ?? '';
    const numPages = (data as { numpages?: number }).numpages ?? 1;
    return parseTextToAstInternal(text, numPages);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      error: error.message,
      traceback: error.stack,
    };
  }
}
