'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { InvoiceDraft, CreateInvoiceDraftInput, ExtractedField } from '@/models/InvoiceDraft';
import { CreateInvoiceInput, ClientDetails } from '@/models/Invoice';
import type { DocumentAST, OrgPdfMappingConfig, PdfMappingEntry } from '@/models/DocumentAST';
import { applyPdfMapping } from '@/lib/utils/pdfMappingEngine';
import { parsePdfBuffer, parsePdfText } from '@/lib/services/pdfParser';
import { getPresetByName, PDF_FORMAT_PRESETS } from '@/data/pdfFormatPresets';

/** Serialize draft for Client Components (ObjectId/Date to plain values; documentAst as plain object for fromPdfDraft prefill). */
function serializeDraft(draft: Record<string, unknown>): InvoiceDraft {
  const toStr = (v: unknown) => (v != null && typeof (v as { toString?: () => string }).toString === 'function' ? (v as { toString: () => string }).toString() : v);
  const toDate = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
  const plainInvoiceData = draft.invoiceData != null ? JSON.parse(JSON.stringify(draft.invoiceData)) : {};
  const plainDocumentAst = draft.documentAst != null ? JSON.parse(JSON.stringify(draft.documentAst)) : null;
  return {
    ...draft,
    _id: toStr(draft._id) as string,
    userId: toStr(draft.userId) as string,
    organizationId: draft.organizationId != null ? (toStr(draft.organizationId) as string) : undefined,
    sourcePdfId: (toStr(draft.sourcePdfId) as string) || undefined,
    createdAt: toDate(draft.createdAt) as string,
    updatedAt: toDate(draft.updatedAt) as string,
    extractedFields: Array.isArray(draft.extractedFields) ? draft.extractedFields : [],
    invoiceData: plainInvoiceData,
    documentAst: plainDocumentAst,
  } as unknown as InvoiceDraft;
}

function extractTextFromClickUpPagePayload(payload: unknown): string {
  const out: string[] = [];
  const seen = new Set<string>();
  const maxChars = 220_000;
  const maxStrings = 12_000;
  let totalChars = 0;

  const push = (s: string) => {
    const t = (s ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (t.length > 5000) return; // avoid massive blobs
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
    totalChars += t.length + 1;
  };

  const walk = (node: unknown, depth: number) => {
    if (out.length >= maxStrings || totalChars >= maxChars) return;
    if (node == null) return;
    if (typeof node === 'string') {
      push(node);
      return;
    }
    if (typeof node === 'number' || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = node as any;
      // If there is an obvious "name/title" field, include it early
      if (typeof obj.name === 'string') push(obj.name);
      if (typeof obj.title === 'string') push(obj.title);
      // Walk values only (we don't want to inject keys)
      for (const v of Object.values(obj)) walk(v, depth + 1);
    }
  };

  walk(payload, 0);
  return out.join('\n');
}

/** Upload PDF and parse in memory only — no file is saved. Creates draft from extracted data; PDF is never stored. */
export async function uploadAndParsePdf(formData: FormData, mappingName?: string | null): Promise<{
  success: boolean;
  data?: { draftId: string; extractedFields: ExtractedField[]; status: 'ready' | 'mapping' };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }
    if (file.type !== 'application/pdf') {
      return { success: false, error: 'Only PDF files are allowed' };
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size must be less than 10MB' };
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Parse from buffer — no file written to disk
    const bytes = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(bytes);
    const parseResult = await parsePdfBuffer(pdfBuffer);

    if (!parseResult.success || !('fields' in parseResult)) {
      return { success: false, error: parseResult.error ?? 'Failed to parse PDF' };
    }

    const { document_ast, stats } = parseResult;
    const documentAst = document_ast as DocumentAST | undefined;

    // ——— Log parsed output so you can align mapping ———
    console.log('\n========== [PDF Parse] Uploaded file:', file.name, '==========');
    if (stats) console.log('[PDF Parse] Stats:', JSON.stringify(stats, null, 2));
    const rawText = (parseResult as { raw_text?: string }).raw_text;
    if (rawText) {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      console.log('[PDF Parse] Raw extracted text (line-by-line) – use this to mold the parser:');
      lines.forEach((line, i) => {
        console.log(`  [${i + 1}] ${line.slice(0, 100)}${line.length > 100 ? '...' : ''}`);
      });
      console.log(`[PDF Parse] Total raw lines: ${lines.length} | Char count: ${rawText.length}`);
    }
    console.log('[PDF Parse] Document AST (what mapping uses):');
    console.log('  meta:', JSON.stringify(documentAst?.meta ?? {}, null, 2));
    console.log('  parties:', JSON.stringify(documentAst?.parties ?? {}, null, 2));
    console.log('  dates:', JSON.stringify(documentAst?.dates ?? {}, null, 2));
    console.log('  items (line items):', documentAst?.items?.length ?? 0);
    if (documentAst?.items?.length) {
      documentAst.items.forEach((item: { label?: string; quantity?: number; unit_price?: number | null }, i: number) => {
        console.log(`    [${i}] qty ${item.quantity ?? 1}: ${(item.label ?? '').slice(0, 80)}`);
      });
    }
    console.log('  raw_lines (first 20):', documentAst?.raw_lines?.slice(0, 20) ?? []);
    // Diagnostic: Cedric-style PDFs have lines like "#TO4-WD-003CH 428PP11-11--"; Barvin-style may not
    const hasTaskOrderCodes = rawText?.match(/#TO\d+[^#]*\d{2,3}(?:CH|CU|PP|QC|TS)\d+/);
    if (rawText && !hasTaskOrderCodes && documentAst?.items?.length && documentAst.items.some((i) => /^CH,\s*\d+/.test(i.label ?? ''))) {
      console.log('[PDF Parse] ⚠️ No raw task-order codes (e.g. #TO4-WD-003CH 428PP11-11--) in extracted text – PDF layout differs from Cedric-style. Parser only found CH labels.');
    }
    console.log('[PDF Parse] All extracted fields (order matters for mapping):');
    parseResult.fields.forEach((f: { value?: string; source?: string; field_type?: string }, i: number) => {
      const val = (f.value ?? '').slice(0, 70);
      console.log(`  ${i + 1}. [${f.source ?? '?'}] ${f.field_type ?? '—'} | ${val}`);
    });
    console.log('========== [PDF Parse] End ==========\n');

    type ParsedField = { field_type?: string; value?: string; text?: string; confidence?: number; source?: string; position?: unknown; original_line?: string; table_data?: unknown };
    const extractedFields = parseResult.fields.map((field: ParsedField, index: number) => ({
      key: field.field_type ? `field_${field.field_type}_${index}` : `field_${index + 1}`,
      value: field.value || field.text || '',
      confidence: field.confidence || 0.5,
      source: (field.source || 'layout') as ExtractedField['source'],
      position: field.position,
      fieldType: field.field_type,
      originalLine: field.original_line,
      tableData: field.table_data,
    })) as ExtractedField[];

    let invoiceData: Partial<CreateInvoiceInput> = {};
    const doc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean })
        ? user
        : null;
    const orgMappings = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const mapping = resolveMappingConfig(mappingName, orgMappings);
    if (documentAst && mapping && Object.keys(mapping).length > 0) {
      const descCount = mapping.lineItemDescriptions ? Object.keys(mapping.lineItemDescriptions).length : 0;
      const priceCount = mapping.lineItemPrices ? Object.keys(mapping.lineItemPrices).length : 0;
      console.log('[PDF Parse] Applied mapping:', mappingName ?? 'default', '| lineItemDescriptions:', descCount, '| lineItemPrices:', priceCount);
      if (descCount > 0) {
        console.log('[PDF Parse] lineItemDescriptions sample keys:', Object.keys(mapping.lineItemDescriptions!).slice(0, 3));
      }
      invoiceData = applyPdfMapping(documentAst, mapping);
      console.log('[PDF Parse] Mapped result (invoiceData):', JSON.stringify(invoiceData, null, 2));
    } else if (!mapping) {
      console.log('[PDF Parse] No mapping applied (no org mapping or empty config)');
    }

    const draftStatus: 'ready' | 'mapping' = Object.keys(invoiceData).length > 0 ? 'ready' : 'mapping';
    const draftInput: CreateInvoiceDraftInput = {
      userId: user._id!,
      organizationId: user.organizationId,
      extractedFields,
      status: draftStatus,
      // No sourcePdfId / sourcePdfUrl — PDF was never stored
    };

    const draftsCollection = db.collection('invoiceDrafts');
    const draftResult = await draftsCollection.insertOne({
      ...draftInput,
      invoiceData,
      documentAst: documentAst ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      data: {
        draftId: draftResult.insertedId.toString(),
        extractedFields,
        status: draftStatus,
      },
    };
  } catch (error) {
    console.error('Error in uploadAndParsePdf:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse PDF',
    };
  }
}

