'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

// Dashboard Stats Interface (minimal data for display only)
export interface DashboardStats {
  totalReceivables: number; // Expected revenue from all invoices
  totalPaidRevenue: number; // Money actually received (paid invoices)
  totalExpenses: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalClients: number;
  netBalance: number;
  totalPayables: number;
  overdueCount: number;
}

// Recent Invoice Interface (list view data only)
export interface RecentInvoice {
  _id: string;
  invoiceNumber: string;
  clientName: string; // Just name, no full details
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  recipientType?: 'individual' | 'organization';
}

// Recent Payable Interface (list view data only)
export interface RecentPayable {
  _id: string;
  payableNumber: string;
  vendorName: string; // Just name, no full details
  total: number;
  currency: string;
  status: string;
  createdAt: string;
}

// Organization Info Interface (essential info only)
export interface OrganizationInfo {
  name: string;
  industry: string;
  memberCount: number;
}

/**
 * Get dashboard statistics - only counts and totals
 * Matches existing DashboardStats interface but optimized
 */
export async function getDashboardStats(): Promise<{ success: boolean; data?: DashboardStats; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const clientsCollection = db.collection('clients');
    const ledgerCollection = db.collection('financial_ledger');

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;

    // Build query - Organization members should always see organization's data
    const isOrganization = !!session.user.organizationId;
    const baseQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get status counts for invoices (only counts, no full data)
    const [draftCount, sentCount, pendingCount, paidCount, overdueCount] = await Promise.all([
      invoicesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'sent' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'overdue' })
    ]);

    // Calculate totals
    const pendingInvoices = sentCount + pendingCount;
    const paidInvoicesCount = paidCount;

    // Get receivables (expected revenue from all invoices - sent, pending, approved)
    const receivablesQuery = {
      ...baseQuery,
      status: { $in: ['sent', 'pending', 'approved', 'paid'] } // All invoices that represent expected revenue
    };
    
    const receivablesInvoices = await invoicesCollection.find(receivablesQuery).toArray();
    const totalReceivables = await CurrencyService.calculateTotalRevenue(receivablesInvoices as { [key: string]: unknown }[], preferredCurrency);
    
    // Get paid revenue (only PAID invoices - money actually received)
    const paidRevenueQuery = {
      ...baseQuery,
      status: 'paid'
    };
    
    const paidInvoices = await invoicesCollection.find(paidRevenueQuery).toArray();
    const totalPaidRevenue = await CurrencyService.calculateTotalRevenue(paidInvoices as { [key: string]: unknown }[], preferredCurrency);

    // Get client count (only count, no client data)
    const totalClients = await clientsCollection.countDocuments(baseQuery);

    // Get payables stats using the same logic as the working payables API
    const payablesCollection = db.collection('payables');
    
    // Build payables query - Organization members should always see organization's payables
    const payablesQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get all payables first
    const allPayables = await payablesCollection.find(payablesQuery).toArray();
    
    // Only sum approved payables (bills that are ready to be paid) - same logic as payables API
    const payableBills = allPayables.filter(payable => 
      payable.status === 'approved'
    );
    
    const totalPayablesAmount = payableBills.reduce((sum, payable) => sum + (payable.total || payable.amount || 0), 0);

    console.log('🔍 [Dashboard Stats] Payables calculation:', {
      payablesQuery,
      allPayablesCount: allPayables.length,
      payableBillsCount: payableBills.length,
      totalPayablesAmount,
      approvedCount: payableBills.length,
      totalApprovedAmount: totalPayablesAmount,
      samplePayable: allPayables[0] ? {
        total: allPayables[0].total,
        amount: allPayables[0].amount,
        status: allPayables[0].status
      } : null
    });

    // Get ledger stats for net balance and overdue counts
    // Net balance should only include PAID receivables and APPROVED payables
    const ledgerStats = await ledgerCollection.aggregate([
      { 
        $match: {
          ...baseQuery,
          $or: [
            { type: 'receivable', status: 'paid' }, // Only paid receivables
            { type: 'payable', status: 'approved' }  // Only approved payables
          ]
        }
      },
      {
        $group: {
          _id: null,
          netBalance: { $sum: { $cond: [{ $eq: ['$type', 'receivable'] }, '$amount', { $multiply: ['$amount', -1] }] } },
          overdueReceivables: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'receivable'] }, { $eq: ['$status', 'overdue'] }] }, 1, 0] } },
          overduePayables: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'payable'] }, { $eq: ['$status', 'overdue'] }] }, 1, 0] } }
        }
      }
    ]).toArray();

    const ledgerData = ledgerStats[0] || { netBalance: 0, overdueReceivables: 0, overduePayables: 0 };

    const stats: DashboardStats = {
      totalReceivables, // Expected revenue from all invoices
      totalPaidRevenue, // Money actually received
      totalExpenses: 0, // Will be implemented when expenses service is ready
      pendingInvoices,
      paidInvoices: paidInvoicesCount,
      totalClients,
      netBalance: ledgerData.netBalance || 0,
      totalPayables: totalPayablesAmount, // Use the correct payables calculation
      overdueCount: (ledgerData.overdueReceivables || 0) + (ledgerData.overduePayables || 0)
    };

    console.log('🔍 [Dashboard Stats] Revenue breakdown:', {
      totalReceivables: totalReceivables, // Expected revenue (all invoices)
      totalPaidRevenue: totalPaidRevenue, // Money actually received
      netBalance: ledgerData.netBalance || 0, // Cash flow (paid receivables - approved payables)
      pendingInvoices,
      paidInvoices: paidInvoicesCount
    });

    return { success: true, data: stats };

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { success: false, error: 'Failed to fetch dashboard stats' };
  }
}

