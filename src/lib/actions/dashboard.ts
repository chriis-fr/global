'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

// Simple in-memory cache for dashboard stats (5 minutes)
const statsCache = new Map<string, { data: DashboardStats; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
  sentVia?: 'email' | 'whatsapp';
}

// Recent Payable Interface (list view data only)
export interface RecentPayable {
  _id: string;
  payableNumber: string;
  vendorName: string; // Just name, no full details
  total: number;
  currency: string;
  amountUsd?: number; // Converted USD amount (for crypto currencies)
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

    // Check cache first
    const cacheKey = `dashboard_stats_${session.user.id}_${session.user.organizationId || 'individual'}`;
    const cached = statsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return { success: true, data: cached.data };
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
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { ownerId: session.user.email }, // Primary identifier for individual users
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get status counts for invoices (only counts, no full data)
    const [sentCount, pendingCount, paidCount] = await Promise.all([
      invoicesCollection.countDocuments({ ...baseQuery, status: 'sent' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'paid' })
    ]);

    // Calculate totals
    const pendingInvoices = sentCount + pendingCount;
    const paidInvoicesCount = paidCount;

    // Get receivables using aggregation - group by currency and sum amounts
    // Receivables = UNPAID invoices only (money you're expecting to receive)
    const receivablesQuery = {
      ...baseQuery,
      status: { $in: ['sent', 'pending', 'approved'] } // Only unpaid invoices (exclude 'paid' - those are already received)
    };
    
