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
      return invoicesCache;
    }

    try {
      const response = await fetch('/api/invoices?convertToPreferred=true');
      const data = await response.json();
      
      if (data.success) {
        invoicesCache = data.data?.invoices || [];
        lastFetchTime = now;
        
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
    const pendingCount = invoices.filter(inv => inv.status === 'sent' || inv.status === 'pending').length;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    
    // Calculate total revenue from converted amounts
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
  }

  static async refreshInvoices(): Promise<Invoice[]> {
    this.clearCache();
    return this.getInvoices();
  }

  static async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('❌ [InvoiceService] Failed to fetch invoice:', data.message);
        return null;
      }
    } catch (error) {
      console.error('❌ [InvoiceService] Error fetching invoice:', error);
      return null;
    }
  }

  static async updateInvoice(id: string, updateData: Partial<Invoice>): Promise<Invoice | null> {
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.clearCache(); // Clear cache after update
        return data.data;
      } else {
        console.error('❌ [InvoiceService] Failed to update invoice:', data.message);
        return null;
      }
    } catch (error) {
      console.error('❌ [InvoiceService] Error updating invoice:', error);
      return null;
    }
  }

  static async sendInvoice(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/invoices/${id}/send`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.clearCache(); // Clear cache after sending
        return true;
      } else {
        console.error('❌ [InvoiceService] Failed to send invoice:', data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ [InvoiceService] Error sending invoice:', error);
      return false;
    }
  }
} 