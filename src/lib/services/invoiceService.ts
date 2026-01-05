import { Invoice } from '@/models/Invoice';

export class InvoiceService {
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