    const receivablesByCurrency = await invoicesCollection.aggregate([
      { $match: receivablesQuery },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $ifNull: ['$totalAmount', '$total', 0] } }
        }
      }
    ]).toArray();
    
    // Batch convert all currencies at once
    let totalReceivables = 0;
    const conversionPromises = receivablesByCurrency.map(async (item) => {
      const currency = item._id || 'USD';
      const amount = item.total || 0;
      if (currency === preferredCurrency) {
        return amount;
      }
      return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
    });
    const convertedAmounts = await Promise.all(conversionPromises);
    totalReceivables = convertedAmounts.reduce((sum, amount) => sum + amount, 0);
    
    // Get paid revenue using aggregation - group by currency and sum amounts
    const paidRevenueQuery = {
      ...baseQuery,
      status: 'paid'
    };
    
    const paidByCurrency = await invoicesCollection.aggregate([
      { $match: paidRevenueQuery },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $ifNull: ['$totalAmount', '$total', 0] } }
        }
      }
    ]).toArray();
    
    // Batch convert all currencies at once
    let totalPaidRevenue = 0;
    const paidConversionPromises = paidByCurrency.map(async (item) => {
      const currency = item._id || 'USD';
      const amount = item.total || 0;
      if (currency === preferredCurrency) {
        return amount;
      }
      return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
    });
    const paidConvertedAmounts = await Promise.all(paidConversionPromises);
    totalPaidRevenue = paidConvertedAmounts.reduce((sum, amount) => sum + amount, 0);

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

    // Get unpaid payables using aggregation - group by currency and sum amounts
    const unpaidPayablesByCurrency = await payablesCollection.aggregate([
      { 
        $match: {
          ...payablesQuery,
          status: { $ne: 'paid' }
        }
      },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $ifNull: ['$total', '$amount', 0] } }
        }
      }
    ]).toArray();
    
    // Batch convert all currencies at once
    let totalPayablesAmount = 0;
    const payablesConversionPromises = unpaidPayablesByCurrency.map(async (item) => {
      const currency = item._id || 'USD';
      const amount = item.total || 0;
      if (currency === preferredCurrency) {
        return amount;
      }
      return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
    });
    const payablesConvertedAmounts = await Promise.all(payablesConversionPromises);
    totalPayablesAmount = payablesConvertedAmounts.reduce((sum, amount) => sum + amount, 0);
    
    // Only count approved payables as bills ready to be paid (not needed in this response)
    // Get ledger stats for net balance and overdue counts
    // Net balance should only include PAID receivables and PAID payables (actual money in/out)
    // Build a STRICT query for ledger entries - ownerId is the primary identifier
    // CRITICAL: Only match entries where ownerId exactly matches the user's email (for individuals)
    const ledgerQuery = isOrganization
      ? {
          $and: [
            {
              $or: [
                { organizationId: session.user.organizationId },
                { organizationId: new ObjectId(session.user.organizationId) }
              ]
            },
            // Ensure ownerId also matches for organizations and is not null/empty
            { 
              ownerId: {
                $exists: true,
                $ne: null,
                $eq: session.user.organizationId
              }
            },
            { ownerId: { $ne: '' } }
          ]
        }
      : {
          // For individual users, ownerId MUST exactly match user's email
          // This is the strictest possible filter - only entries owned by this exact user
          ownerId: session.user.email
        };
    
    // Calculate net balance from invoices and payables directly
    // Net Balance = (Paid Receivables) - (Paid Payables) - (Approved Payables for organizations)
    
    // Get paid receivables from invoices (money actually received)
    const paidReceivablesByCurrency = await invoicesCollection.aggregate([
      { 
        $match: {
          ...baseQuery,
          status: 'paid' // Only PAID invoices (money actually received)
        }
      },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $ifNull: ['$totalAmount', '$total', 0] } }
        }
      }
    ]).toArray();
    
    // Batch convert paid receivables
    let paidReceivablesAmount = 0;
    const paidReceivablesConversionPromises = paidReceivablesByCurrency.map(async (item) => {
      const currency = item._id || 'USD';
      const amount = item.total || 0;
      if (currency === preferredCurrency) {
        return amount;
      }
      return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
    });
    const paidReceivablesConverted = await Promise.all(paidReceivablesConversionPromises);
    paidReceivablesAmount = paidReceivablesConverted.reduce((sum, amount) => sum + amount, 0);
    
    // Get paid payables (money actually paid out)
    const paidPayablesByCurrency = await payablesCollection.aggregate([
      { 
        $match: {
          ...payablesQuery,
          status: 'paid' // Only PAID payables (money actually paid out)
        }
      },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $ifNull: ['$total', '$amount', 0] } }
        }
      }
    ]).toArray();
    
    // Batch convert paid payables
    let paidPayablesAmount = 0;
    const paidPayablesConversionPromises = paidPayablesByCurrency.map(async (item) => {
      const currency = item._id || 'USD';
      const amount = item.total || 0;
      if (currency === preferredCurrency) {
        return amount;
      }
      return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
    });
    const paidPayablesConverted = await Promise.all(paidPayablesConversionPromises);
    paidPayablesAmount = paidPayablesConverted.reduce((sum, amount) => sum + amount, 0);
    
    // For organizations, also subtract approved payables (committed expenses)
    let approvedPayablesAmount = 0;
    if (isOrganization) {
      const approvedPayablesByCurrency = await payablesCollection.aggregate([
        { 
          $match: {
            ...payablesQuery,
            status: 'approved' // Approved payables are committed expenses for organizations
          }
        },
        {
          $group: {
            _id: '$currency',
            total: { $sum: { $ifNull: ['$total', '$amount', 0] } }
          }
        }
      ]).toArray();
      
      // Batch convert approved payables
      const approvedPayablesConversionPromises = approvedPayablesByCurrency.map(async (item) => {
        const currency = item._id || 'USD';
        const amount = item.total || 0;
        if (currency === preferredCurrency) {
          return amount;
        }
        return CurrencyService.convertCurrency(amount, currency, preferredCurrency);
      });
      const approvedPayablesConverted = await Promise.all(approvedPayablesConversionPromises);
      approvedPayablesAmount = approvedPayablesConverted.reduce((sum, amount) => sum + amount, 0);
    }
    
    // Calculate net balance: Paid Receivables - Paid Payables - Approved Payables (for orgs)
    const calculatedNetBalance = paidReceivablesAmount - paidPayablesAmount - approvedPayablesAmount;
    
    // Get overdue counts from ledger (still useful for stats)
    const ledgerStats = await ledgerCollection.aggregate([
      { 
        $match: {
          ...ledgerQuery
        }
      },
      {
        $group: {
          _id: null,
          overdueReceivables: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'receivable'] }, { $eq: ['$status', 'overdue'] }] }, 1, 0] } },
          overduePayables: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'payable'] }, { $eq: ['$status', 'overdue'] }] }, 1, 0] } }
        }
      }
    ]).toArray();

    const ledgerData = ledgerStats[0] || { overdueReceivables: 0, overduePayables: 0 };

    const stats: DashboardStats = {
      totalReceivables, // Expected revenue from all invoices (sent, pending, approved, paid)
      totalPaidRevenue, // Money actually received (paid invoices only)
      totalExpenses: 0, // Will be implemented when expenses service is ready
      pendingInvoices,
      paidInvoices: paidInvoicesCount,
      totalClients,
      netBalance: calculatedNetBalance, // Paid Receivables - Paid Payables - Approved Payables (for orgs)
      totalPayables: totalPayablesAmount, // Unpaid payables (bills to pay)
      overdueCount: (ledgerData.overdueReceivables || 0) + (ledgerData.overduePayables || 0)
    };

    // Cache the result
    statsCache.set(cacheKey, { data: stats, timestamp: Date.now() });
    
    // Clean up old cache entries (keep only last 100 entries)
    if (statsCache.size > 100) {
      const entries = Array.from(statsCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      statsCache.clear();
      entries.slice(0, 100).forEach(([key, value]) => statsCache.set(key, value));
    }

    return { success: true, data: stats };

  } catch {
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
          recipientType: 1,
          sentVia: 1
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
      recipientType: invoice.recipientType,
      sentVia: invoice.sentVia
    }));

    return { success: true, data: recentInvoices };

  } catch {
    return { success: false, error: 'Failed to fetch recent invoices' };
  }
}

