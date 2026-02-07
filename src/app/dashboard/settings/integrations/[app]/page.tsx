'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, LayoutList, Link2, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';

// ClickUp-specific types (dummy / placeholder for when we fetch real data)
interface ClickUpTask {
  id: string;
  name: string;
  status?: string;
  listName?: string;
  spaceName?: string;
}

export default function IntegrationAppPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const app = (params?.app as string) || '';

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clickUpData, setClickUpData] = useState<ClickUpTask[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const justConnected = searchParams?.get('connected') === '1';
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

  const handleFetchClickUpData = () => {
    setLoadingData(true);
    fetch('/api/integrations/clickup/data')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.data)) {
          setClickUpData(data.data);
        } else {
          setClickUpData([]);
        }
      })
      .catch(() => setClickUpData([]))
      .finally(() => setLoadingData(false));
  };

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
        <DashboardFloatingButton />
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

      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
          <LayoutList className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">ClickUp</h1>
          <p className="text-blue-200 text-sm">Import tasks and lists, then use them to create invoices.</p>
        </div>
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
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
            ClickUp is connected. You can fetch data and use it for invoicing below.
          </div>

          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">Export data from ClickUp</h2>
            <p className="text-blue-200 text-sm mb-4">
              Fetch tasks/lists from your connected workspace. Later you can select items and create an invoice from them.
            </p>
            <button
              type="button"
              onClick={handleFetchClickUpData}
              disabled={loadingData}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
            >
              {loadingData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loadingData ? 'Fetching…' : 'Fetch data from ClickUp'}
            </button>
          </div>

          {clickUpData.length > 0 && (
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Data from ClickUp</h2>
              <ul className="space-y-2">
                {clickUpData.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <span className="text-white font-medium">{task.name}</span>
                    {task.listName && <span className="text-blue-200 text-sm">{task.listName}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-blue-200 text-sm mt-4">
                In a full integration you could select items above and open &quot;Create invoice&quot; with prefilled line items. This page does not change any existing invoice or sidebar logic.
              </p>
              <Link
                href="/dashboard/services/smart-invoicing/create"
                className="inline-flex items-center mt-4 text-blue-300 hover:text-white text-sm"
              >
                <FileText className="h-4 w-4 mr-2" /> Go to Create Invoice (unchanged)
              </Link>
            </div>
          )}
        </div>
      )}

      <DashboardFloatingButton />
    </div>
  );
}
