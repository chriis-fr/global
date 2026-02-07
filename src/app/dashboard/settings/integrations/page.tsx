'use client';

import { useRouter } from 'next/navigation';
import { Plug, ChevronRight, LayoutList } from 'lucide-react';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';

const INTEGRATIONS = [
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Import tasks and projects from ClickUp, then turn them into invoices.',
    icon: LayoutList,
    href: '/dashboard/settings/integrations/clickup',
    available: true,
  },
  // Add more integrations here later, e.g. quickbooks, xero
  // { id: 'quickbooks', name: 'QuickBooks', description: '...', icon: ..., href: '...', available: false },
];

export default function IntegrationsSettingsPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-blue-200">
          Connect external tools and export or sync data. Each integration has its own page for setup and data.
        </p>
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => router.push(integration.href)}
              className="w-full flex items-center justify-between p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{integration.name}</h2>
                  <p className="text-sm text-blue-200 mt-0.5">{integration.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/50 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <DashboardFloatingButton />
    </div>
  );
}
