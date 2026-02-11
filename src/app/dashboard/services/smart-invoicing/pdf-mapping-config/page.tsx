'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOrgPdfMapping, saveOrgPdfMapping, deleteOrgPdfMapping, parsePdfForPreview } from '@/lib/actions/pdf-invoice';
import type { OrgPdfMappingConfig, DocumentAST, PdfMappingEntry } from '@/models/DocumentAST';
import { PDF_AST_PATH_OPTIONS, INVOICE_FIELD_KEYS, INVOICE_FIELD_LABELS, ITEM_FIELD_PATH_OPTIONS } from '@/data/pdfAstPaths';
import { PDF_FORMAT_PRESETS } from '@/data/pdfFormatPresets';
import { ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, Settings, Upload, FileText, Plus, Trash2 } from 'lucide-react';

const ADD_NEW_ID = '__new__';

export default function PdfMappingConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mappings, setMappings] = useState<PdfMappingEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>(ADD_NEW_ID);
  const [mappingName, setMappingName] = useState('');
  const [mapping, setMapping] = useState<OrgPdfMappingConfig>({});
  const [isDefault, setIsDefault] = useState(false);
  const [isOrgUser, setIsOrgUser] = useState(false);
  const [previewAst, setPreviewAst] = useState<DocumentAST | null>(null);
  const [previewFields, setPreviewFields] = useState<
    { index: number; value: string; source: string; fieldType?: string; originalLine?: string }[]
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Simple path reader so we can show non-technical “this is what will go into the invoice” previews
  const getPreviewValueForPath = (path?: string): string | null => {
    if (!previewAst || !path) return null;
    const parts = path.split('.');
    let current: unknown = previewAst;
    for (const key of parts) {
      if (current == null || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
    if (current == null) return null;
    if (Array.isArray(current)) {
      if (path === 'items') {
        const len = current.length;
        return len === 0 ? 'no line items found' : `${len} line item${len === 1 ? '' : 's'} detected`;
      }
      return `${current.length} value${current.length === 1 ? '' : 's'}`;
    }
    return String(current);
  };

  const loadMapping = useCallback(async (selectAfterLoad?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await getOrgPdfMapping();
      if (!result.success) {
        setError(result.error || 'Failed to load mappings');
        return;
      }
      const list = result.data?.mappings ?? [];
      const def = result.data?.defaultName ?? null;
      setMappings(list);
      setIsOrgUser(Boolean(result.hasOrganization));
      const effectiveId =
        selectAfterLoad && list.some((e) => e.name === selectAfterLoad)
          ? selectAfterLoad
          : list.length > 0
            ? (def ?? list[0].name)
            : ADD_NEW_ID;
      if (effectiveId === ADD_NEW_ID) {
        setSelectedId(ADD_NEW_ID);
        setMapping({});
        setMappingName('');
        setIsDefault(list.length === 0);
      } else {
        const entry = list.find((e) => e.name === effectiveId);
        if (entry) {
          setSelectedId(entry.name);
          setMapping(entry.config);
          setMappingName(entry.name);
          setIsDefault(Boolean(entry.isDefault));
        } else {
          setSelectedId(list.length > 0 ? list[0].name : ADD_NEW_ID);
          if (list.length > 0) {
            setMapping(list[0].config);
            setMappingName(list[0].name);
            setIsDefault(Boolean(list[0].isDefault));
          } else {
            setMapping({});
            setMappingName('');
            setIsDefault(true);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMapping();
  }, [loadMapping]);

  const selectMapping = (id: string) => {
    setSelectedId(id);
    if (id === ADD_NEW_ID) {
      setMapping({});
      setMappingName('');
      setIsDefault(mappings.length === 0);
    } else {
      const entry = mappings.find((e) => e.name === id);
      if (entry) {
        setMapping(entry.config);
        setMappingName(entry.name);
        setIsDefault(Boolean(entry.isDefault));
      }
    }
  };

  const handleFieldChange = (field: keyof OrgPdfMappingConfig, value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (value) {
        (next as Record<string, string>)[field] = value;
      } else {
        delete (next as Record<string, string>)[field];
      }
      return next;
    });
  };

  const handleLineItemMapChange = (field: 'description' | 'quantity' | 'unitPrice' | 'status', value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      next.lineItems = next.lineItems ?? { source: 'items', map: {} };
      next.lineItems!.map = next.lineItems!.map ?? {};
      if (value) {
        next.lineItems!.map![field] = value;
      } else {
        delete next.lineItems!.map![field];
      }
      return next;
    });
  };

  const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setPreviewError('Please select a PDF file');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewAst(null);
    setPreviewFields([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await parsePdfForPreview(formData);
      if (!result.success || !result.data) {
        setPreviewError(result.error ?? 'Failed to parse PDF');
        return;
      }
      // DEBUG: Log uploaded PDF data received by config page (browser console)
      console.log('[PDF Config] Uploaded PDF data received:', {
        fileName: file.name,
        stats: result.data.stats,
        documentAst: result.data.document_ast,
        previewFields: result.data.previewFields,
        previewFieldsCount: result.data.previewFields?.length ?? 0,
      });
      setPreviewAst(result.data.document_ast);
      setPreviewFields(result.data.previewFields ?? []);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPreviewLoading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    const name = mappingName?.trim();
    if (!name) {
      setError('Please enter a name for this mapping');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const existingName = selectedId === ADD_NEW_ID ? null : selectedId;
      const result = await saveOrgPdfMapping(name, mapping, isDefault, existingName);
      if (!result.success) {
        setError(result.error || 'Failed to save mapping');
        return;
      }
      setSuccess('Mapping saved. You can use it by name when uploading PDFs.');
      await loadMapping(name);
      setSelectedId(name);
      setTimeout(() => router.push('/dashboard/services/smart-invoicing'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === ADD_NEW_ID || mappings.length <= 1) return;
    if (!confirm(`Delete mapping "${selectedId}"?`)) return;
    try {
      setDeleting(true);
      setError(null);
      const result = await deleteOrgPdfMapping(selectedId);
      if (!result.success) {
        setError(result.error || 'Failed to delete mapping');
        return;
      }
      await loadMapping();
      setSelectedId(mappings.length > 2 ? mappings[0].name === selectedId ? mappings[1].name : mappings[0].name : ADD_NEW_ID);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-white hover:text-blue-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <span className="text-blue-300/60">|</span>
          <button
            type="button"
            onClick={() => router.push('/dashboard/services/smart-invoicing')}
            className="text-blue-200 hover:text-white transition-colors text-sm"
          >
            Smart Invoicing
          </button>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Configure PDF mapping
        </h1>
        <p className="text-blue-200 mb-6">
          Optional: set a default way to read this kind of PDF so fields auto-fill next time.
        </p>

        {!isOrgUser && (
          <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-200">
            <p className="font-medium">Organization required</p>
            <p className="text-sm mt-1">PDF mapping is available for organization accounts. Create or join an organization to set default field mappings. Until then, you can still upload PDFs and map fields manually on each draft.</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-200 text-sm">{success}</p>
          </div>
        )}

        {/* Upload sample PDF to preview AST */}
        {isOrgUser && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              1. Upload a sample PDF
            </h2>
            <p className="text-blue-200 text-sm mb-3">
              We&apos;ll show what we can read from it (titles, names, tasks, totals).
            </p>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600/30 border border-blue-400/50 rounded-lg cursor-pointer hover:bg-blue-600/50 w-fit">
              <FileText className="w-4 h-4" />
              <span className="text-white text-sm">Choose PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePreviewUpload}
                disabled={previewLoading}
              />
            </label>
            {previewLoading && <p className="text-blue-200 text-sm mt-2">Reading your PDF…</p>}
            {previewError && <p className="text-red-300 text-sm mt-2">{previewError}</p>}
            {(previewAst || previewFields.length > 0) && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2 max-h-80 overflow-y-auto">
                {previewAst && (
                  <div className="p-4 bg-black/20 rounded-lg text-sm space-y-2">
                    <p className="text-green-300 font-medium">
                      Summary of tasks
                    </p>
                    <p className="text-blue-200">
                      <span className="font-semibold">Line items found:</span>{' '}
                      {previewAst.items?.length ?? 0}
                    </p>
                    {previewAst.items && previewAst.items.length > 0 && (
                      <ul className="mt-2 list-disc list-inside text-blue-200 space-y-0.5">
                        {previewAst.items.slice(0, 10).map((item, i) => (
                          <li key={i}>
                            {item.quantity > 1 ? `x${item.quantity} – ` : ''}
                            {item.label.slice(0, 70)}
                            {item.label.length > 70 ? '…' : ''}
                          </li>
                        ))}
                        {previewAst.items.length > 10 && (
                          <li className="text-blue-300/80">
                            … and {previewAst.items.length - 10} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
                {previewFields.length > 0 && (
                  <div className="p-4 bg-black/20 rounded-lg text-xs space-y-2">
                    <p className="text-green-300 font-medium">
                      Text we found in your PDF
                    </p>
                    <p className="text-blue-200">
                      Just check that invoice number, client, totals and tasks show up somewhere in this list.
                    </p>
                    <ul className="mt-2 space-y-1 text-blue-100">
                      {previewFields.map((field) => (
                        <li key={field.index} className="border border-white/10 rounded-md px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-blue-300">
                              #{field.index} {field.fieldType ? `• ${field.fieldType}` : ''}
                            </span>
                            <span className="text-[10px] text-blue-400">
                              {field.source}
                            </span>
                          </div>
                          <p className="mt-1 break-words">
                            {field.value || field.originalLine}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Only show mapping UI AFTER they upload a sample PDF, so it's not guesswork. */}
        {isOrgUser && !previewAst && previewFields.length === 0 && (
          <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl text-sm text-blue-200">
            <p className="font-medium text-white mb-1">2. Then match the fields</p>
            <p>
              Upload a sample first. After that, you can say &quot;use this bit as my invoice number / client / title&quot;.
            </p>
          </div>
        )}

        {isOrgUser && (previewAst || previewFields.length > 0) && (
          <>
            {/* List / Add mapping selector */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-blue-200 text-sm">Mapping presets:</span>
              {mappings.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  onClick={() => selectMapping(e.name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedId === e.name
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/10 text-blue-200 hover:bg-white/20'
                  }`}
                >
                  {e.name}
                  {e.isDefault && (
                    <span className="ml-1.5 text-xs text-amber-300">(default)</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectMapping(ADD_NEW_ID)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedId === ADD_NEW_ID ? 'bg-indigo-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add new
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-lg space-y-6">
              {/* Mapping name + default */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-blue-200 mb-2">Preset name</label>
                  <input
                    type="text"
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    placeholder="e.g. Task Order, Acme Invoice"
                    className="w-full px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                  />
                </div>
                <label className="flex items-center gap-2 text-blue-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-white/30 bg-white/10 text-indigo-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Use as default for this PDF type</span>
                </label>
              </div>
              {selectedId === ADD_NEW_ID && (
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">Start from preset format</label>
                  <select
                    className="w-full max-w-md px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                    defaultValue=""
                    onChange={(e) => {
                      const preset = PDF_FORMAT_PRESETS.find((p) => p.name === e.target.value);
                      if (preset) {
                        setMapping(JSON.parse(JSON.stringify(preset.config)));
                        if (!mappingName) setMappingName(preset.name);
                      }
                    }}
                  >
                    <option value="" className="bg-gray-800 text-white">— Don&apos;t use a preset —</option>
                    {PDF_FORMAT_PRESETS.map((p) => (
                      <option key={p.id} value={p.name} className="bg-gray-800 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-blue-200/80 text-xs mt-1">
                    Built-in formats ensure accuracy. Customize after loading.
                  </p>
                </div>
              )}

              {INVOICE_FIELD_KEYS.filter((k) => k !== 'lineItems').map((fieldKey) => {
                const selectedPath = (mapping as Record<string, string>)[fieldKey];
                const previewValue = selectedPath ? getPreviewValueForPath(selectedPath) : null;
                return (
                  <div key={fieldKey}>
                    <label className="block text-sm font-medium text-blue-200 mb-1">
                      {INVOICE_FIELD_LABELS[fieldKey] ?? fieldKey}
                    </label>
                    <select
                      value={selectedPath ?? ''}
                      onChange={(e) => handleFieldChange(fieldKey as keyof OrgPdfMappingConfig, e.target.value)}
                      className="w-full px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                    >
                      {PDF_AST_PATH_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value} className="bg-gray-800 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {previewAst && selectedPath && (
                      <p className="mt-1 text-xs text-blue-200/90">
                        Example from this PDF:{' '}
                        <span className="font-semibold text-blue-100">
                          {previewValue ?? 'not found in sample PDF'}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Line items mapping */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <h3 className="text-white font-semibold">Line items (tasks / deliverables)</h3>
                <p className="text-blue-200 text-sm">
                  How we turn rows in your PDF into invoice rows.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">Description from</label>
                    <select
                      value={mapping.lineItems?.map?.description ?? 'label'}
                      onChange={(e) => handleLineItemMapChange('description', e.target.value)}
                      className="w-full px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                    >
                      {ITEM_FIELD_PATH_OPTIONS.filter((o) => o.value === 'label').map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">Quantity from</label>
                    <select
                      value={mapping.lineItems?.map?.quantity ?? 'quantity'}
                      onChange={(e) => handleLineItemMapChange('quantity', e.target.value)}
                      className="w-full px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                    >
                      {ITEM_FIELD_PATH_OPTIONS.filter((o) => ['quantity', 'index'].includes(o.value)).map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-blue-300/80 text-xs mt-1">Pick where quantity comes from for each row.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">Unit price from (optional)</label>
                    <select
                      value={mapping.lineItems?.map?.unitPrice ?? ''}
                      onChange={(e) => handleLineItemMapChange('unitPrice', e.target.value)}
                      className="w-full px-4 py-2 bg-white/15 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                    >
                      <option value="" className="bg-gray-800 text-white">— Don&apos;t map —</option>
                      {ITEM_FIELD_PATH_OPTIONS.filter((o) => o.value === 'unit_price').map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional display names (extracted code → human-readable description) */}
                {previewAst?.items?.length ? (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-white">Optional display names</h4>
                    <p className="text-xs text-blue-200">
                      Map extracted codes to human-readable names (e.g. &quot;CH, 402 – Ch. 021&quot; → &quot;Script Writing&quot;).
                    </p>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                      {Array.from(new Set(previewAst.items.map((i) => i.label))).map((label) => {
                        const key = label.trim().toLowerCase();
                        const displayName = (mapping.lineItemDescriptions && mapping.lineItemDescriptions[key]) ?? '';
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs text-blue-100">
                            <div className="flex-1 truncate min-w-0" title={label}>
                              {label}
                            </div>
                            <span className="text-[10px] text-blue-300 whitespace-nowrap">→</span>
                            <input
                              type="text"
                              placeholder="Display name"
                              value={displayName}
                              onChange={(e) => {
                                const value = e.target.value.trim();
                                setMapping((prev) => {
                                  const next: OrgPdfMappingConfig = { ...prev };
                                  const norm = label.trim().toLowerCase();
                                  if (!value) {
                                    if (next.lineItemDescriptions) {
                                      const rest = { ...next.lineItemDescriptions };
                                      delete rest[norm];
                                      next.lineItemDescriptions = Object.keys(rest).length > 0 ? rest : undefined;
                                    }
                                  } else {
                                    next.lineItemDescriptions = next.lineItemDescriptions ?? {};
                                    next.lineItemDescriptions[norm] = value;
                                  }
                                  return next;
                                });
                              }}
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder:text-blue-400/60 [color-scheme:dark]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Optional default prices per description */}
                {previewAst?.items?.length ? (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-white">Optional default prices</h4>
                    <p className="text-xs text-blue-200">
                      Set a price for tasks you always bill the same. We&apos;ll use it when that description appears.
                    </p>
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                      {Array.from(new Set(previewAst.items.map((i) => i.label))).map((label) => {
                        const key = label.trim().toLowerCase();
                        const current =
                          (mapping.lineItemPrices && mapping.lineItemPrices[key]?.unitPrice) ?? '';
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs text-blue-100">
                            <div className="flex-1 truncate" title={label}>
                              {label}
                            </div>
                            <span className="text-[10px] text-blue-300 whitespace-nowrap">
                              Price (invoice currency)
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={current}
                              onChange={(e) => {
                                const value = e.target.value.trim();
                                setMapping((prev) => {
                                  const next: OrgPdfMappingConfig = { ...prev };
                                  const norm = label.trim().toLowerCase();
                                  const n = parseFloat(value);
                                  if (!value || Number.isNaN(n) || n <= 0) {
                                    if (next.lineItemPrices) {
                                      delete next.lineItemPrices[norm];
                                    }
                                  } else {
                                    next.lineItemPrices = next.lineItemPrices ?? {};
                                    next.lineItemPrices[norm] = { unitPrice: n };
                                  }
                                  return next;
                                });
                              }}
                              className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-right text-white [color-scheme:dark]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                {selectedId !== ADD_NEW_ID && mappings.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete mapping
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !mappingName?.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save mapping'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
