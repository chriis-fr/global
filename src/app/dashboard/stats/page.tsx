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
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getStatsData, getPaymentAuditData, getTransactionGraphData } from '@/lib/actions/stats';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import BarChart from '@/components/charts/BarChart';

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
  
  // Pagination states for large datasets
  const [topClientsPage, setTopClientsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [paymentMethodsPage, setPaymentMethodsPage] = useState(1);
  
  const itemsPerPage = 5;

  // Pagination helper functions
  const getPaginatedData = <T,>(data: T[], page: number, itemsPerPage: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number, itemsPerPage: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    totalItems 
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalItems: number;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
        <div className="text-sm text-slate-400">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-300 px-3">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

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
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium px-2 py-1 rounded-full">
              BETA
            </span>
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
            <div className="h-64">
              {stats?.monthlyRevenue && stats.monthlyExpenses && (
                <BarChart
                  data={{
                    labels: stats.monthlyRevenue.map(item => item.month),
                    datasets: [
                      {
                        label: 'Revenue',
                        data: stats.monthlyRevenue.map(item => item.amount),
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        borderColor: 'rgba(34, 197, 94, 1)'
                      },
                      {
                        label: 'Expenses',
                        data: stats.monthlyExpenses.map(item => item.amount),
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                        borderColor: 'rgba(239, 68, 68, 1)'
                      }
                    ]
                  }}
                  height={180}
                />
              )}
              {(!stats?.monthlyRevenue || !stats?.monthlyExpenses) && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-slate-400 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods Distribution */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              Payment Methods
            </h3>
            <div className="space-y-3">
              {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                <>
                  {getPaginatedData(stats.paymentMethods, paymentMethodsPage, itemsPerPage).map((method, index) => {
                    const globalIndex = (paymentMethodsPage - 1) * itemsPerPage + index;
                    return (
                      <div key={globalIndex} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            globalIndex === 0 ? 'bg-blue-400' : 
                            globalIndex === 1 ? 'bg-green-400' : 
                            globalIndex === 2 ? 'bg-purple-400' : 'bg-orange-400'
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
                    );
                  })}
                  <PaginationControls
                    currentPage={paymentMethodsPage}
                    totalPages={getTotalPages(stats.paymentMethods.length, itemsPerPage)}
                    onPageChange={setPaymentMethodsPage}
                    totalItems={stats.paymentMethods.length}
                  />
                </>
              ) : (
                <div className="text-slate-400 text-center py-8">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No payment method data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Trends Chart */}
        {graphData && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" />
              Transaction Trends (Last 12 Months)
            </h3>
            <div className="h-64">
              <BarChart
                data={{
                  labels: graphData.labels,
                  datasets: [
                    {
                      label: 'Revenue',
                      data: graphData.revenue,
                      backgroundColor: 'rgba(34, 197, 94, 0.6)',
                      borderColor: 'rgba(34, 197, 94, 1)'
                    },
                    {
                      label: 'Expenses',
                      data: graphData.expenses,
                      backgroundColor: 'rgba(239, 68, 68, 0.6)',
                      borderColor: 'rgba(239, 68, 68, 1)'
                    },
                    {
                      label: 'Net Balance',
                      data: graphData.netBalance,
                      backgroundColor: 'rgba(59, 130, 246, 0.6)',
                      borderColor: 'rgba(59, 130, 246, 1)'
                    }
                  ]
                }}
                height={180}
              />
            </div>
          </div>
        )}

        {/* Top Clients */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Top Clients by Revenue
          </h3>
          <div className="space-y-3">
            {stats?.topClients && stats.topClients.length > 0 ? (
              <>
                {getPaginatedData(stats.topClients, topClientsPage, itemsPerPage).map((client, index) => {
                  const globalIndex = (topClientsPage - 1) * itemsPerPage + index;
                  return (
                    <div key={globalIndex} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-purple-400 font-medium text-sm">#{globalIndex + 1}</span>
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
                  );
                })}
                <PaginationControls
                  currentPage={topClientsPage}
                  totalPages={getTotalPages(stats.topClients.length, itemsPerPage)}
                  onPageChange={setTopClientsPage}
                  totalItems={stats.topClients.length}
                />
              </>
            ) : (
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
            {auditData && auditData.length > 0 ? (
              <>
                {getPaginatedData(auditData, auditPage, itemsPerPage).map((payment, index) => (
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
                ))}
                <PaginationControls
                  currentPage={auditPage}
                  totalPages={getTotalPages(auditData.length, itemsPerPage)}
                  onPageChange={setAuditPage}
                  totalItems={auditData.length}
                />
              </>
            ) : (
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
