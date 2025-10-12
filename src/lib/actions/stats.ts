'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

export interface StatsData {
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  totalInvoices: number;
  totalPayables: number;
  paidInvoices: number;
  paidPayables: number;
  pendingInvoices: number;
  pendingPayables: number;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  monthlyExpenses: Array<{ month: string; amount: number }>;
  topClients: Array<{ name: string; amount: number; count: number }>;
  paymentMethods: Array<{ method: string; count: number; amount: number }>;
}

export interface PaymentAudit {
  _id: string;
  type: 'invoice_payment' | 'payable_payment';
  amount: number;
  currency: string;
  from: string;
  to: string;
  status: string;
  paymentDate: string;
  description: string;
  invoiceNumber?: string;
  payableNumber?: string;
}

export interface TransactionGraphData {
  labels: string[];
  revenue: number[];
  expenses: number[];
  netBalance: number[];
}

// Helper to get base query for user/organization
const getBaseQuery = (session: any) => {
  const isOrganization = !!session.user.organizationId;
  return isOrganization
    ? { organizationId: session.user.organizationId }
    : {
        $or: [
          { issuerId: session.user.id },
          { userId: session.user.email }
        ]
      };
};

export async function getStatsData(): Promise<{ success: boolean; data?: StatsData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const payablesCollection = db.collection('payables');
    const ledgerCollection = db.collection('financial_ledger');

    const baseQuery = getBaseQuery(session);

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;

    // Get invoice statistics
    const [totalInvoices, paidInvoices, pendingInvoices] = await Promise.all([
      invoicesCollection.countDocuments(baseQuery),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: { $in: ['sent', 'pending', 'approved'] } })
    ]);

    // Get payable statistics
    const [totalPayables, paidPayables, pendingPayables] = await Promise.all([
      payablesCollection.countDocuments(baseQuery),
      payablesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      payablesCollection.countDocuments({ ...baseQuery, status: { $in: ['pending', 'pending_approval', 'approved'] } })
    ]);

    // Get revenue data (paid invoices)
    const paidInvoicesData = await invoicesCollection.find({ ...baseQuery, status: 'paid' }).toArray();
    const totalRevenue = await CurrencyService.calculateTotalRevenue(paidInvoicesData as { [key: string]: unknown }[], preferredCurrency);

    // Get expenses data (paid payables)
    const paidPayablesData = await payablesCollection.find({ ...baseQuery, status: 'paid' }).toArray();
    const totalExpenses = paidPayablesData.reduce((sum, payable) => sum + (payable.total || payable.amount || 0), 0);

    // Calculate net balance
    const netBalance = totalRevenue - totalExpenses;

    // Get monthly revenue data (last 12 months)
    const monthlyRevenue = await getMonthlyData(invoicesCollection, baseQuery, 'paid', preferredCurrency);

    // Get monthly expenses data (last 12 months)
    const monthlyExpenses = await getMonthlyData(payablesCollection, baseQuery, 'paid', preferredCurrency);

    // Get top clients
    const topClients = await getTopClients(invoicesCollection, baseQuery, preferredCurrency);

    // Get payment methods distribution
    const paymentMethods = await getPaymentMethodsDistribution(invoicesCollection, payablesCollection, baseQuery, preferredCurrency);

    const stats: StatsData = {
      totalRevenue,
      totalExpenses,
      netBalance,
      totalInvoices,
      totalPayables,
      paidInvoices,
      paidPayables,
      pendingInvoices,
      pendingPayables,
      monthlyRevenue,
      monthlyExpenses,
      topClients,
      paymentMethods
    };

    return { success: true, data: stats };

  } catch (error) {
    console.error('Error fetching stats data:', error);
    return { success: false, error: 'Failed to fetch statistics' };
  }
}

