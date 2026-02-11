'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronRight, LayoutList, Link2, Unplug, Loader2 } from 'lucide-react';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';

const INTEGRATIONS = [
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Import tasks and projects from ClickUp, then turn them into invoices.',
    icon: LayoutList,
    logo: '/clickup-logo.png',
    href: '/dashboard/settings/integrations/clickup',
    available: true,
    hasStatusApi: true,
  },
];

export default function IntegrationsSettingsPage() {
  const router = useRouter();
  const [clickUpConnected, setClickUpConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/clickup/status')
      .then((res) => res.json())
      .then((data) => setClickUpConnected(!!data?.connected))
      .catch(() => setClickUpConnected(false));
  }, []);

  const handleDisconnectClickUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!clickUpConnected || disconnecting) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/clickup/disconnect', { method: 'DELETE' });
      const data = await res.json();
      if (data?.success) {
        setClickUpConnected(false);
      }
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-blue-200">
          Connect external tools and export or sync data. Each integration has its own page for setup and data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          const logo = 'logo' in integration ? (integration as { logo?: string }).logo : undefined;
          const isClickUp = integration.id === 'clickup';
          const connected = isClickUp ? clickUpConnected : false;

          return (
            <div
              key={integration.id}
              className="flex flex-col p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <button
                type="button"
                onClick={() => router.push(integration.href)}
                className="flex-1 text-left flex flex-col min-h-0"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg overflow-hidden relative shrink-0 ${logo ? '' : 'bg-white/10 flex items-center justify-center'}`}>
                    {logo ? (
                      <Image src={logo} alt="" fill className="object-cover" sizes="40px" />
                    ) : (
                      <Icon className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-white truncate">{integration.name}</h2>
                    {integration.hasStatusApi && (
                      <span className={`text-xs ${connected ? 'text-green-400' : 'text-blue-200'}`}>
                        {connected ? 'Connected' : 'Not connected'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/50 flex-shrink-0" />
                </div>
                <p className="text-sm text-blue-200 line-clamp-2">{integration.description}</p>
              </button>

              {isClickUp && integration.available && (
                <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                  {connected ? (
                    <button
                      type="button"
                      onClick={handleDisconnectClickUp}
                      disabled={disconnecting}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                      Disconnect
                    </button>
                  ) : (
                    <a
                      href="/api/integrations/clickup/connect"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <DashboardFloatingButton />
    </div>
  );
}
