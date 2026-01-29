'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { InvoiceDraft, CreateInvoiceDraftInput, ExtractedField } from '@/models/InvoiceDraft';
import { CreateInvoiceInput } from '@/models/Invoice';
import type { DocumentAST, OrgPdfMappingConfig, PdfMappingEntry } from '@/models/DocumentAST';
import { applyPdfMapping } from '@/lib/utils/pdfMappingEngine';
import { parsePdfBuffer } from '@/lib/services/pdfParser';

/** Serialize draft for Client Components (ObjectId/Date to plain values; documentAst as plain object for fromPdfDraft prefill). */
function serializeDraft(draft: Record<string, unknown>): InvoiceDraft {
  const toStr = (v: unknown) => (v && typeof (v as any).toString === 'function' ? (v as any).toString() : v);
  const toDate = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
  const plainInvoiceData = draft.invoiceData != null ? JSON.parse(JSON.stringify(draft.invoiceData)) : {};
  const plainDocumentAst = draft.documentAst != null ? JSON.parse(JSON.stringify(draft.documentAst)) : null;
  return {
    ...draft,
    _id: toStr(draft._id) as any,
    userId: toStr(draft.userId) as any,
    organizationId: draft.organizationId != null ? toStr(draft.organizationId) as any : undefined,
    sourcePdfId: toStr(draft.sourcePdfId) as any,
    createdAt: toDate(draft.createdAt) as any,
    updatedAt: toDate(draft.updatedAt) as any,
    extractedFields: Array.isArray(draft.extractedFields) ? draft.extractedFields : [],
    invoiceData: plainInvoiceData,
    documentAst: plainDocumentAst,
  } as InvoiceDraft;
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

    const { fields, document_ast, stats } = parseResult;
    const documentAst = document_ast as DocumentAST | undefined;

    // ——— Log parsed output so you can align mapping ———
    console.log('\n========== [PDF Parse] Uploaded file:', file.name, '==========');
    if (stats) console.log('[PDF Parse] Stats:', JSON.stringify(stats, null, 2));
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
    console.log('[PDF Parse] All extracted fields (order matters for mapping):');
    parseResult.fields.forEach((f: { value?: string; source?: string; field_type?: string }, i: number) => {
      const val = (f.value ?? '').slice(0, 70);
      console.log(`  ${i + 1}. [${f.source ?? '?'}] ${f.field_type ?? '—'} | ${val}`);
    });
    console.log('========== [PDF Parse] End ==========\n');

    const extractedFields: ExtractedField[] = parseResult.fields.map((field: any, index: number) => ({
      key: field.field_type ? `field_${field.field_type}_${index}` : `field_${index + 1}`,
      value: field.value || field.text || '',
      confidence: field.confidence || 0.5,
      source: field.source || 'layout',
      position: field.position,
      fieldType: field.field_type,
      originalLine: field.original_line,
      tableData: field.table_data,
    }));

    let invoiceData: Partial<CreateInvoiceInput> = {};
    const doc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : isAdminPdfMappingBypass(user as { email?: string; adminTag?: boolean })
        ? user
        : null;
    if (doc) {
      const mapping = resolveConfig(getMappingsList(doc as Record<string, unknown>), mappingName);
      if (documentAst && mapping && Object.keys(mapping).length > 0) {
        invoiceData = applyPdfMapping(documentAst, mapping);
        console.log('[PDF Parse] Applied mapping:', mappingName ?? 'default');
        console.log('[PDF Parse] Mapped result (invoiceData):', JSON.stringify(invoiceData, null, 2));
      } else {
        console.log('[PDF Parse] No mapping applied (no org mapping or empty config)');
      }
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

// Get org PDF mappings list (for config page and upload dropdown)
export async function getOrgPdfMapping(): Promise<{
  success: boolean;
  data?: { mappings: PdfMappingEntry[]; defaultName: string | null };
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
      return { success: true, data: { mappings: [], defaultName: null }, hasOrganization: false };
    }
    const doc = user.organizationId
      ? await db.collection('organizations').findOne({ _id: user.organizationId })
      : user;
    const mappings = doc ? getMappingsList(doc as Record<string, unknown>) : [];
    const defaultName = mappings.find((e) => e.isDefault)?.name ?? (mappings[0]?.name ?? null);
    // hasOrganization/canUsePdfMapping: true if org user OR admin bypass (so config page shows form)
    const canUsePdfMapping = Boolean(user.organizationId || adminBypass);
    return { success: true, data: { mappings, defaultName }, hasOrganization: canUsePdfMapping };
  } catch (error) {
    console.error('Error getting org PDF mapping:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get mapping',
    };
  }
}

/** Lightweight list of mapping names + default (for upload page dropdown). */
export async function getOrgPdfMappingList(): Promise<{
  success: boolean;
  data?: { names: string[]; defaultName: string | null };
  error?: string;
}> {
  const result = await getOrgPdfMapping();
  if (!result.success || !result.data) {
    return { success: result.success, data: result.data as undefined, error: result.error };
  }
  return {
    success: true,
    data: {
      names: result.data.mappings.map((e) => e.name),
      defaultName: result.data.defaultName,
    },
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

/** Parse a sample PDF and return document_ast only (no draft saved). For org mapping config preview. */
export async function parsePdfForPreview(formData: FormData): Promise<{
  success: boolean;
  data?: { document_ast: DocumentAST; stats: { total_fields: number; itemsCount: number } };
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
    return {
      success: true,
      data: {
        document_ast: parseResult.document_ast,
        stats: {
          total_fields: parseResult.stats.total_fields,
          itemsCount: parseResult.document_ast.items?.length ?? 0,
        },
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
              invoiceData.clientDetails = {} as any;
            }
            (invoiceData.clientDetails as any).name = field.value;
            break;
          case 'clientEmail':
            if (!invoiceData.clientDetails) {
              invoiceData.clientDetails = {} as any;
            }
            (invoiceData.clientDetails as any).email = field.value;
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