/**
 * Create an invoice draft from a ClickUp Doc Page (v3).
 * This reuses the SAME parser + mapping pipeline as PDFs (DocumentAST → applyPdfMapping),
 * then opens Create Invoice via `fromPdfDraft=...` (no format changes).
 */
export async function createInvoiceDraftFromClickUpPage(input: {
  workspaceId: string;
  docId: string;
  pageId: string;
  mappingName?: string | null;
}): Promise<{
  success: boolean;
  data?: { draftId: string; status: 'ready' | 'mapping' };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const workspaceId = (input.workspaceId ?? '').trim();
    const docId = (input.docId ?? '').trim();
    const pageId = (input.pageId ?? '').trim();
    if (!workspaceId || !docId || !pageId) {
      return { success: false, error: 'workspaceId, docId, and pageId are required' };
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) return { success: false, error: 'User not found' };
    const isAdmin = (session.user as { adminTag?: boolean }).adminTag === true;

    // Get ClickUp connection token
    let connection = null;
    if (user.organizationId) {
      connection = await db.collection('integration_connections').findOne({
        organizationId: user.organizationId,
        provider: 'clickup',
      });
    } else if (isAdmin && user?._id) {
      connection = await db.collection('integration_connections').findOne({
        userId: user._id.toString(),
        provider: 'clickup',
      });
    }
    const accessToken = connection?.accessToken as string | undefined;
    if (!accessToken) {
      return { success: false, error: 'Not connected to ClickUp' };
    }

    // Fetch page content (v3)
    const pageRes = await fetch(
      `https://api.clickup.com/api/v3/workspaces/${encodeURIComponent(
        workspaceId
      )}/docs/${encodeURIComponent(docId)}/pages/${encodeURIComponent(pageId)}`,
      { headers: { Authorization: accessToken } }
    );
    const pageRaw = await pageRes.text();
    console.log('[ClickUp→Invoice] GET page status:', pageRes.status, 'raw (first 300):', pageRaw.slice(0, 300));
    if (!pageRes.ok) {
      return { success: false, error: `Failed to fetch ClickUp page (${pageRes.status})` };
    }
    let pagePayload: unknown = pageRaw;
    try {
      pagePayload = JSON.parse(pageRaw);
    } catch {
      /* keep as string */
    }

    const text = extractTextFromClickUpPagePayload(pagePayload);
    if (!text.trim()) {
      return { success: false, error: 'ClickUp page content was empty after extraction' };
    }

    // Parse plain text using same AST builder as PDFs
    const parseResult = parsePdfText(text, 1);
    if (!parseResult.success || !('fields' in parseResult)) {
      return { success: false, error: parseResult.error ?? 'Failed to parse ClickUp page text' };
    }

    const documentAst = parseResult.document_ast as DocumentAST;

    // Convert fields to extractedFields (same as PDF flow)
    type ParsedField = {
      field_type?: string;
      value?: string;
      text?: string;
      confidence?: number;
      source?: string;
      position?: unknown;
      original_line?: string;
      table_data?: unknown;
    };
    const extractedFields = parseResult.fields.map((field: ParsedField, index: number) => ({
      key: field.field_type ? `field_${field.field_type}_${index}` : `field_${index + 1}`,
      value: field.value || field.text || '',
      confidence: field.confidence || 0.5,
      source: (field.source || 'layout') as ExtractedField['source'],
      position: field.position,
      fieldType: field.field_type,
      originalLine: field.original_line,
      tableData: field.table_data as ExtractedField['tableData'],
    })) as ExtractedField[];

    // Resolve mapping config (same as PDF flow)
    const orgOrUserDoc =
      user.organizationId
        ? await db.collection('organizations').findOne({ _id: user.organizationId })
        : isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean })
          ? user
          : null;
    const mappings = orgOrUserDoc ? getMappingsList(orgOrUserDoc as Record<string, unknown>) : [];
    const mapping = resolveMappingConfig(input.mappingName ?? null, mappings);

    let invoiceData: Partial<CreateInvoiceInput> = {};
    if (mapping && Object.keys(mapping).length > 0) {
      invoiceData = applyPdfMapping(documentAst, mapping);
      console.log('[ClickUp→Invoice] Applied mapping:', input.mappingName ?? 'default', 'invoiceData keys:', Object.keys(invoiceData));
    } else {
      console.log('[ClickUp→Invoice] No mapping applied (missing/empty config)');
    }

    const status: 'ready' | 'mapping' = Object.keys(invoiceData).length > 0 ? 'ready' : 'mapping';

    const draftInput: CreateInvoiceDraftInput = {
      userId: user._id!,
      organizationId: user.organizationId,
      extractedFields,
      status,
    };

    const draftsCollection = db.collection('invoiceDrafts');
    const draftResult = await draftsCollection.insertOne({
      ...draftInput,
      invoiceData,
      documentAst: documentAst ?? null,
      extractionMetadata: {
        extractionMethod: 'clickup_doc_page',
        extractionTime: Date.now(),
        aiUsed: false,
      },
      sourceClickUp: { workspaceId, docId, pageId },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      data: { draftId: draftResult.insertedId.toString(), status },
    };
  } catch (error) {
    console.error('createInvoiceDraftFromClickUpPage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create draft from ClickUp' };
  }
}