export async function getPaymentAuditData(): Promise<{ success: boolean; data?: PaymentAudit[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const payablesCollection = db.collection('payables');

    const baseQuery = getBaseQuery(session);

    // Get paid invoices
    const paidInvoices = await invoicesCollection.find({ 
      ...baseQuery, 
      status: 'paid',
      paidAt: { $exists: true }
    }).sort({ paidAt: -1 }).limit(20).toArray();

    // Get paid payables
    const paidPayables = await payablesCollection.find({ 
      ...baseQuery, 
      status: 'paid',
      paymentDate: { $exists: true }
    }).sort({ paymentDate: -1 }).limit(20).toArray();

    // Combine and format audit data
    const auditData: PaymentAudit[] = [
      ...paidInvoices.map(invoice => ({
        _id: invoice._id.toString(),
        type: 'invoice_payment' as const,
        amount: invoice.total || 0,
        currency: invoice.currency || 'USD',
        from: invoice.client?.name || invoice.clientEmail || 'Unknown',
        to: invoice.companyName || 'Your Company',
        status: 'completed',
        paymentDate: invoice.paidAt?.toISOString() || invoice.updatedAt?.toISOString() || '',
        description: `Invoice ${invoice.invoiceNumber} payment`,
        invoiceNumber: invoice.invoiceNumber
      })),
      ...paidPayables.map(payable => ({
        _id: payable._id.toString(),
        type: 'payable_payment' as const,
        amount: payable.total || payable.amount || 0,
        currency: payable.currency || 'USD',
        from: 'Your Company',
        to: payable.vendorName || 'Unknown Vendor',
        status: 'completed',
        paymentDate: payable.paymentDate?.toISOString() || payable.updatedAt?.toISOString() || '',
        description: `Bill ${payable.payableNumber} payment`,
        payableNumber: payable.payableNumber
      }))
    ].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).slice(0, 20);

    return { success: true, data: auditData };

  } catch (error) {
    console.error('Error fetching payment audit data:', error);
    return { success: false, error: 'Failed to fetch payment audit data' };
  }
}

export async function getTransactionGraphData(): Promise<{ success: boolean; data?: TransactionGraphData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const payablesCollection = db.collection('payables');

    const baseQuery = getBaseQuery(session);

    // Get last 12 months data
    const labels: string[] = [];
    const revenue: number[] = [];
    const expenses: number[] = [];
    const netBalance: number[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      labels.push(monthLabel);

      // Get revenue for this month
      const monthInvoices = await invoicesCollection.find({
        ...baseQuery,
        status: 'paid',
        paidAt: { $gte: startOfMonth, $lte: endOfMonth }
      }).toArray();

      const monthRevenue = monthInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
      revenue.push(monthRevenue);

      // Get expenses for this month
      const monthPayables = await payablesCollection.find({
        ...baseQuery,
        status: 'paid',
        paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
      }).toArray();

      const monthExpenses = monthPayables.reduce((sum, payable) => sum + (payable.total || payable.amount || 0), 0);
      expenses.push(monthExpenses);

      // Calculate net balance
      netBalance.push(monthRevenue - monthExpenses);
    }

    const graphData: TransactionGraphData = {
      labels,
      revenue,
      expenses,
      netBalance
    };

    return { success: true, data: graphData };

  } catch (error) {
    console.error('Error fetching transaction graph data:', error);
    return { success: false, error: 'Failed to fetch transaction graph data' };
  }
}

// Helper functions
async function getMonthlyData(collection: any, baseQuery: any, status: string, preferredCurrency: string) {
  const monthlyData: Array<{ month: string; amount: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const monthData = await collection.find({
      ...baseQuery,
      status,
      ...(status === 'paid' ? { paidAt: { $gte: startOfMonth, $lte: endOfMonth } } : {})
    }).toArray();

    const monthAmount = monthData.reduce((sum: number, item: any) => sum + (item.total || item.amount || 0), 0);
    monthlyData.push({ month: monthLabel, amount: monthAmount });
  }

  return monthlyData;
}

async function getTopClients(collection: any, baseQuery: any, preferredCurrency: string) {
  const pipeline = [
    { $match: { ...baseQuery, status: 'paid' } },
    {
      $group: {
        _id: '$client.name',
        totalAmount: { $sum: '$total' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 10 }
  ];

  const result = await collection.aggregate(pipeline).toArray();

  return result.map((item: any) => ({
    name: item._id || 'Unknown Client',
    amount: item.totalAmount || 0,
    count: item.count || 0
  }));
}

async function getPaymentMethodsDistribution(invoicesCollection: any, payablesCollection: any, baseQuery: any, preferredCurrency: string) {
  const methods: { [key: string]: { count: number; amount: number } } = {};

  // Get invoice payment methods
  const invoices = await invoicesCollection.find({ ...baseQuery, status: 'paid' }).toArray();
  invoices.forEach((invoice: any) => {
    const method = invoice.paymentMethod || 'unknown';
    if (!methods[method]) {
      methods[method] = { count: 0, amount: 0 };
    }
    methods[method].count++;
    methods[method].amount += invoice.total || 0;
  });

  // Get payable payment methods
  const payables = await payablesCollection.find({ ...baseQuery, status: 'paid' }).toArray();
  payables.forEach((payable: any) => {
    const method = payable.paymentMethod || 'unknown';
    if (!methods[method]) {
      methods[method] = { count: 0, amount: 0 };
    }
    methods[method].count++;
    methods[method].amount += payable.total || payable.amount || 0;
  });

  return Object.entries(methods).map(([method, data]) => ({
    method,
    count: data.count,
    amount: data.amount
  })).sort((a, b) => b.amount - a.amount);
}
