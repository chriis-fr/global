'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { assignPdfFormatsToOrg, searchOrganizationsForAdmin, copyMyPdfMappingsToOrganization, getOrgPdfMapping, getOrgPdfMappingsForAdmin } from '@/lib/actions/pdf-invoice';
import { PDF_FORMAT_PRESETS } from '@/data/pdfFormatPresets';
import { FileText, Loader2, Search, CheckCircle, ArrowLeft, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

const DEBOUNCE_MS = 300;

export default function AdminPdfFormatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Array<{
    organizationId: string;
    organizationName?: string;
    sampleMemberEmail?: string;
    assignedPresetIds?: string[];
  }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [orgData, setOrgData] = useState<{
    organizationId: string;
    organizationName?: string;
    assignedPresetIds: string[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyingMappings, setCopyingMappings] = useState(false);
  const [myMappings, setMyMappings] = useState<Array<{ name: string; isDefault?: boolean }>>([]);
  const [orgMappings, setOrgMappings] = useState<Array<{ name: string; isDefault?: boolean }>>([]);
  const [loadingMyMappings, setLoadingMyMappings] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoadingMyMappings(true);
    getOrgPdfMapping().then((r) => {
      if (r.success && r.data?.mappings) {
        setMyMappings(r.data.mappings.map((m) => ({ name: m.name, isDefault: m.isDefault })));
      } else {
        setMyMappings([]);
      }
    }).finally(() => setLoadingMyMappings(false));
  }, [status]);

  useEffect(() => {
    if (!orgData?.organizationId) {
      setOrgMappings([]);
      return;
    }
    getOrgPdfMappingsForAdmin(orgData.organizationId).then((r) => {
      if (r.success && r.data?.mappings) {
        setOrgMappings(r.data.mappings);
      } else {
        setOrgMappings([]);
      }
    });
  }, [orgData?.organizationId]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setShowDropdown(trimmed.length > 0);
      return;
    }
    setSearching(true);
    try {
      const result = await searchOrganizationsForAdmin(trimmed);
      if (result.success && result.data) {
        setResults(result.data);
        setShowDropdown(true);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, runSearch]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (showDropdown && searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showDropdown]);

  const handleSelectOrg = (org: { organizationId: string; organizationName?: string; assignedPresetIds?: string[] }) => {
    setOrgData({
      organizationId: org.organizationId,
      organizationName: org.organizationName,
      assignedPresetIds: org.assignedPresetIds ?? [],
    });
    setSelectedIds(new Set(org.assignedPresetIds ?? []));
    setSearchQuery(org.organizationName ?? org.organizationId);
    setShowDropdown(false);
    setResults([]);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user?.adminTag) {
    router.push(status === 'unauthenticated' ? '/auth' : '/dashboard');
    return null;
  }

  const handleTogglePreset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!orgData) return;
    setSaving(true);
    try {
      const result = await assignPdfFormatsToOrg(orgData.organizationId, Array.from(selectedIds));
      if (result.success) {
        toast.success('PDF formats assigned successfully');
        setOrgData((prev) => prev ? { ...prev, assignedPresetIds: Array.from(selectedIds) } : null);
      } else {
        toast.error(result.error ?? 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMyMappings = async () => {
    if (!orgData) return;
    setCopyingMappings(true);
    try {
      const result = await copyMyPdfMappingsToOrganization(orgData.organizationId);
      if (result.success) {
        toast.success(`Copied ${result.data?.copied ?? 0} custom mapping(s) to this organization. Members can now use them.`);
      } else {
        toast.error(result.error ?? 'Failed to copy mappings');
      }
    } catch {
      toast.error('Failed to copy mappings');
    } finally {
      setCopyingMappings(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-7 w-7 text-blue-600" />
              PDF Format Assignment
            </h1>
            <p className="text-gray-600 text-sm mt-0.5">
              Assign which PDF formats each organization can use. Only assigned formats appear in their upload dropdown.
            </p>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Your PDF mappings</h3>
          <p className="text-xs text-gray-500 mb-3">Custom formats on your account (used when you upload PDFs)</p>
          {loadingMyMappings ? (
            <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
          ) : (
            <div className="space-y-3">
              {myMappings.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {myMappings.map((m) => (
                    <span
                      key={m.name}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      {m.name}{m.isDefault ? ' (default)' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No custom mappings. Create one in Smart Invoicing → Config.</p>
              )}
              <p className="text-xs text-gray-500 pt-1">
                Built-in presets you can use: {PDF_FORMAT_PRESETS.map((p) => p.name).join(', ')}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative" ref={searchContainerRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by org name or member email
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              placeholder="Type to search (e.g. young, caspian, @company.com)"
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {searching ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <Search className="h-4 w-4 text-gray-400" />}
            </div>
            {showDropdown && (
              <div
                data-results-dropdown
                className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
              >
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    {searchQuery.trim().length < 2 ? 'Type at least 2 characters' : searching ? 'Searching...' : 'No organizations found'}
                  </p>
                ) : (
                  results.map((org) => (
                    <button
                      key={org.organizationId}
                      type="button"
                      onClick={() => handleSelectOrg(org)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex flex-col gap-0.5"
                    >
                      <span className="font-medium text-gray-900">{org.organizationName ?? 'Organization'}</span>
                      {org.sampleMemberEmail && (
                        <span className="text-xs text-gray-500">{org.sampleMemberEmail}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {orgData && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {orgData.organizationName ?? 'Organization'}
            </h2>
            <p className="text-xs text-gray-500 mb-4">ID: {orgData.organizationId}</p>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">This organization&apos;s custom mappings</h3>
              {orgMappings.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {orgMappings.map((m) => (
                    <span
                      key={m.name}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800"
                    >
                      {m.name}{m.isDefault ? ' (default)' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No custom mappings yet.</p>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Select which built-in PDF formats this organization can use:
            </p>
            <div className="space-y-3">
              {PDF_FORMAT_PRESETS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => handleTogglePreset(p.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                  {selectedIds.has(p.id) && (
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 ml-auto" />
                  )}
                </label>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Copy my custom PDF mappings</h3>
              <p className="text-sm text-gray-600 mb-3">
                Copy your mappings ({myMappings.length ? myMappings.map((m) => m.name).join(', ') : 'none'}) to this organization so members can use the same format when uploading PDFs.
              </p>
              <button
                type="button"
                onClick={handleCopyMyMappings}
                disabled={copyingMappings || myMappings.length === 0}
                className="w-full py-2.5 px-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 flex items-center justify-center gap-2 font-medium text-sm"
              >
                {copyingMappings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy my mappings to this organization
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              Save assignment
            </button>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
          <p className="font-medium">How it works:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-blue-700">
            <li>Type to search by org name or member email—results appear as you type</li>
            <li>Select which PDF format presets that org can use</li>
            <li><strong>Copy my custom mappings</strong> — if you have custom formats (e.g. &quot;script&quot;) on your account, copy them to the org so members inherit them</li>
            <li>Only assigned presets + org mappings appear in their Smart Invoicing → Upload PDF dropdown</li>
            <li>Admin (your account) always sees all formats</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