/** Upload MULTIPLE PDFs of the same format and combine into a single draft invoice (one invoice, many PDFs). */
export async function uploadAndParseMultiplePdfs(formData: FormData, mappingName?: string | null): Promise<{
  success: boolean;
  data?: { draftId: string; status: 'ready' };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return { success: false, error: 'No files provided' };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB per file
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        return { success: false, error: 'Only PDF files are allowed' };
      }
      if (file.size > maxSize) {
        return { success: false, error: 'Each file must be less than 10MB' };
      }
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const orgOrUserDoc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean })
        ? user
        : null;
    const mappings = orgOrUserDoc ? getMappingsList(orgOrUserDoc as Record<string, unknown>) : [];
    const mapping = resolveMappingConfig(mappingName, mappings);

    let combinedInvoice: Partial<CreateInvoiceInput> = {};
    const allExtractedFields: ExtractedField[] = [];
    const allDocumentAsts: DocumentAST[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(bytes);
      const parseResult = await parsePdfBuffer(pdfBuffer);
      if (!parseResult.success || !('fields' in parseResult)) {
        return { success: false, error: parseResult.error ?? `Failed to parse PDF: ${file.name}` };
      }

      const documentAst = parseResult.document_ast as DocumentAST;
      allDocumentAsts.push(documentAst);

      type ParsedField = { field_type?: string; value?: string; text?: string; confidence?: number; source?: string; position?: unknown; original_line?: string; table_data?: unknown };
      const extractedFields = parseResult.fields.map((field: ParsedField, index: number) => ({
        key: field.field_type ? `field_${field.field_type}_${index}` : `field_${index + 1}`,
        value: field.value || field.text || '',
        confidence: field.confidence || 0.5,
        source: (field.source || 'layout') as ExtractedField['source'],
        position: field.position,
        fieldType: field.field_type,
        originalLine: field.original_line,
        tableData: field.table_data,
      })) as ExtractedField[];
      allExtractedFields.push(...extractedFields);

      if (mapping) {
        const partial = applyPdfMapping(documentAst, mapping);
        // First file wins for header fields; always append items.
        if (!Object.keys(combinedInvoice).length) {
          combinedInvoice = { ...partial };
        } else {
          const existingItems = combinedInvoice.items ?? [];
          const newItems = partial.items ?? [];
          combinedInvoice.items = [...existingItems, ...newItems];
          // Recalculate subtotal/total from combined items
          if (combinedInvoice.items.length) {
            const subtotal = combinedInvoice.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
            combinedInvoice.subtotal = subtotal;
            if (!combinedInvoice.totalAmount || combinedInvoice.totalAmount === 0) {
              combinedInvoice.totalAmount = subtotal;
            }
          }
        }
      }
    }

    const draftsCollection = db.collection('invoiceDrafts');
    const draftResult = await draftsCollection.insertOne({
      userId: user._id!,
      organizationId: user.organizationId,
      extractedFields: allExtractedFields,
      status: 'ready',
      invoiceData: combinedInvoice,
      // For documentAst, just keep the first one as representative (structure is the same)
      documentAst: allDocumentAsts[0] ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      data: {
        draftId: draftResult.insertedId.toString(),
        status: 'ready',
      },
    };
  } catch (error) {
    console.error('Error in uploadAndParseMultiplePdfs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse PDFs',
    };
  }
}