/**
 * Get recent invoices - only list view data
 * Matches existing invoice structure but minimal fields
 */
export async function getRecentInvoices(limit: number = 5): Promise<{ success: boolean; data?: RecentInvoice[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get only essential fields for list view
    const invoices = await invoicesCollection
      .find(query, {
        projection: {
          _id: 1,
          invoiceNumber: 1,
          'clientDetails.name': 1,
          'clientDetails.companyName': 1,
          total: 1,
          totalAmount: 1,
          currency: 1,
          status: 1,
          createdAt: 1,
          recipientType: 1
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Transform to minimal data structure
    const recentInvoices: RecentInvoice[] = invoices.map(invoice => ({
      _id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber || 'Invoice',
      clientName: invoice.clientDetails?.companyName || 
                 invoice.clientDetails?.name || 
                 'Client',
      total: invoice.total || invoice.totalAmount || 0,
      currency: invoice.currency || 'USD',
      status: invoice.status || 'draft',
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      recipientType: invoice.recipientType
    }));

    return { success: true, data: recentInvoices };

  } catch (error) {
    console.error('Error fetching recent invoices:', error);
    return { success: false, error: 'Failed to fetch recent invoices' };
  }
}

/**
 * Get recent payables - only list view data
 * Matches existing payable structure but minimal fields
 */
export async function getRecentPayables(limit: number = 5): Promise<{ success: boolean; data?: RecentPayable[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query - Organization members should always see organization's payables
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get only essential fields for list view
    const payables = await payablesCollection
      .find(query, {
        projection: {
          _id: 1,
          payableNumber: 1,
          vendorName: 1,
          total: 1,
          amount: 1,
          currency: 1,
          status: 1,
          createdAt: 1
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Transform to minimal data structure
    const recentPayables: RecentPayable[] = payables.map(payable => ({
      _id: payable._id.toString(),
      payableNumber: payable.payableNumber || 'Payable',
      vendorName: payable.vendorName || 'Vendor',
      total: payable.total || payable.amount || 0,
      currency: payable.currency || 'USD',
      status: payable.status || 'pending',
      createdAt: payable.createdAt?.toISOString() || new Date().toISOString()
    }));

    return { success: true, data: recentPayables };

  } catch (error) {
    console.error('Error fetching recent payables:', error);
    return { success: false, error: 'Failed to fetch recent payables' };
  }
}

/**
 * Get client count - only count, no client data
 */
export async function getClientCount(): Promise<{ success: boolean; data?: number; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const clientsCollection = db.collection('clients');

    // Build query - Organization members should always see organization's clients
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { userId: session.user.email };

    const count = await clientsCollection.countDocuments(query);

    return { success: true, data: count };

  } catch (error) {
    console.error('Error fetching client count:', error);
    return { success: false, error: 'Failed to fetch client count' };
  }
}

/**
 * Get organization info - only essential info
 */
export async function getOrganizationInfo(): Promise<{ success: boolean; data?: OrganizationInfo; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.organizationId) {
      return { success: false, error: 'No organization' };
    }

    const db = await connectToDatabase();
    const organizationsCollection = db.collection('organizations');

    const organization = await organizationsCollection.findOne(
      { _id: new ObjectId(session.user.organizationId) },
      {
        projection: {
          name: 1,
          industry: 1,
          'members': 1
        }
      }
    );

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    const orgInfo: OrganizationInfo = {
      name: organization.name || 'Organization',
      industry: organization.industry || '',
      memberCount: organization.members?.length || 0
    };

    return { success: true, data: orgInfo };

  } catch (error) {
    console.error('Error fetching organization info:', error);
    return { success: false, error: 'Failed to fetch organization info' };
  }
}
