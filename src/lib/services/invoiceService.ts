import { Invoice } from '@/models/Invoice';

// Cache for invoices data
let invoicesCache: Invoice[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export interface InvoiceStats {
  totalInvoices: number;
  pendingCount: number;
  paidCount: number;
  totalRevenue: number;
}

export class InvoiceService {
  static async getInvoices(): Promise<Invoice[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (now - lastFetchTime < CACHE_DURATION && invoicesCache.length > 0) {
      console.log('📊 [InvoiceService] Using cached invoices data');
      return invoicesCache;
    }

    try {
      console.log('📊 [InvoiceService] Fetching fresh invoices data...');
      const response = await fetch('/api/invoices');
      const data = await response.json();
      
      if (data.success) {
        invoicesCache = data.data?.invoices || [];
        lastFetchTime = now;
        
        console.log('📊 [InvoiceService] Updated cache with', invoicesCache.length, 'invoices');
        return invoicesCache;
      } else {
        console.error('❌ [InvoiceService] Failed to fetch invoices:', data.message);
        return [];
      }
    } catch (error) {
      console.error('❌ [InvoiceService] Error fetching invoices:', error);
      return [];
    }
  }

  static getStats(invoices: Invoice[]): InvoiceStats {
    const pendingCount = invoices.filter(inv => inv.status === 'draft' || inv.status === 'sent').length;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return {
      totalInvoices: invoices.length,
      pendingCount,
      paidCount,
      totalRevenue
    };
  }

  static clearCache(): void {
    invoicesCache = [];
    lastFetchTime = 0;
    console.log('📊 [InvoiceService] Cache cleared');
  }

  static async refreshInvoices(): Promise<Invoice[]> {
    this.clearCache();
    return this.getInvoices();
  }
} 