// Get invoice draft
export async function getInvoiceDraft(draftId: string): Promise<{
  success: boolean;
  data?: InvoiceDraft;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const draftsCollection = db.collection('invoiceDrafts');
    const draft = await draftsCollection.findOne({
      _id: new ObjectId(draftId),
      userId: user._id!,
    });

    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    return {
      success: true,
      data: serializeDraft(draft as Record<string, unknown>),
    };
  } catch (error) {
    console.error('Error getting draft:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get draft',
    };
  }
}

/** Admin bypass: caspianodhis@gmail.com with adminTag can use PDF mapping without an org (stored on user). */
const ADMIN_PDF_MAPPING_BYPASS_EMAIL = 'caspianodhis@gmail.com';

function isAdminPdfMappingBypass(user: { email?: string; adminTag?: boolean }): boolean {
  return (user.email === ADMIN_PDF_MAPPING_BYPASS_EMAIL && user.adminTag === true) || user.adminTag === true;
}

/** Get list of named mappings from org or user doc (with legacy single mapping migration). */
function getMappingsList(doc: Record<string, unknown>): PdfMappingEntry[] {
  const list = (doc.pdfInvoiceMappings as PdfMappingEntry[] | undefined) ?? [];
  if (list.length > 0) return list.map((e) => ({ ...e, config: JSON.parse(JSON.stringify(e.config)) as OrgPdfMappingConfig }));
  const legacy = doc.pdfInvoiceMapping as OrgPdfMappingConfig | undefined;
  if (legacy && typeof legacy === 'object') {
    return [{ name: 'Default', config: JSON.parse(JSON.stringify(legacy)) as OrgPdfMappingConfig, isDefault: true }];
  }
  return [];
}

/** Resolve which config to use: by name or default. */
function resolveConfig(mappings: PdfMappingEntry[], mappingName?: string | null): OrgPdfMappingConfig | undefined {
  if (!mappings.length) return undefined;
  if (mappingName) {
    const entry = mappings.find((e) => e.name === mappingName);
    return entry?.config;
  }
  const defaultEntry = mappings.find((e) => e.isDefault) ?? mappings[0];
  return defaultEntry?.config;
}

/** Resolve mapping: org mappings first, merge preset lineItemDescriptions/lineItemPrices when org has none. */
function resolveMappingConfig(
  mappingName: string | null | undefined,
  orgMappings: PdfMappingEntry[]
): OrgPdfMappingConfig | undefined {
  if (mappingName) {
    const orgEntry = orgMappings.find((e) => e.name === mappingName);
    const preset = getPresetByName(mappingName);
    if (orgEntry?.config) {
      if (preset?.config) {
        const org = orgEntry.config;
        const pre = preset.config;
        const hasOrgDesc = org.lineItemDescriptions && Object.keys(org.lineItemDescriptions).length > 0;
        return {
          ...org,
          lineItemDescriptions: hasOrgDesc ? org.lineItemDescriptions : pre.lineItemDescriptions ?? org.lineItemDescriptions,
          lineItemPrices: org.lineItemPrices ?? pre.lineItemPrices ?? org.lineItemPrices,
        };
      }
      return orgEntry.config;
    }
    if (preset) return preset.config;
    return resolveConfig(orgMappings, mappingName);
  }
  const defaultEntry = orgMappings.find((e) => e.isDefault) ?? orgMappings[0];
  return defaultEntry?.config;
}

// Get org PDF mappings list (for config page and upload dropdown)
export async function getOrgPdfMapping(): Promise<{
  success: boolean;
  data?: {
    mappings: PdfMappingEntry[];
    defaultName: string | null;
    assignedPresetIds?: string[];
    isAdmin?: boolean;
  };
  hasOrganization?: boolean;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    const adminBypass = isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean });
    if (!user.organizationId && !adminBypass) {
      return { success: true, data: { mappings: [], defaultName: null, isAdmin: adminBypass }, hasOrganization: false };
    }
    const doc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : user;
    const mappings = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const defaultName = mappings.find((e) => e.isDefault)?.name ?? (mappings[0]?.name ?? null);
    const assignedPresetIds = (doc as { pdfFormatPresets?: string[] })?.pdfFormatPresets as string[] | undefined;
    const rawList = (doc as Record<string, unknown>)?.pdfInvoiceMappings;
    console.log('[PDF Mappings] For', session.user.email, '| Source:', user.organizationId ? 'organization' : 'user (admin bypass)', '| Count:', mappings.length, '| All:', mappings.map((m) => m.name + (m.isDefault ? ' (default)' : '')).join(', ') || 'none', '| Raw array length:', Array.isArray(rawList) ? rawList.length : 'n/a');
    const canUsePdfMapping = Boolean(user.organizationId || adminBypass);
    return {
      success: true,
      data: {
        mappings,
        defaultName,
        assignedPresetIds: Array.isArray(assignedPresetIds) ? assignedPresetIds : undefined,
        isAdmin: adminBypass,
      },
      hasOrganization: canUsePdfMapping,
    };
  } catch (error) {
    console.error('Error getting org PDF mapping:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get mapping',
    };
  }
}

