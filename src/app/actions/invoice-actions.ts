"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

/**
 * Delete an invoice
 */
export async function deleteInvoice(invoiceId: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Build query - Organization members should see organization's invoices
    const isOrganization = !!session.user.organizationId;
    const query: Record<string, unknown> = isOrganization 
      ? { 
          _id: new ObjectId(invoiceId),
          organizationId: session.user.organizationId 
        }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const result = await invoicesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return { success: false, error: 'Invoice not found or unauthorized' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return { success: false, error: 'Failed to delete invoice' };
  }
}

/**
 * Get invoice statistics (totals, counts) - separate from invoice list
 * This can be called independently and cached
 */
export async function getInvoiceStats() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Build base query
    const isOrganization = !!session.user.organizationId;
    const baseQuery: Record<string, unknown> = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email || '');
    const preferredCurrency = userPreferences.preferredCurrency;

    // Get all counts in parallel
    const [
      totalCount,
      draftCount,
      sentCount,
      pendingCount,
      pendingApprovalCount,
      rejectedCount,
      paidCount,
      overdueCount,
      paidInvoices
    ] = await Promise.all([
      invoicesCollection.countDocuments(baseQuery),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'sent' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'pending_approval' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'rejected' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'overdue' }),
      invoicesCollection.find({ ...baseQuery, status: 'paid' }).toArray()
    ]);

    // Calculate total revenue
    const totalRevenue = await CurrencyService.calculateTotalRevenue(
      paidInvoices as Record<string, unknown>[],
      preferredCurrency
    );

    return {
      success: true,
      data: {
        totalRevenue,
        preferredCurrency,
        totalInvoices: totalCount,
        statusCounts: {
          draft: draftCount,
          sent: sentCount,
          pending: pendingCount,
          pending_approval: pendingApprovalCount,
          rejected: rejectedCount,
          paid: paidCount,
          overdue: overdueCount,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    return { success: false, error: 'Failed to fetch invoice stats' };
  }
}

