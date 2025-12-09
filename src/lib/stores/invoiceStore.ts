import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { InvoiceDetails } from '@/lib/actions/invoices';

interface InvoiceStats {
  totalRevenue: number;
  totalInvoices: number;
  statusCounts: {
    draft: number;
    sent: number;
    pending: number;
    pending_approval: number;
    rejected: number;
    paid: number;
    overdue: number;
  };
}

interface InvoiceStore {
  // State
  invoices: InvoiceDetails[];
  stats: InvoiceStats | null;
  loading: boolean;
  statsLoading: boolean;
  lastFetchTime: number | null;
  lastStatsFetchTime: number | null;
  
  // Filters
  searchTerm: string;
  statusFilter: 'all' | 'draft' | 'sent' | 'pending' | 'paid' | 'overdue' | 'pending_approval' | 'rejected';
  currentPage: number;
  totalPages: number;
  totalInvoices: number;
  showAll: boolean;
  statusCounts: InvoiceStats['statusCounts'];
  
  // Actions
  setInvoices: (invoices: InvoiceDetails[]) => void;
  setStats: (stats: InvoiceStats) => void;
  setLoading: (loading: boolean) => void;
  setStatsLoading: (loading: boolean) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: InvoiceStore['statusFilter']) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setTotalInvoices: (total: number) => void;
  setShowAll: (show: boolean) => void;
  addInvoice: (invoice: InvoiceDetails) => void;
  updateInvoice: (id: string, updates: Partial<InvoiceDetails>) => void;
  removeInvoice: (id: string) => void;
  clearInvoices: () => void;
  shouldRefetch: (maxAge?: number) => boolean;
  shouldRefetchStats: (maxAge?: number) => boolean;
}

const defaultStats: InvoiceStats = {
  totalRevenue: 0,
  totalInvoices: 0,
  statusCounts: {
    draft: 0,
    sent: 0,
    pending: 0,
    pending_approval: 0,
    rejected: 0,
    paid: 0,
    overdue: 0,
  },
};

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set, get) => ({
      // Initial state
      invoices: [],
      stats: null,
      loading: false,
      statsLoading: false,
      lastFetchTime: null,
      lastStatsFetchTime: null,
      searchTerm: '',
      statusFilter: 'all',
      currentPage: 1,
      totalPages: 1,
      totalInvoices: 0,
      showAll: false,
      statusCounts: defaultStats.statusCounts,

      // Actions
      setInvoices: (invoices) => set({ invoices, lastFetchTime: Date.now() }),
      setStats: (stats) => set({ stats, lastStatsFetchTime: Date.now() }),
      setLoading: (loading) => set({ loading }),
      setStatsLoading: (statsLoading) => set({ statsLoading }),
      setSearchTerm: (term) => set({ searchTerm: term, currentPage: 1 }),
      setStatusFilter: (filter) => set({ statusFilter: filter, currentPage: 1 }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setTotalPages: (pages) => set({ totalPages: pages }),
      setTotalInvoices: (total) => set({ totalInvoices: total }),
      setShowAll: (show) => set({ showAll: show }),
      
      addInvoice: (invoice) => set((state) => ({ 
        invoices: [invoice, ...state.invoices] 
      })),
      
      updateInvoice: (id, updates) => set((state) => ({
        invoices: state.invoices.map((inv) =>
          inv._id === id ? { ...inv, ...updates } : inv
        ),
      })),
      
      removeInvoice: (id) => set((state) => ({
        invoices: state.invoices.filter((inv) => inv._id !== id),
        totalInvoices: Math.max(0, state.totalInvoices - 1),
      })),
      
      clearInvoices: () => set({ 
        invoices: [], 
        lastFetchTime: null,
        stats: null,
        lastStatsFetchTime: null,
      }),
      
      shouldRefetch: (maxAge = 30000) => {
        const { lastFetchTime } = get();
        if (!lastFetchTime) return true;
        return Date.now() - lastFetchTime > maxAge;
      },
      
      shouldRefetchStats: (maxAge = 60000) => {
        const { lastStatsFetchTime } = get();
        if (!lastStatsFetchTime) return true;
        return Date.now() - lastStatsFetchTime > maxAge;
      },
    }),
    {
      name: 'invoice-store',
      storage: createJSONStorage(() => typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }),
      partialize: (state) => ({
        // Only persist filters and stats, not the full invoice list
        searchTerm: state.searchTerm,
        statusFilter: state.statusFilter,
        currentPage: state.currentPage,
        showAll: state.showAll,
        stats: state.stats,
        lastStatsFetchTime: state.lastStatsFetchTime,
      }),
    }
  )
);