/** Option for format dropdown: preset (built-in) or custom org mapping. */
export type PdfFormatOption = { name: string; isPreset: boolean; description?: string; presetId?: string };

/** List of format options: built-in presets first, then org mappings. Org-specific: only shows presets assigned to that org. */
export async function getOrgPdfMappingList(): Promise<{
  success: boolean;
  data?: { options: PdfFormatOption[]; defaultName: string | null };
  error?: string;
}> {
  const result = await getOrgPdfMapping();
  if (!result.success || !result.data) {
    return { success: result.success, data: result.data as undefined, error: result.error };
  }
  const assignedIds = result.data.assignedPresetIds;
  const isAdmin = result.data.isAdmin === true;
  const allPresets = (PDF_FORMAT_PRESETS ?? []).map((p) => ({
    name: p.name,
    isPreset: true,
    description: p.description,
    presetId: p.id,
  }));
  const presetOptions: PdfFormatOption[] =
    isAdmin || assignedIds == null || assignedIds.length === 0
      ? allPresets
      : allPresets.filter((p) => p.presetId && assignedIds.includes(p.presetId));
  const customOptions: PdfFormatOption[] = (result.data.mappings ?? []).map((e) => ({
    name: e.name,
    isPreset: false,
  }));
  const options = [...presetOptions, ...customOptions];
  console.log('[PDF Mapping List] Custom count:', customOptions.length, '| Custom names:', customOptions.map((o) => o.name).join(', '), '| Total options:', options.length);
  const defaultName =
    result.data.defaultName ??
    (customOptions.length ? customOptions[0]?.name : presetOptions[0]?.name) ??
    null;
  return {
    success: true,
    data: { options, defaultName },
  };
}

// Save org PDF mapping with a name (add or update). existingName = which entry to update (for rename/edit).
export async function saveOrgPdfMapping(
  name: string,
  mapping: OrgPdfMappingConfig,
  setAsDefault?: boolean,
  existingName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: 'Mapping name is required' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    const adminBypass = isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean });
    if (!user.organizationId && !adminBypass) {
      return { success: false, error: 'Organization required to save PDF mapping' };
    }
    const plain = JSON.parse(JSON.stringify(mapping)) as OrgPdfMappingConfig;
    const collection = user.organizationId ? db.collection('organizations') : usersCollection;
    const targetId = user.organizationId ?? user._id;
    const doc = await collection.findOne({ _id: targetId });
    const list = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const updateIndex = existingName != null ? list.findIndex((e) => e.name === existingName) : -1;
    const existingIndex = updateIndex >= 0 ? updateIndex : list.findIndex((e) => e.name === trimmedName);
    let next: PdfMappingEntry[] = [];
    if (existingIndex >= 0) {
      // Update existing (same name or rename)
      next = list.map((e, i) =>
        i === existingIndex
          ? { name: trimmedName, config: plain, isDefault: setAsDefault ?? e.isDefault }
          : { ...e, isDefault: setAsDefault === true ? false : e.isDefault }
      );
    } else {
      const isFirst = list.length === 0;
      next = [
        ...list.map((e) => ({ ...e, isDefault: setAsDefault === true ? false : e.isDefault })),
        { name: trimmedName, config: plain, isDefault: setAsDefault ?? isFirst },
      ];
    }
    if (setAsDefault && next.every((e) => !e.isDefault)) {
      const idx = next.findIndex((e) => e.name === trimmedName);
      if (idx >= 0) next[idx] = { ...next[idx], isDefault: true };
    }
    await collection.updateOne(
      { _id: targetId },
      { $set: { pdfInvoiceMappings: next, updatedAt: new Date() }, $unset: { pdfInvoiceMapping: '' } }
    );
    return { success: true };
  } catch (error) {
    console.error('Error saving org PDF mapping:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save mapping',
    };
  }
}

/**
 * Admin only: Get PDF mappings for an organization by ID.
 */
export async function getOrgPdfMappingsForAdmin(organizationId: string): Promise<{
  success: boolean;
  data?: { mappings: Array<{ name: string; isDefault?: boolean }> };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { success: false, error: 'Unauthorized' };
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user || !(user as { adminTag?: boolean }).adminTag) {
      return { success: false, error: 'Admin access required' };
    }
    const org = await db.collection('organizations').findOne({ _id: new ObjectId(organizationId) });
    if (!org) return { success: false, error: 'Organization not found' };
    const mappings = getMappingsList((org as Record<string, unknown>) ?? {});
    return {
      success: true,
      data: {
        mappings: mappings.map((m) => ({ name: m.name, isDefault: m.isDefault })),
      },
    };
  } catch (error) {
    console.error('getOrgPdfMappingsForAdmin:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch' };
  }
}

/**
 * Admin only: Copy the current user's PDF mappings (e.g. "script") to an organization.
 * Use when your custom mappings are on your user account (admin bypass) and you want
 * org members to inherit them.
 */
