'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface WaiterOption {
  id: string;
  name: string;
}

interface Props {
  waiters: WaiterOption[];
  currentStatus: string;
  currentWaiter: string;
  currentQ: string;
  currentPeriod: string;
}

export function ReconciliationFilters({
  waiters,
  currentStatus,
  currentWaiter,
  currentQ,
  currentPeriod,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset page when filters change
      params.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push(`${pathname}?period=${currentPeriod}`);
    });
  }, [router, pathname, currentPeriod]);

  const hasActiveFilters = currentStatus !== 'all' || currentWaiter || currentQ;

  const statusOptions = [
    { key: 'all',     label: 'All' },
    { key: 'success', label: 'Successful' },
    { key: 'failed',  label: 'Failed' },
    { key: 'pending', label: 'Pending' },
  ];

  return (
    <div className={`flex flex-col sm:flex-row gap-3 transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* Status pills */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
        {statusOptions.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => updateParam('status', s.key === 'all' ? '' : s.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentStatus === s.key || (s.key === 'all' && !currentStatus)
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Waiter dropdown */}
      {waiters.length > 1 && (
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300 pointer-events-none" />
          <select
            value={currentWaiter}
            onChange={(e) => updateParam('waiter', e.target.value)}
            className="pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="">All Waiters</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id} className="bg-blue-950">
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300 pointer-events-none" />
        <input
          type="text"
          defaultValue={currentQ}
          placeholder="Search phone or tx ref…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('q', (e.target as HTMLInputElement).value.trim());
            }
          }}
          onBlur={(e) => updateParam('q', e.target.value.trim())}
          className="w-full pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-blue-100 placeholder-blue-300/60 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:bg-white/10 transition-colors"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-300 hover:text-white border border-white/10 hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