/**
 * Get recent payables - only list view data
 * Matches existing payable structure but minimal fields
 * Converts crypto amounts to USD on server side
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

    // Helper to check if currency is crypto
    const isCryptoCurrency = (currency: string): boolean => {
      const cryptoCurrencies = ['CELO', 'ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'cUSD', 'cEUR'];
      return cryptoCurrencies.includes(currency.toUpperCase());
    };

    // Transform to minimal data structure with USD conversion for crypto (server-side, like admin stats)
    const recentPayablesPromises = payables.map(async (payable) => {
      const amount = payable.total || payable.amount || 0;
      const currency = payable.currency || 'USD';
      
      // Convert crypto to USD on server side (like admin stats)
      let amountUsd: number | undefined;
      if (isCryptoCurrency(currency)) {
        try {
          const { convertCryptoToUsd } = await import('@/lib/services/exchangeRateService');
          amountUsd = await convertCryptoToUsd(amount, currency);
        } catch (error) {
          console.error(`Error converting ${amount} ${currency} to USD:`, error);
          // If conversion fails, amountUsd will be undefined and CurrencyAmount will handle it
        }
      }
      
      return {
        _id: payable._id.toString(),
        payableNumber: payable.payableNumber || 'Payable',
        vendorName: payable.vendorName || 'Vendor',
        total: amount,
        currency: currency,
        amountUsd: amountUsd, // Converted USD amount for crypto
        status: payable.status || 'pending',
        createdAt: payable.createdAt?.toISOString() || new Date().toISOString()
      };
    });
    
    const recentPayables = await Promise.all(recentPayablesPromises);

    return { success: true, data: recentPayables };

  } catch {
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

  } catch {
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

  } catch {
    return { success: false, error: 'Failed to fetch organization info' };
  }
}