export async function copyMyPdfMappingsToOrganization(organizationId: string): Promise<{
  success: boolean;
  data?: { copied: number };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    if (!(user as { adminTag?: boolean }).adminTag) {
      return { success: false, error: 'Admin access required' };
    }
    const targetOrgId = new ObjectId(organizationId);
    const org = await db.collection('organizations').findOne({ _id: targetOrgId });
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }
    const sourceDoc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : user;
    const myMappings = sourceDoc ? getMappingsList(sourceDoc as Record<string, unknown>) : [];
    if (myMappings.length === 0) {
      return { success: false, error: 'You have no custom PDF mappings to copy. Create one in Smart Invoicing → Config first.' };
    }
    const orgMappings = getMappingsList((org as Record<string, unknown>) ?? {});
    const merged = [...orgMappings];
    for (const m of myMappings) {
      const idx = merged.findIndex((e) => e.name === m.name);
      if (idx >= 0) merged[idx] = m;
      else merged.push(m);
    }
    await db.collection('organizations').updateOne(
      { _id: targetOrgId },
      { $set: { pdfInvoiceMappings: merged, updatedAt: new Date() }, $unset: { pdfInvoiceMapping: '' } }
    );
    return { success: true, data: { copied: myMappings.length } };
  } catch (error) {
    console.error('Copy PDF mappings to org:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy mappings',
    };
  }
}

/** Set a mapping as the default (no config changes). */
export async function setOrgPdfMappingDefault(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    const adminBypass = isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean });
    if (!user.organizationId && !adminBypass) {
      return { success: false, error: 'Organization required' };
    }
    const collection = user.organizationId ? db.collection('organizations') : usersCollection;
    const targetId = user.organizationId ?? user._id;
    const doc = await collection.findOne({ _id: targetId });
    const list = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const idx = list.findIndex((e) => e.name === name);
    if (idx < 0) {
      return { success: false, error: 'Mapping not found' };
    }
    const next = list.map((e, i) => ({ ...e, isDefault: i === idx }));
    await collection.updateOne(
      { _id: targetId },
      { $set: { pdfInvoiceMappings: next, updatedAt: new Date() }, $unset: { pdfInvoiceMapping: '' } }
    );
    return { success: true };
  } catch (error) {
    console.error('Error setting PDF mapping default:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set default',
    };
  }
}

// Delete a named PDF mapping
export async function deleteOrgPdfMapping(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    const adminBypass = isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean });
    if (!user.organizationId && !adminBypass) {
      return { success: false, error: 'Organization required' };
    }
    const collection = user.organizationId ? db.collection('organizations') : usersCollection;
    const targetId = user.organizationId ?? user._id;
    const doc = await collection.findOne({ _id: targetId });
    const list = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const filtered = list.filter((e) => e.name !== name);
    if (filtered.length === list.length) {
      return { success: false, error: 'Mapping not found' };
    }
    const wasDefault = list.find((e) => e.name === name)?.isDefault;
    if (wasDefault && filtered.length > 0 && !filtered.some((e) => e.isDefault)) {
      filtered[0] = { ...filtered[0], isDefault: true };
    }
    await collection.updateOne(
      { _id: targetId },
      { $set: { pdfInvoiceMappings: filtered, updatedAt: new Date() }, $unset: { pdfInvoiceMapping: '' } }
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting PDF mapping:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete mapping',
    };
  }
}

/** Admin only: assign which PDF format presets an organization can use. */
export async function assignPdfFormatsToOrg(
  organizationId: string,
  presetIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user || !(user as { adminTag?: boolean }).adminTag) {
      return { success: false, error: 'Admin access required' };
    }
    const validIds = (PDF_FORMAT_PRESETS ?? []).map((p) => p.id);
    const filtered = presetIds.filter((id) => validIds.includes(id));
    const orgId = new ObjectId(organizationId);
    const org = await db.collection('organizations').findOne({ _id: orgId });
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }
    await db.collection('organizations').updateOne(
      { _id: orgId },
      { $set: { pdfFormatPresets: filtered, updatedAt: new Date() } }
    );
    return { success: true };
  } catch (error) {
    console.error('Error assigning PDF formats to org:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign formats',
    };
  }
}

/** Admin only: search orgs by partial email or org name. Fetches as you type. */
export async function searchOrganizationsForAdmin(query: string): Promise<{
  success: boolean;
  data?: Array<{
    organizationId: string;
    organizationName?: string;
    sampleMemberEmail?: string;
    assignedPresetIds?: string[];
  }>;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const adminUser = await db.collection('users').findOne({ email: session.user.email });
    if (!adminUser || !(adminUser as { adminTag?: boolean }).adminTag) {
      return { success: false, error: 'Admin access required' };
    }
    const q = (query ?? '').trim();
    if (q.length < 1) {
      return { success: true, data: [] };
    }
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const seenIds = new Set<string>();
    const results: Array<{
      organizationId: string;
      organizationName?: string;
      sampleMemberEmail?: string;
      assignedPresetIds?: string[];
    }> = [];

    const users = await db
      .collection('users')
      .find({ email: regex, organizationId: { $exists: true, $ne: null } })
      .limit(15)
      .toArray();

    for (const u of users) {
      const orgId = (u.organizationId as { toString?: () => string })?.toString?.() ?? String(u.organizationId);
      if (seenIds.has(orgId)) continue;
      seenIds.add(orgId);
      const org = await db.collection('organizations').findOne({ _id: u.organizationId });
      const assignedPresetIds = (org as { pdfFormatPresets?: string[] })?.pdfFormatPresets;
      results.push({
        organizationId: orgId,
        organizationName: (org as { name?: string })?.name,
        sampleMemberEmail: u.email as string,
        assignedPresetIds: Array.isArray(assignedPresetIds) ? assignedPresetIds : [],
      });
    }

    const orgsByName = await db
      .collection('organizations')
      .find({ name: regex })
      .limit(10)
      .toArray();

    for (const org of orgsByName) {
      const orgId = (org._id as { toString?: () => string })?.toString?.() ?? String(org._id);
      if (seenIds.has(orgId)) continue;
      seenIds.add(orgId);
      const assignedPresetIds = (org as { pdfFormatPresets?: string[] }).pdfFormatPresets;
      const member = await db.collection('users').findOne({ organizationId: org._id }, { projection: { email: 1 } });
      results.push({
        organizationId: orgId,
        organizationName: (org as { name?: string }).name,
        sampleMemberEmail: member?.email as string | undefined,
        assignedPresetIds: Array.isArray(assignedPresetIds) ? assignedPresetIds : [],
      });
    }

    return { success: true, data: results.slice(0, 10) };
  } catch (error) {
    console.error('Error searching organizations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search',
    };
  }
}

