'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Link2, FileText, Loader2, Unplug, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from '@/lib/auth-client';
import { createInvoiceDraftFromClickUpPage } from '@/lib/actions/pdf-invoice';


// ClickUp task - matches API response with full destructuring (attachments for document conversion)
interface ClickUpTask {
  id: string;
  name: string;
  status?: string;
  listId?: string;
  listName?: string;
  spaceName?: string;
  description?: string;
  url?: string;
  tags?: string[];
  attachments?: Array<{ id?: string; title?: string; url?: string; type?: number; source?: string }>;
  customFields?: Array<{ id?: string; name?: string; type?: string; value?: unknown }>;
  dueDate?: string | null;
  priority?: string;
}

interface ClickUpDoc {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  creatorName?: string;
  url?: string;
  parentId?: string | number;
  parentType?: number;
  pages?: Array<{ id?: string; title?: string }>;
  selectedPageId?: string;
  pagePreviews?: Record<string, string>;
}

/** Turn ClickUp page API response into a short, non-technical summary for the preview area. */
function formatPagePreviewForDisplay(page: unknown): string {
  if (page == null) return '';
  if (typeof page === 'string') return page.slice(0, 400).trim();
  const p = page as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const content = typeof p.content === 'string' ? p.content : '';
  const parts: string[] = [];
  if (name) parts.push(name);
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tableLines = lines.filter((l) => l.startsWith('|') && l.includes('|', 1));
  const isSeparator = (l: string) =>
    l.replace(/\s/g, '').split('|').every((c) => c === '' || /^-+$/.test(c));
  const dataRowCount = Math.max(0, tableLines.filter((l) => !isSeparator(l)).length - 1); // minus header
  const firstNonTable = lines.find((l) => !l.startsWith('|'));
  if (firstNonTable) parts.push(firstNonTable);
  if (dataRowCount > 0) parts.push(`${dataRowCount} deliverable${dataRowCount !== 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export default function IntegrationAppPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const app = (params?.app as string) || '';

  // Redirect non-admin users - integrations are admin-only
  useEffect(() => {
    if (session && !session.user?.adminTag) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clickUpData, setClickUpData] = useState<ClickUpTask[]>([]);
  const [clickUpHierarchy, setClickUpHierarchy] = useState<Array<{
    id: string;
    name: string;
    folders?: Array<{ id: string; name: string; lists: Array<{ id: string; name: string; taskCount: number }> }>;
    folderlessLists?: Array<{ id: string; name: string; taskCount: number }>;
  }>>([]);
  const [clickUpDocs, setClickUpDocs] = useState<ClickUpDoc[]>([]);
  const [fetchMeta, setFetchMeta] = useState<{ spacesChecked?: number; listsChecked?: number } | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());
  const [docLoadingIds, setDocLoadingIds] = useState<Set<string>>(new Set());
  const [docErrors, setDocErrors] = useState<Record<string, string | undefined>>({});
  const [creatingDraftDocIds, setCreatingDraftDocIds] = useState<Set<string>>(new Set());
  const [createDraftErrors, setCreateDraftErrors] = useState<Record<string, string | undefined>>({});

  const justConnected = searchParams?.get('connected') === '1';

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const errorConfig = searchParams?.get('error') === 'config';
  const errorConnect = searchParams?.get('error') === '1';
  const errorNoOrg = searchParams?.get('error') === 'no_org';

  useEffect(() => {
    if (app !== 'clickup') {
      setLoading(false);
      return;
    }
    fetch('/api/integrations/clickup/status')
      .then((res) => res.json())
      .then((data) => {
        const isConnected = !!data?.connected;
        console.log('[ClickUp Page] Status check – connected:', isConnected);
        setConnected(isConnected);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[ClickUp Page] Status check failed:', err);
        setConnected(false);
        setLoading(false);
      });
  }, [app]);

  useEffect(() => {
    if (justConnected && app === 'clickup') {
      setConnected(true);
      // Clean URL
      router.replace('/dashboard/settings/integrations/clickup', { scroll: false });
    }
  }, [justConnected, app, router]);

  useEffect(() => {
    if (app === 'clickup' && connected) {
      setLoadingWorkspaces(true);
      fetch('/api/integrations/clickup/workspaces')
        .then((res) => res.json())
        .then((data) => {
          const list = data?.success && Array.isArray(data?.data) ? data.data : [];
          setWorkspaces(list);
          setSelectedWorkspaceId((prev) => (list.length > 0 && !prev ? list[0].id : prev));
        })
        .catch(() => setWorkspaces([]))
        .finally(() => setLoadingWorkspaces(false));
    }
  }, [app, connected]);

  const handleDisconnect = async () => {
    if (!connected || disconnecting) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/clickup/disconnect', { method: 'DELETE' });
      const data = await res.json();
      if (data?.success) {
        setConnected(false);
        setClickUpData([]);
        setClickUpHierarchy([]);
        setFetchMeta(null);
        setClickUpDocs([]);
        setWorkspaces([]);
        setSelectedWorkspaceId('');
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFetchClickUpData = () => {
    setLoadingData(true);
    const url = selectedWorkspaceId
      ? `/api/integrations/clickup/data?teamId=${encodeURIComponent(selectedWorkspaceId)}`
      : '/api/integrations/clickup/data';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.data)) {
          setClickUpData(data.data);
          setClickUpHierarchy(Array.isArray(data?.hierarchy) ? data.hierarchy : []);
          setFetchMeta(data.meta ?? null);
          setClickUpDocs(Array.isArray(data?.docs) ? data.docs : []);
          setSelectedTaskIds(new Set());
          setExpandedIds(new Set());
          console.log(
            '[ClickUp Page] Fetched:',
            data.data.length,
            'tasks, hierarchy:',
            data.hierarchy?.length,
            'docs:',
            Array.isArray(data?.docs) ? data.docs.length : 0
          );
        } else {
          setClickUpData([]);
          setClickUpHierarchy([]);
          setFetchMeta(null);
          setClickUpDocs([]);
          console.log('[ClickUp Page] Fetch failed or no data:', data);
        }
      })
      .catch((err) => {
        setClickUpData([]);
        setClickUpHierarchy([]);
        setFetchMeta(null);
        setClickUpDocs([]);
        console.warn('[ClickUp Page] Fetch error:', err);
      })
      .finally(() => setLoadingData(false));
  };

  // Don't render anything if not admin
  if (!session?.user?.adminTag) {
    return null;
  }

  // Only ClickUp is implemented for now
  if (app !== 'clickup') {
    return (
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/settings/integrations"
          className="inline-flex items-center text-blue-200 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Integrations
        </Link>
        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
          <p className="text-white font-medium">This integration is not available yet.</p>
          <p className="text-blue-200 text-sm mt-2">We only support ClickUp at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/dashboard/settings/integrations"
        className="inline-flex items-center text-blue-200 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Integrations
      </Link>

      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden relative shrink-0">
            <Image src="/clickup-logo.png" alt="" fill className="object-cover" sizes="48px" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ClickUp</h1>
            <p className="text-blue-200 text-sm">Import tasks and lists, then use them to create invoices.</p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="opacity-90">Connected</span>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
              Disconnect
            </button>
          </div>
        )}
      </div>

      {errorConfig && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          Integration is not configured. Add <code className="bg-white/10 px-1 rounded">CLICKUP_CLIENT_ID</code>, <code className="bg-white/10 px-1 rounded">CLICKUP_CLIENT_SECRET</code>, and <code className="bg-white/10 px-1 rounded">CLICKUP_REDIRECT_URI</code> to your <code className="bg-white/10 px-1 rounded">.env</code> and restart the server. See <code className="bg-white/10 px-1 rounded">docs/INTEGRATIONS_CLICKUP.md</code>.
        </div>
      )}
      {errorNoOrg && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          ClickUp connections are available for organization accounts. Create or join an organization in Settings → Organization, then connect ClickUp again.
        </div>
      )}
      {errorConnect && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
          Connection failed. Check the server logs (terminal) for details. Ensure your ClickUp app redirect URI matches <code className="bg-white/10 px-1 rounded">CLICKUP_REDIRECT_URI</code>.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      ) : !connected ? (
        <div className="p-8 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-2">Connect your ClickUp account</h2>
          <p className="text-blue-200 text-sm mb-6">
            One click takes you to ClickUp to authorize. You will return here after approving.
          </p>
          <a
            href="/api/integrations/clickup/connect"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Connect to ClickUp
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">Export data from ClickUp</h2>
            <p className="text-blue-200 text-sm mb-4">
              Choose a workspace, then fetch tasks/lists. Later you can select items and create an invoice from them.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">Workspace</label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                disabled={loadingWorkspaces}
                className="w-full max-w-md px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                {loadingWorkspaces ? (
                  <option>Loading workspaces…</option>
                ) : workspaces.length === 0 ? (
                  <option>No workspaces found</option>
                ) : (
                  workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={handleFetchClickUpData}
              disabled={loadingData || !selectedWorkspaceId}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
            >
              {loadingData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loadingData ? 'Fetching…' : 'Fetch data from ClickUp'}
            </button>
          </div>

          {(fetchMeta !== null || clickUpData.length > 0 || clickUpHierarchy.length > 0 || clickUpDocs.length > 0) && (
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Data from ClickUp</h2>

              {clickUpHierarchy.length > 0 && (
                <div className="mb-6">
                  <p className="text-blue-200 text-sm mb-3">Click to expand and see tasks (Space → Folder → List → Tasks)</p>
                  <div className="space-y-2">
                    {clickUpHierarchy.map((space) => {
                      const spaceExpanded = expandedIds.has(`space-${space.id}`);
                      const hasContent = (space.folderlessLists?.length ?? 0) > 0 || (space.folders?.length ?? 0) > 0;
                      return (
                        <div key={space.id} className="rounded-lg border border-white/10 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => hasContent && toggleExpanded(`space-${space.id}`)}
                            className={`w-full flex items-center gap-2 px-3 py-2 bg-white/5 text-left text-white font-medium text-sm ${hasContent ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
                          >
                            {hasContent ? (spaceExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : null}
                            <span className="flex-1">{space.name}</span>
                          </button>
                          {spaceExpanded && (
                            <div className="border-t border-white/10">
                              {space.folderlessLists?.map((list) => {
                                const listExpanded = expandedIds.has(`list-${list.id}`);
                                const listTasks = clickUpData.filter((t) => t.listId === list.id);
                                const listDocs = clickUpDocs.filter((d) => d.parentId === list.id);
                                return (
                                  <div key={list.id} className="border-t border-white/5 first:border-t-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(`list-${list.id}`)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-blue-200 text-sm hover:bg-white/5 cursor-pointer"
                                    >
                                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${listExpanded ? 'rotate-90' : ''}`} />
                                      <span className="flex-1">{list.name}</span>
                                      <span className="text-blue-300/80 text-xs">{list.taskCount} task{list.taskCount !== 1 ? 's' : ''}</span>
                                    </button>
                                    {listExpanded && (
                                      <div className="px-6 py-2 bg-white/5 border-t border-white/5">
                                        {listTasks.length > 0 ? (
                                          listTasks.map((task) => (
                                            <label
                                              key={task.id}
                                              className="flex flex-col gap-1 py-2 px-2 rounded hover:bg-white/5 cursor-pointer"
                                            >
                                              <div className="flex items-center gap-3">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedTaskIds.has(task.id)}
                                                  onChange={(e) => {
                                                    setSelectedTaskIds((prev) => {
                                                      const next = new Set(prev);
                                                      if (e.target.checked) next.add(task.id);
                                                      else next.delete(task.id);
                                                      return next;
                                                    });
                                                  }}
                                                  className="h-3.5 w-3.5 rounded border-white/30 text-blue-600"
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="text-white text-sm">{task.name}</span>
                                              </div>
                                              {task.description && (
                                                <span className="text-blue-200 text-xs ml-7 line-clamp-2">
                                                  {task.description}
                                                </span>
                                              )}
                                            </label>
                                          ))
                                        ) : (
                                          <p className="text-blue-300/70 text-xs py-1">
                                            {listDocs.length > 0
                                              ? 'No tasks in this list (docs available below)'
                                              : 'No tasks in this list'}
                                          </p>
                                        )}
                                        {listDocs.length > 0 && (
                                          <div className="mt-2 border-t border-white/10 pt-2">
                                            <p className="text-blue-300/80 text-xs mb-1">Docs in this list</p>
                                            <ul className="space-y-1 text-xs">
                                              {listDocs.map((doc) => {
                                                const docExpanded = expandedDocIds.has(doc.id);
                                                const isLoading = docLoadingIds.has(doc.id);
                                                return (
                                                  <li key={doc.id}>
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        setExpandedDocIds((prev) => {
                                                          const next = new Set(prev);
                                                          if (next.has(doc.id)) next.delete(doc.id);
                                                          else next.add(doc.id);
                                                          return next;
                                                        });
                                                        // Lazy-load doc pages on first expand
                                                        if (!docExpanded && !doc.pages && selectedWorkspaceId) {
                                                          setDocLoadingIds((prev) => {
                                                            const next = new Set(prev);
                                                            next.add(doc.id);
                                                            return next;
                                                          });
                                                          try {
                                                            const res = await fetch(
                                                              `/api/integrations/clickup/doc-pages?workspaceId=${encodeURIComponent(
                                                                selectedWorkspaceId
                                                              )}&docId=${encodeURIComponent(doc.id)}`
                                                            );
                                                            const json = await res.json();
                                                            if (json?.success) {
                                                              const pid = (json.pageId as string | null) ?? (json.pages?.[0]?.id as string | undefined) ?? undefined;
                                                              const preview =
                                                                json.page == null
                                                                  ? ''
                                                                  : formatPagePreviewForDisplay(json.page);
                                                              setClickUpDocs((prev) =>
                                                                prev.map((d) =>
                                                                  d.id === doc.id
                                                                    ? {
                                                                        ...d,
                                                                        pages: json.pages ?? [],
                                                                        selectedPageId: pid ?? d.selectedPageId,
                                                                        pagePreviews:
                                                                          pid
                                                                            ? { ...(d.pagePreviews ?? {}), [pid]: preview }
                                                                            : (d.pagePreviews ?? {}),
                                                                      }
                                                                    : d
                                                                )
                                                              );
                                                              setDocErrors((prev) => ({
                                                                ...prev,
                                                                [doc.id]: undefined,
                                                              }));
                                                            } else {
                                                              setDocErrors((prev) => ({
                                                                ...prev,
                                                                [doc.id]:
                                                                  json?.error ||
                                                                  'Failed to load doc pages from ClickUp',
                                                              }));
                                                            }
                                                          } catch {
                                                            setDocErrors((prev) => ({
                                                              ...prev,
                                                              [doc.id]: 'Network error while loading doc pages',
                                                            }));
                                                          } finally {
                                                            setDocLoadingIds((prev) => {
                                                              const next = new Set(prev);
                                                              next.delete(doc.id);
                                                              return next;
                                                            });
                                                          }
                                                        }
                                                      }}
                                                      className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-left"
                                                    >
                                                      <span className="text-white truncate text-xs">
                                                        {doc.name || doc.id}
                                                      </span>
                                                      <ChevronRight
                                                        className={`h-3 w-3 shrink-0 transition-transform ${
                                                          docExpanded ? 'rotate-90' : ''
                                                        }`}
                                                      />
                                                    </button>
                                                    {docExpanded && (
                                                      <div className="mt-1 ml-2 text-blue-200 text-[11px] space-y-0.5">
                                                        {isLoading ? (
                                                          <div>Loading pages…</div>
                                                        ) : docErrors[doc.id] ? (
                                                          <div className="text-red-300">
                                                            {docErrors[doc.id]}
                                                          </div>
                                                        ) : doc.pages && doc.pages.length > 0 ? (
                                                          <>
                                                            <div className="font-semibold text-[11px]">
                                                              Pages:
                                                            </div>
                                                            <ul className="ml-0 space-y-1">
                                                              {doc.pages.map((p) => {
                                                                const pid = p.id ?? '';
                                                                const selected = !!pid && doc.selectedPageId === pid;
                                                                return (
                                                                  <li key={pid}>
                                                                    <button
                                                                      type="button"
                                                                      className={`w-full text-left px-2 py-1 rounded bg-white/5 hover:bg-white/10 ${selected ? 'ring-1 ring-blue-400/50' : ''}`}
                                                                      onClick={async () => {
                                                                        if (!pid || !selectedWorkspaceId) return;
                                                                        setClickUpDocs((prev) =>
                                                                          prev.map((d) =>
                                                                            d.id === doc.id
                                                                              ? { ...d, selectedPageId: pid }
                                                                              : d
                                                                          )
                                                                        );
                                                                        // If we already fetched this page preview, don't refetch
                                                                        if (doc.pagePreviews?.[pid]) return;
                                                                        setDocLoadingIds((prev) => {
                                                                          const next = new Set(prev);
                                                                          next.add(doc.id);
                                                                          return next;
                                                                        });
                                                                        try {
                                                                          const res = await fetch(
                                                                            `/api/integrations/clickup/doc-pages?workspaceId=${encodeURIComponent(
                                                                              selectedWorkspaceId
                                                                            )}&docId=${encodeURIComponent(doc.id)}&pageId=${encodeURIComponent(pid)}`
                                                                          );
                                                                          const json = await res.json();
                                                                          if (json?.success) {
                                                                            const preview =
                                                                              json.page == null
                                                                                ? ''
                                                                                : formatPagePreviewForDisplay(json.page);
                                                                            setClickUpDocs((prev) =>
                                                                              prev.map((d) =>
                                                                                d.id === doc.id
                                                                                  ? {
                                                                                      ...d,
                                                                                      selectedPageId: pid,
                                                                                      pagePreviews: {
                                                                                        ...(d.pagePreviews ?? {}),
                                                                                        [pid]: preview,
                                                                                      },
                                                                                    }
                                                                                  : d
                                                                              )
                                                                            );
                                                                            setDocErrors((prev) => ({
                                                                              ...prev,
                                                                              [doc.id]: undefined,
                                                                            }));
                                                                          } else {
                                                                            setDocErrors((prev) => ({
                                                                              ...prev,
                                                                              [doc.id]:
                                                                                json?.error ||
                                                                                'Failed to load page content from ClickUp',
                                                                            }));
                                                                          }
                                                                        } catch {
                                                                          setDocErrors((prev) => ({
                                                                            ...prev,
                                                                            [doc.id]:
                                                                              'Network error while loading page content',
                                                                          }));
                                                                        } finally {
                                                                          setDocLoadingIds((prev) => {
                                                                            const next = new Set(prev);
                                                                            next.delete(doc.id);
                                                                            return next;
                                                                          });
                                                                        }
                                                                      }}
                                                                    >
                                                                      <span className="text-white text-xs">
                                                                        {p.title || pid}
                                                                      </span>
                                                                    </button>
                                                                  </li>
                                                                );
                                                              })}
                                                            </ul>
                                                            {doc.selectedPageId && doc.pagePreviews?.[doc.selectedPageId] && (
                                                              <div className="mt-1">
                                                                <div className="font-semibold text-[11px]">
                                                                  Selected page preview:
                                                                </div>
                                                                <div className="text-blue-100/90 text-[11px]">
                                                                  {doc.pagePreviews[doc.selectedPageId]}
                                                                </div>
                                                                <div className="mt-2 flex items-center gap-2">
                                                                  <button
                                                                    type="button"
                                                                    disabled={
                                                                      !selectedWorkspaceId ||
                                                                      !doc.selectedPageId ||
                                                                      creatingDraftDocIds.has(doc.id)
                                                                    }
                                                                    onClick={async () => {
                                                                      if (!selectedWorkspaceId || !doc.selectedPageId) return;
                                                                      setCreatingDraftDocIds((prev) => {
                                                                        const next = new Set(prev);
                                                                        next.add(doc.id);
                                                                        return next;
                                                                      });
                                                                      setCreateDraftErrors((prev) => ({
                                                                        ...prev,
                                                                        [doc.id]: undefined,
                                                                      }));
                                                                      try {
                                                                        const result =
                                                                          await createInvoiceDraftFromClickUpPage({
                                                                            workspaceId: selectedWorkspaceId,
                                                                            docId: doc.id,
                                                                            pageId: doc.selectedPageId,
                                                                            mappingName: null,
                                                                          });
                                                                        if (!result.success || !result.data) {
                                                                          setCreateDraftErrors((prev) => ({
                                                                            ...prev,
                                                                            [doc.id]:
                                                                              result.error ||
                                                                              'Failed to create invoice draft',
                                                                          }));
                                                                          return;
                                                                        }
                                                                        const { draftId, status } = result.data;
                                                                        if (status === 'ready') {
                                                                          router.push(
                                                                            `/dashboard/services/smart-invoicing/create?fromPdfDraft=${draftId}`
                                                                          );
                                                                        } else {
                                                                          router.push(
                                                                            `/dashboard/services/smart-invoicing/pdf-map/${draftId}`
                                                                          );
                                                                        }
                                                                      } finally {
                                                                        setCreatingDraftDocIds((prev) => {
                                                                          const next = new Set(prev);
                                                                          next.delete(doc.id);
                                                                          return next;
                                                                        });
                                                                      }
                                                                    }}
                                                                    className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                                                                  >
                                                                    {creatingDraftDocIds.has(doc.id) ? (
                                                                      <>
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        Creating…
                                                                      </>
                                                                    ) : (
                                                                      'Create invoice from this page'
                                                                    )}
                                                                  </button>
                                                                  {createDraftErrors[doc.id] && (
                                                                    <span className="text-red-300 text-[11px]">
                                                                      {createDraftErrors[doc.id]}
                                                                    </span>
                                                                  )}
                                                                </div>
                                                              </div>
                                                            )}
                                                          </>
                                                        ) : (
                                                          <div>No pages found for this doc.</div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {space.folders?.map((folder) => {
                                const folderExpanded = expandedIds.has(`folder-${folder.id}`);
                                return (
                                  <div key={folder.id} className="border-t border-white/5">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(`folder-${folder.id}`)}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-blue-300 font-medium text-sm hover:bg-white/5 cursor-pointer"
                                    >
                                      {folderExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                      <span className="flex-1">{folder.name}</span>
                                    </button>
                                    {folderExpanded &&
                                      folder.lists.map((list) => {
                                        const listExpanded = expandedIds.has(`list-${list.id}`);
                                        const listTasks = clickUpData.filter((t) => t.listId === list.id);
                                        const listDocs = clickUpDocs.filter((d) => d.parentId === list.id);
                                        return (
                                          <div key={list.id} className="border-t border-white/5 ml-4">
                                            <button
                                              type="button"
                                              onClick={() => toggleExpanded(`list-${list.id}`)}
                                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-200 text-sm hover:bg-white/5 cursor-pointer"
                                            >
                                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${listExpanded ? 'rotate-90' : ''}`} />
                                              <span className="flex-1">{list.name}</span>
                                              <span className="text-blue-300/80 text-xs">{list.taskCount} task{list.taskCount !== 1 ? 's' : ''}</span>
                                            </button>
                                            {listExpanded && (
                                              <div className="px-5 py-2 bg-white/5 border-t border-white/5 ml-4">
                                                {listTasks.length > 0 ? (
                                                  listTasks.map((task) => (
                                                    <label
                                                      key={task.id}
                                                      className="flex flex-col gap-1 py-2 px-2 rounded hover:bg-white/5 cursor-pointer"
                                                    >
                                                      <div className="flex items-center gap-3">
                                                        <input
                                                          type="checkbox"
                                                          checked={selectedTaskIds.has(task.id)}
                                                          onChange={(e) => {
                                                            setSelectedTaskIds((prev) => {
                                                              const next = new Set(prev);
                                                              if (e.target.checked) next.add(task.id);
                                                              else next.delete(task.id);
                                                              return next;
                                                            });
                                                          }}
                                                          className="h-3.5 w-3.5 rounded border-white/30 text-blue-600"
                                                          onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <span className="text-white text-sm">{task.name}</span>
                                                      </div>
                                                      {task.description && (
                                                        <span className="text-blue-200 text-xs ml-7 line-clamp-2">
                                                          {task.description}
                                                        </span>
                                                      )}
                                                    </label>
                                                  ))
                                                ) : (
                                                  <p className="text-blue-300/70 text-xs py-1">
                                                    {listDocs.length > 0
                                                      ? 'No tasks in this list (docs available below)'
                                                      : 'No tasks in this list'}
                                                  </p>
                                                )}
                                                {listDocs.length > 0 && (
                                                  <div className="mt-2 border-t border-white/10 pt-2">
                                                    <p className="text-blue-300/80 text-xs mb-1">Docs in this list</p>
                                                    <ul className="space-y-1 text-xs">
                                                      {listDocs.map((doc) => {
                                                        const docExpanded = expandedDocIds.has(doc.id);
                                                        const isLoading = docLoadingIds.has(doc.id);
                                                        return (
                                                          <li key={doc.id}>
                                                            <button
                                                              type="button"
                                                              onClick={async () => {
                                                                setExpandedDocIds((prev) => {
                                                                  const next = new Set(prev);
                                                                  if (next.has(doc.id)) next.delete(doc.id);
                                                                  else next.add(doc.id);
                                                                  return next;
                                                                });
                                                                if (!docExpanded && !doc.pages && selectedWorkspaceId) {
                                                                  setDocLoadingIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    next.add(doc.id);
                                                                    return next;
                                                                  });
                                                                  try {
                                                                    const res = await fetch(
                                                                      `/api/integrations/clickup/doc-pages?workspaceId=${encodeURIComponent(
                                                                        selectedWorkspaceId
                                                                      )}&docId=${encodeURIComponent(doc.id)}`
                                                                    );
                                                                    const json = await res.json();
                                                                    if (json?.success) {
                                                                      const pid = (json.pageId as string | null) ?? (json.pages?.[0]?.id as string | undefined) ?? undefined;
                                                                      const preview =
                                                                        json.page == null
                                                                          ? ''
                                                                          : typeof json.page === 'string'
                                                                            ? String(json.page).slice(0, 2000)
                                                                            : JSON.stringify(json.page, null, 2).slice(0, 2000);
                                                                      setClickUpDocs((prev) =>
                                                                        prev.map((d) =>
                                                                          d.id === doc.id
                                                                            ? {
                                                                                ...d,
                                                                                pages: json.pages ?? [],
                                                                                selectedPageId: pid ?? d.selectedPageId,
                                                                                pagePreviews:
                                                                                  pid
                                                                                    ? { ...(d.pagePreviews ?? {}), [pid]: preview }
                                                                                    : (d.pagePreviews ?? {}),
                                                                              }
                                                                            : d
                                                                        )
                                                                      );
                                                                      setDocErrors((prev) => ({
                                                                        ...prev,
                                                                        [doc.id]: undefined,
                                                                      }));
                                                                    } else {
                                                                      setDocErrors((prev) => ({
                                                                        ...prev,
                                                                        [doc.id]:
                                                                          json?.error ||
                                                                          'Failed to load doc pages from ClickUp',
                                                                      }));
                                                                    }
                                                                  } catch {
                                                                    setDocErrors((prev) => ({
                                                                      ...prev,
                                                                      [doc.id]:
                                                                        'Network error while loading doc pages',
                                                                    }));
                                                                  } finally {
                                                                    setDocLoadingIds((prev) => {
                                                                      const next = new Set(prev);
                                                                      next.delete(doc.id);
                                                                      return next;
                                                                    });
                                                                  }
                                                                }
                                                              }}
                                                              className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-left"
                                                            >
                                                              <span className="text-white truncate text-xs">
                                                                {doc.name || doc.id}
                                                              </span>
                                                              <ChevronRight
                                                                className={`h-3 w-3 shrink-0 transition-transform ${
                                                                  docExpanded ? 'rotate-90' : ''
                                                                }`}
                                                              />
                                                            </button>
                                                            {docExpanded && (
                                                              <div className="mt-1 ml-2 text-blue-200 text-[11px] space-y-0.5">
                                                                {isLoading ? (
                                                                  <div>Loading pages…</div>
                                                                ) : docErrors[doc.id] ? (
                                                                  <div className="text-red-300">
                                                                    {docErrors[doc.id]}
                                                                  </div>
                                                                ) : doc.pages && doc.pages.length > 0 ? (
                                                                  <>
                                                                    <div className="font-semibold text-[11px]">
                                                                      Pages:
                                                                    </div>
                                                                    <ul className="ml-0 space-y-1">
                                                                      {doc.pages.map((p) => {
                                                                        const pid = p.id ?? '';
                                                                        const selected = !!pid && doc.selectedPageId === pid;
                                                                        return (
                                                                          <li key={pid}>
                                                                            <button
                                                                              type="button"
                                                                              className={`w-full text-left px-2 py-1 rounded bg-white/5 hover:bg-white/10 ${selected ? 'ring-1 ring-blue-400/50' : ''}`}
                                                                              onClick={async () => {
                                                                                if (!pid || !selectedWorkspaceId) return;
                                                                                setClickUpDocs((prev) =>
                                                                                  prev.map((d) =>
                                                                                    d.id === doc.id
                                                                                      ? { ...d, selectedPageId: pid }
                                                                                      : d
                                                                                  )
                                                                                );
                                                                                if (doc.pagePreviews?.[pid]) return;
                                                                                setDocLoadingIds((prev) => {
                                                                                  const next = new Set(prev);
                                                                                  next.add(doc.id);
                                                                                  return next;
                                                                                });
                                                                                try {
                                                                                  const res = await fetch(
                                                                                    `/api/integrations/clickup/doc-pages?workspaceId=${encodeURIComponent(
                                                                                      selectedWorkspaceId
                                                                                    )}&docId=${encodeURIComponent(doc.id)}&pageId=${encodeURIComponent(pid)}`
                                                                                  );
                                                                                  const json = await res.json();
                                                                                  if (json?.success) {
                                                                                    const preview =
                                                                                      json.page == null
                                                                                        ? ''
                                                                                        : formatPagePreviewForDisplay(json.page);
                                                                                    setClickUpDocs((prev) =>
                                                                                      prev.map((d) =>
                                                                                        d.id === doc.id
                                                                                          ? {
                                                                                              ...d,
                                                                                              selectedPageId: pid,
                                                                                              pagePreviews: {
                                                                                                ...(d.pagePreviews ?? {}),
                                                                                                [pid]: preview,
                                                                                              },
                                                                                            }
                                                                                          : d
                                                                                      )
                                                                                    );
                                                                                    setDocErrors((prev) => ({
                                                                                      ...prev,
                                                                                      [doc.id]: undefined,
                                                                                    }));
                                                                                  } else {
                                                                                    setDocErrors((prev) => ({
                                                                                      ...prev,
                                                                                      [doc.id]:
                                                                                        json?.error ||
                                                                                        'Failed to load page content from ClickUp',
                                                                                    }));
                                                                                  }
                                                                                } catch {
                                                                                  setDocErrors((prev) => ({
                                                                                    ...prev,
                                                                                    [doc.id]:
                                                                                      'Network error while loading page content',
                                                                                  }));
                                                                                } finally {
                                                                                  setDocLoadingIds((prev) => {
                                                                                    const next = new Set(prev);
                                                                                    next.delete(doc.id);
                                                                                    return next;
                                                                                  });
                                                                                }
                                                                              }}
                                                                            >
                                                                              <span className="text-white truncate text-xs">
                                                                                {p.title || pid}
                                                                              </span>
                                                                            </button>
                                                                          </li>
                                                                        );
                                                                      })}
                                                                    </ul>
                                                                    {doc.selectedPageId &&
                                                                      doc.pagePreviews?.[doc.selectedPageId] && (
                                                                        <div className="mt-1">
                                                                          <div className="font-semibold text-[11px]">
                                                                            Selected page preview:
                                                                          </div>
                                                                          <div className="text-blue-100/90 text-[11px]">
                                                                            {doc.pagePreviews[doc.selectedPageId]}
                                                                          </div>
                                                                          <div className="mt-2 flex items-center gap-2">
                                                                            <button
                                                                              type="button"
                                                                              disabled={
                                                                                !selectedWorkspaceId ||
                                                                                !doc.selectedPageId ||
                                                                                creatingDraftDocIds.has(doc.id)
                                                                              }
                                                                              onClick={async () => {
                                                                                if (!selectedWorkspaceId || !doc.selectedPageId) return;
                                                                                setCreatingDraftDocIds((prev) => {
                                                                                  const next = new Set(prev);
                                                                                  next.add(doc.id);
                                                                                  return next;
                                                                                });
                                                                                setCreateDraftErrors((prev) => ({
                                                                                  ...prev,
                                                                                  [doc.id]: undefined,
                                                                                }));
                                                                                try {
                                                                                  const result =
                                                                                    await createInvoiceDraftFromClickUpPage({
                                                                                      workspaceId: selectedWorkspaceId,
                                                                                      docId: doc.id,
                                                                                      pageId: doc.selectedPageId,
                                                                                      mappingName: null,
                                                                                    });
                                                                                  if (!result.success || !result.data) {
                                                                                    setCreateDraftErrors((prev) => ({
                                                                                      ...prev,
                                                                                      [doc.id]:
                                                                                        result.error ||
                                                                                        'Failed to create invoice draft',
                                                                                    }));
                                                                                    return;
                                                                                  }
                                                                                  const { draftId, status } = result.data;
                                                                                  if (status === 'ready') {
                                                                                    router.push(
                                                                                      `/dashboard/services/smart-invoicing/create?fromPdfDraft=${draftId}`
                                                                                    );
                                                                                  } else {
                                                                                    router.push(
                                                                                      `/dashboard/services/smart-invoicing/pdf-map/${draftId}`
                                                                                    );
                                                                                  }
                                                                                } finally {
                                                                                  setCreatingDraftDocIds((prev) => {
                                                                                    const next = new Set(prev);
                                                                                    next.delete(doc.id);
                                                                                    return next;
                                                                                  });
                                                                                }
                                                                              }}
                                                                              className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                                                                            >
                                                                              {creatingDraftDocIds.has(doc.id) ? (
                                                                                <>
                                                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                                                  Creating…
                                                                                </>
                                                                              ) : (
                                                                                'Create invoice from this page'
                                                                              )}
                                                                            </button>
                                                                            {createDraftErrors[doc.id] && (
                                                                              <span className="text-red-300 text-[11px]">
                                                                                {createDraftErrors[doc.id]}
                                                                              </span>
                                                                            )}
                                                                          </div>
                                                                        </div>
                                                                      )}
                                                                  </>
                                                                ) : (
                                                                  <div>No pages found for this doc.</div>
                                                                )}
                                                              </div>
                                                            )}
                                                          </li>
                                                        );
                                                      })}
                                                    </ul>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedTaskIds.size > 0 && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      const selected = clickUpData.filter((t) => selectedTaskIds.has(t.id));
                      if (selected.length === 0) return;
                      const items = selected.map((t) => ({
                        id: t.id,
                        name: t.name,
                        listName: t.listName,
                        spaceName: t.spaceName,
                      }));
                      try {
                        sessionStorage.setItem('clickUpPrefillItems', JSON.stringify(items));
                        router.push('/dashboard/services/smart-invoicing/create?fromClickUp=1');
                      } catch (e) {
                        console.warn('sessionStorage failed:', e);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    <FileText className="h-4 w-4" />
                    Create invoice from selected ({selectedTaskIds.size})
                  </button>
                </div>
              )}

              {clickUpData.length > 0 && clickUpHierarchy.length === 0 ? (
                <>
                  <p className="text-blue-200 text-sm mb-3">Select tasks for invoice line items.</p>
                  <ul className="space-y-2 mb-4">
                    {clickUpData.map((task) => (
                      <label
                        key={task.id}
                        className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={(e) => {
                              setSelectedTaskIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(task.id);
                                else next.delete(task.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-white/30 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1 text-white font-medium">{task.name}</span>
                          <span className="text-blue-200 text-sm">
                            {[task.spaceName, task.listName].filter(Boolean).join(' › ')}
                          </span>
                        </div>
                        {task.description && (
                          <span className="text-blue-200 text-xs ml-7 line-clamp-2">
                            {task.description}
                          </span>
                        )}
                      </label>
                    ))}
                  </ul>
                </>
              ) : clickUpHierarchy.length > 0 ? (
                <p className="text-blue-200 text-sm">
                  Expand the lists above to see tasks. Select tasks and click &quot;Create invoice from selected&quot; to add them as line items.
                </p>
              ) : (
                <p className="text-blue-200 text-sm">
                  No spaces or lists found.
                  {fetchMeta && (
                    <span className="block mt-1 text-blue-300/80">
                      Checked {fetchMeta.spacesChecked ?? 0} space(s), {fetchMeta.listsChecked ?? 0} list(s).
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
