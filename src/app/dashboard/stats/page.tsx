'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText, 
  Receipt,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { getStatsData, getPaymentAuditData, getTransactionGraphData } from '@/lib/actions/stats';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface StatsData {
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

interface PaymentAudit {
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

interface TransactionGraphData {
  labels: string[];
  revenue: number[];
  expenses: number[];
  netBalance: number[];
}

export default function StatsPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [auditData, setAuditData] = useState<PaymentAudit[]>([]);
  const [graphData, setGraphData] = useState<TransactionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStatsData = async () => {
      if (!session?.user?.email) return;

      try {
        setLoading(true);
        setError(null);

        const [statsResult, auditResult, graphResult] = await Promise.all([
          getStatsData(),
          getPaymentAuditData(),
          getTransactionGraphData()
        ]);

        if (statsResult.success) {
          setStats(statsResult.data);
        }

        if (auditResult.success) {
          setAuditData(auditResult.data);
        }

        if (graphResult.success) {
          setGraphData(graphResult.data);
        }
      } catch (err) {
        console.error('Error loading stats data:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStatsData();
  }, [session?.user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/20 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-6">
                  <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-white/20 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <div className="text-red-400 text-lg font-medium mb-2">Error Loading Statistics</div>
            <div className="text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-purple-400" />
            Financial Statistics
          </h1>
          <p className="text-slate-300">Comprehensive view of your financial performance and transaction history</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Net Balance */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Net Balance</p>
                <p className={`text-2xl font-bold ${stats?.netBalance && stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats?.netBalance && stats.netBalance >= 0 ? '+' : ''}
                  <FormattedNumberDisplay value={Math.abs(stats?.netBalance || 0)} />
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stats?.netBalance && stats.netBalance >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {stats?.netBalance && stats.netBalance >= 0 ? 
                  <TrendingUp className="h-6 w-6 text-green-400" /> : 
                  <TrendingDown className="h-6 w-6 text-red-400" />
                }
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  <FormattedNumberDisplay value={stats?.totalRevenue || 0} />
                </p>
                <p className="text-xs text-slate-400 mt-1">{stats?.paidInvoices || 0} paid invoices</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <ArrowUpRight className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-400">
                  <FormattedNumberDisplay value={stats?.totalExpenses || 0} />
                </p>
                <p className="text-xs text-slate-400 mt-1">{stats?.paidPayables || 0} paid bills</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <ArrowDownLeft className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>

          {/* Active Transactions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Active Transactions</p>
                <p className="text-2xl font-bold text-blue-400">
                  {(stats?.pendingInvoices || 0) + (stats?.pendingPayables || 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Pending items</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue vs Expenses Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Monthly Revenue vs Expenses
            </h3>
            <div className="h-64 flex items-center justify-center">
              <div className="text-slate-400 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chart visualization coming soon</p>
                <p className="text-sm">Data: {stats?.monthlyRevenue?.length || 0} months</p>
              </div>
            </div>
          </div>

          {/* Payment Methods Distribution */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              Payment Methods
            </h3>
            <div className="space-y-3">
              {stats?.paymentMethods?.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-blue-400' : 
                      index === 1 ? 'bg-green-400' : 
                      index === 2 ? 'bg-purple-400' : 'bg-orange-400'
                    }`}></div>
                    <span className="text-slate-300 capitalize">{method.method}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">
                      <FormattedNumberDisplay value={method.amount} />
                    </div>
                    <div className="text-xs text-slate-400">{method.count} transactions</div>
                  </div>
                </div>
              )) || (
                <div className="text-slate-400 text-center py-8">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No payment method data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Top Clients by Revenue
          </h3>
          <div className="space-y-3">
            {stats?.topClients?.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <span className="text-purple-400 font-medium text-sm">#{index + 1}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{client.name}</div>
                    <div className="text-xs text-slate-400">{client.count} invoices</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">
                    <FormattedNumberDisplay value={client.amount} />
                  </div>
                </div>
              </div>
            )) || (
              <div className="text-slate-400 text-center py-8">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No client data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Audit Trail */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Recent Payment Activity
          </h3>
          <div className="space-y-3">
            {auditData?.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    payment.type === 'invoice_payment' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {payment.type === 'invoice_payment' ? 
                      <FileText className="h-4 w-4 text-green-400" /> : 
                      <Receipt className="h-4 w-4 text-red-400" />
                    }
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {payment.type === 'invoice_payment' ? 'Invoice Payment' : 'Bill Payment'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {payment.from} → {payment.to}
                    </div>
                    <div className="text-xs text-slate-500">
                      {payment.invoiceNumber || payment.payableNumber} • {new Date(payment.paymentDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${
                    payment.type === 'invoice_payment' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {payment.type === 'invoice_payment' ? '+' : '-'}
                    <FormattedNumberDisplay value={payment.amount} />
                  </div>
                  <div className="text-xs text-slate-400 capitalize">{payment.status}</div>
                </div>
              </div>
            )) || (
              <div className="text-slate-400 text-center py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No payment activity found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