/** Admin only: get org by email (finds user then their org). */
export async function getOrgByUserEmail(userEmail: string): Promise<{
  success: boolean;
  data?: { organizationId: string; organizationName?: string; assignedPresetIds?: string[] };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const db = await connectToDatabase();
    const adminUser = await db.collection('users').findOne({ email: session.user.email });
    if (!adminUser || !(adminUser as { adminTag?: boolean }).adminTag) {
      return { success: false, error: 'Admin access required' };
    }
    const targetUser = await db.collection('users').findOne({ email: userEmail.trim().toLowerCase() });
    if (!targetUser?.organizationId) {
      return { success: false, error: 'User not found or has no organization' };
    }
    const org = await db.collection('organizations').findOne({ _id: targetUser.organizationId });
    const assignedPresetIds = (org as { pdfFormatPresets?: string[] })?.pdfFormatPresets;
    return {
      success: true,
      data: {
        organizationId: targetUser.organizationId.toString(),
        organizationName: (org as { name?: string })?.name,
        assignedPresetIds: Array.isArray(assignedPresetIds) ? assignedPresetIds : [],
      },
    };
  } catch (error) {
    console.error('Error getting org by email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get organization',
    };
  }
}

/** Parse a sample PDF and return document_ast only (no draft saved). For org mapping config preview. */
export async function parsePdfForPreview(formData: FormData): Promise<{
  success: boolean;
  data?: {
    document_ast: DocumentAST;
    stats: { total_fields: number; itemsCount: number };
    previewFields: Array<{
      index: number;
      value: string;
      source: string;
      fieldType?: string;
      originalLine?: string;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }
    const file = formData.get('file') as File;
    if (!file || file.type !== 'application/pdf') {
      return { success: false, error: 'Please provide a PDF file' };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parsePdfBuffer(buffer);
    if (!parseResult.success || !('document_ast' in parseResult)) {
      return { success: false, error: parseResult.error ?? 'Failed to parse PDF' };
    }

    const previewFields =
      'fields' in parseResult && Array.isArray(parseResult.fields)
        ? (parseResult.fields.slice(0, 40).map((f, index) => ({
            index: index + 1,
            value: String((f as { value?: string }).value ?? '').slice(0, 140),
            source: String((f as { source?: string }).source ?? ''),
            fieldType: (f as { field_type?: string }).field_type,
            originalLine: (f as { original_line?: string }).original_line,
          })) as Array<{
            index: number;
            value: string;
            source: string;
            fieldType?: string;
            originalLine?: string;
          }>)
        : [];

    // DEBUG: Log uploaded PDF parse data for config page debugging
    console.log('\n========== [PDF Config Preview] Uploaded PDF parse data ==========');
    console.log('[PDF Config Preview] File name:', file.name, '| Size:', file.size, 'bytes');
    console.log('[PDF Config Preview] Stats:', JSON.stringify(parseResult.stats, null, 2));
    console.log('[PDF Config Preview] Raw fields count:', 'fields' in parseResult ? parseResult.fields.length : 0);
    console.log('[PDF Config Preview] Raw fields (full):', JSON.stringify('fields' in parseResult ? parseResult.fields : [], null, 2));
    console.log('[PDF Config Preview] Document AST:', JSON.stringify(parseResult.document_ast, null, 2));
    console.log('[PDF Config Preview] PreviewFields (first 40):', JSON.stringify(previewFields, null, 2));
    console.log('========== [PDF Config Preview] End ==========\n');

    return {
      success: true,
      data: {
        document_ast: parseResult.document_ast,
        stats: {
          total_fields: parseResult.stats.total_fields,
          itemsCount: parseResult.document_ast.items?.length ?? 0,
        },
        previewFields,
      },
    };
  } catch (error) {
    console.error('Error parsing PDF for preview:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse PDF',
    };
  }
}

// List all drafts for user
export async function listInvoiceDrafts(): Promise<{
  success: boolean;
  data?: InvoiceDraft[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const draftsCollection = db.collection('invoiceDrafts');
    const drafts = await draftsCollection
      .find({
        userId: user._id!,
        status: { $ne: 'converted' }, // Don't show converted drafts
      })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      success: true,
      data: drafts.map((d) => serializeDraft(d as Record<string, unknown>)),
    };
  } catch (error) {
    console.error('Error listing drafts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list drafts',
    };
  }
}

