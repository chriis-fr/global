'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getInvoiceDraft, updateDraftMappings } from '@/lib/actions/pdf-invoice';
import { ExtractedField } from '@/models/InvoiceDraft';
import { Loader2, ArrowLeft, Save, CheckCircle, AlertCircle } from 'lucide-react';

// Invoice field options for mapping
const INVOICE_FIELDS = [
  { value: '', label: '-- Select Field --' },
  { value: 'invoiceNumber', label: 'Invoice Number' },
  { value: 'issueDate', label: 'Issue Date' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'clientName', label: 'Client Name' },
  { value: 'clientEmail', label: 'Client Email' },
  { value: 'clientPhone', label: 'Client Phone' },
  { value: 'clientCompany', label: 'Client Company' },
  { value: 'clientAddress', label: 'Client Address' },
  { value: 'companyName', label: 'Company Name' },
  { value: 'companyEmail', label: 'Company Email' },
  { value: 'companyPhone', label: 'Company Phone' },
  { value: 'companyAddress', label: 'Company Address' },
  { value: 'companyTaxNumber', label: 'Company Tax Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'total', label: 'Total Amount' },
  { value: 'subtotal', label: 'Subtotal' },
  { value: 'tax', label: 'Tax Amount' },
  { value: 'notes', label: 'Notes/Memo' },
  { value: 'lineItem_add', label: '➕ Add as line item (description + qty)' },
];

export default function PdfMappingPage() {
  const router = useRouter();
  const params = useParams();
  const draftId = params?.draftId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [mappings, setMappings] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      setError('Missing draft ID');
      return;
    }
    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDraft is stable, draftId is the trigger
  }, [draftId]);

  const loadDraft = async () => {
    if (!draftId) return;
    try {
      setLoading(true);
      const result = await getInvoiceDraft(draftId);

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load draft');
        return;
      }

      setExtractedFields(result.data.extractedFields || []);
      setMappings(result.data.fieldMappings || {});
    } catch (err) {
      console.error('Error loading draft:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (fieldKey: string, invoiceField: string) => {
    setMappings((prev) => {
      const newMappings = { ...prev };
      if (invoiceField) {
        newMappings[fieldKey] = invoiceField;
      } else {
        delete newMappings[fieldKey];
      }
      return newMappings;
    });
  };

  const handleSave = async () => {
    const id = typeof draftId === 'string' ? draftId : undefined;
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const result = await updateDraftMappings(id, mappings);

      if (!result.success) {
        setError(result.error || 'Failed to save mappings');
        return;
      }

      setSuccess('Mappings saved. Opening Create Invoice with items pre-filled…');
      
      // Redirect to create page with draft pre-filled (same flow as PDF upload when mapping applied)
      setTimeout(() => {
        router.push(`/dashboard/services/smart-invoicing/create?fromPdfDraft=${id}`);
      }, 1500);
    } catch (err) {
      console.error('Error saving mappings:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-white text-lg">Loading draft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 flex items-center space-x-2 text-white hover:text-blue-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">Map PDF Fields</h1>
            <p className="text-blue-200">Map extracted PDF fields to invoice fields</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-200 text-sm">{success}</p>
          </div>
        )}

        {/* Mapping Interface */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-lg">
          {extractedFields.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white text-lg mb-2">No fields extracted</p>
              <p className="text-blue-200 text-sm">The PDF might be empty or unreadable.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="text-white font-semibold mb-2">Extracted PDF Fields</h3>
                  <p className="text-blue-200 text-sm mb-4">
                    {extractedFields.length} field(s) found in the PDF
                  </p>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">Invoice Fields</h3>
                  <p className="text-blue-200 text-sm mb-1">
                    Select which invoice field each PDF field should map to
                  </p>
                  <p className="text-blue-300/80 text-xs mb-4">
                    For deliverable/task rows (e.g. &quot;1. 348 Script Writing...&quot;), choose <strong>Add as line item</strong> to add them as invoice line items. Quantity is taken from the row when available.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {extractedFields.map((field, index) => (
                  <div
                    key={field.key}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Extracted Field */}
                      <div className="flex-1">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium mb-1 break-words">
                              {field.value}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 text-xs text-blue-200">
                              <span className="px-2 py-1 bg-blue-500/20 rounded">
                                {field.source}
                              </span>
                              {field.fieldType && (
                                <span className="px-2 py-1 bg-green-500/20 rounded text-green-300">
                                  {field.fieldType.replace('_', ' ')}
                                </span>
                              )}
                              <span>
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                            {field.originalLine && field.originalLine !== field.value && (
                              <p className="text-xs text-blue-300/70 mt-1 italic">
                                From: {field.originalLine.substring(0, 50)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mapping Dropdown */}
                      <div className="flex-1">
                        <select
                          value={mappings[field.key] || ''}
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {INVOICE_FIELDS.map((option) => {
                            // Auto-select if fieldType matches
                            const isSuggested = field.fieldType && 
                              option.value.toLowerCase().includes(field.fieldType.toLowerCase().replace('_', ''));
                            
                            return (
                              <option
                                key={option.value}
                                value={option.value}
                                className={`bg-gray-800 ${isSuggested ? 'text-green-300 font-semibold' : 'text-white'}`}
                              >
                                {option.label} {isSuggested && '✨'}
                              </option>
                            );
                          })}
                        </select>
                        {/* Auto-map suggestion */}
                        {field.fieldType && !mappings[field.key] && (
                          <button
                            onClick={() => {
                              // Find matching invoice field
                              const match = INVOICE_FIELDS.find(f => 
                                f.value.toLowerCase().includes(field.fieldType!.toLowerCase().replace('_', ''))
                              );
                              if (match) {
                                handleMappingChange(field.key, match.value);
                              }
                            }}
                            className="mt-2 text-xs text-green-400 hover:text-green-300 underline"
                          >
                            Auto-map to {field.fieldType.replace('_', ' ')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <button
                  onClick={() => router.back()}
                  className="px-4 py-2 text-white hover:text-blue-200 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || Object.keys(mappings).length === 0}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Mappings & Continue</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mapping Summary */}
              {Object.keys(mappings).length > 0 && (
                <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                  <p className="text-blue-200 text-sm">
                    <span className="font-semibold text-white">
                      {Object.keys(mappings).length}
                    </span>{' '}
                    field(s) mapped
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