// Update draft field mappings
export async function updateDraftMappings(
  draftId: string,
  mappings: { [pdfFieldKey: string]: string }
): Promise<{
  success: boolean;
  data?: { draftId: string; invoiceData: Partial<CreateInvoiceInput> };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const draftsCollection = db.collection('invoiceDrafts');
    const draft = await draftsCollection.findOne({
      _id: new ObjectId(draftId),
      userId: user._id!,
    });

    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    // Build invoice data from mappings (start with existing draft data so we don't wipe org-prefilled items)
    const existingData = (draft.invoiceData || {}) as Partial<CreateInvoiceInput>;
    const invoiceData: Partial<CreateInvoiceInput> = { ...existingData };
    const extractedFields = (draft.extractedFields || []) as ExtractedField[];

    // Map extracted fields to invoice fields
    const lineItemFieldKeys: string[] = [];
    for (const [pdfFieldKey, invoiceField] of Object.entries(mappings)) {
      const field = extractedFields.find((f) => f.key === pdfFieldKey);
      if (field) {
        if (invoiceField === 'lineItem_add') {
          lineItemFieldKeys.push(pdfFieldKey);
          continue;
        }
        switch (invoiceField) {
          case 'invoiceNumber':
            invoiceData.invoiceNumber = field.value;
            break;
          case 'issueDate':
            invoiceData.issueDate = new Date(field.value);
            break;
          case 'dueDate':
            invoiceData.dueDate = new Date(field.value);
            break;
          case 'clientName':
            if (!invoiceData.clientDetails) {
              invoiceData.clientDetails = {} as unknown as ClientDetails;
            }
            (invoiceData.clientDetails as ClientDetails & { name?: string }).name = field.value;
            break;
          case 'clientEmail':
            if (!invoiceData.clientDetails) {
              invoiceData.clientDetails = {} as unknown as ClientDetails;
            }
            (invoiceData.clientDetails as ClientDetails).email = field.value;
            break;
          case 'total':
            invoiceData.totalAmount = parseFloat(field.value.replace(/[^0-9.-]/g, '')) || 0;
            break;
          case 'currency':
            invoiceData.currency = field.value;
            break;
          default:
            break;
        }
      }
    }

    // Build line items from fields mapped to "lineItem_add" (preserve order of extracted fields)
    if (lineItemFieldKeys.length > 0) {
      const items: { description: string; quantity: number; unitPrice: number; total: number; taxRate: number }[] = [];
      for (const key of lineItemFieldKeys) {
        const field = extractedFields.find((f) => f.key === key);
        if (!field) continue;
        const qty = field.tableData?.quantity != null
          ? Number(field.tableData.quantity)
          : field.tableData?.index != null
            ? Number(field.tableData.index)
            : 1;
        const quantity = !Number.isNaN(qty) && qty > 0 ? qty : 1;
        items.push({
          description: field.value || '',
          quantity,
          unitPrice: 0,
          total: 0,
          taxRate: 0,
        });
      }
      invoiceData.items = items;
    }

    // Update draft
    await draftsCollection.updateOne(
      { _id: new ObjectId(draftId) },
      {
        $set: {
          fieldMappings: mappings,
          invoiceData,
          status: 'ready',
          updatedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      data: {
        draftId,
        invoiceData,
      },
    };
  } catch (error) {
    console.error('Error updating draft mappings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update mappings',
    };
  }
}

// Convert draft to invoice
export async function convertDraftToInvoice(
  draftId: string,
  overrides?: Partial<CreateInvoiceInput>
): Promise<{
  success: boolean;
  data?: { invoiceId: string; invoiceNumber: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const draftsCollection = db.collection('invoiceDrafts');
    const draft = await draftsCollection.findOne({
      _id: new ObjectId(draftId),
      userId: user._id!,
    });

    if (!draft) {
      return { success: false, error: 'Draft not found' };
    }

    // Merge draft invoice data with overrides
    const invoiceData = {
      ...(draft.invoiceData || {}),
      ...overrides,
    } as CreateInvoiceInput;

    // Ensure required fields
    if (!invoiceData.invoiceNumber) {
      invoiceData.invoiceNumber = `INV-${Date.now()}`;
    }
    if (!invoiceData.issueDate) {
      invoiceData.issueDate = new Date();
    }
    if (!invoiceData.dueDate) {
      invoiceData.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    if (!invoiceData.currency) {
      invoiceData.currency = 'USD';
    }
    if (!invoiceData.items || invoiceData.items.length === 0) {
      invoiceData.items = [];
    }
    if (!invoiceData.taxes) {
      invoiceData.taxes = [];
    }
    if (!invoiceData.subtotal) {
      invoiceData.subtotal = 0;
    }
    if (!invoiceData.totalAmount) {
      invoiceData.totalAmount = 0;
    }

    // Ensure invoice number is unique (PDF may extract "Task" etc. - avoid E11000 duplicate key)
    const invoicesCollection = db.collection('invoices');
    const orgId = user.organizationId || user._id!;
    const existingWithNumber = await invoicesCollection.findOne({
      invoiceNumber: invoiceData.invoiceNumber,
      $or: [
        { organizationId: orgId },
        { issuerId: user._id }
      ]
    });
    if (existingWithNumber) {
      invoiceData.invoiceNumber = `INV-${Date.now()}`;
    }

    // Create invoice using existing invoice creation logic
    const invoiceResult = await invoicesCollection.insertOne({
      ...invoiceData,
      organizationId: user.organizationId || new ObjectId(),
      issuerId: user._id!,
      status: 'draft',
      type: 'regular',
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update draft status
    await draftsCollection.updateOne(
      { _id: new ObjectId(draftId) },
      {
        $set: {
          status: 'converted',
          updatedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      data: {
        invoiceId: invoiceResult.insertedId.toString(),
        invoiceNumber: invoiceData.invoiceNumber,
      },
    };
  } catch (error) {
    console.error('Error converting draft to invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert draft',
    };
  }
}
