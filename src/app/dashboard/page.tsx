'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Users,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  AlertTriangle
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalClients: number;
  // Unified financial stats (receivables = invoices, payables = bills)
  netBalance: number;
  totalPayables: number;
  overdueCount: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalClients: 0,
    netBalance: 0,
    totalPayables: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch real data from API - get stats from the invoices API
        const [invoicesResponse, clientsResponse, ledgerResponse] = await Promise.all([
          fetch('/api/invoices?convertToPreferred=true'),
          fetch('/api/clients'),
          fetch('/api/ledger')
        ]);

        const invoicesData = await invoicesResponse.json();
        const clientsData = await clientsResponse.json();
        const ledgerData = await ledgerResponse.json();

        const clients = clientsData.success ? clientsData.data : [];
        
        // Use total revenue from API stats (includes all invoices, not just paginated ones)
        const totalRevenue = invoicesData.success ? invoicesData.data.stats?.totalRevenue || 0 : 0;
        
        // Get correct counts from the API stats (these are calculated from total count, not paginated results)
        const statusCounts = invoicesData.success ? invoicesData.data.stats?.statusCounts || {} : {};
        const pendingInvoices = (statusCounts.sent || 0) + (statusCounts.pending || 0);
        const paidInvoices = statusCounts.paid || 0;
        

        const totalExpenses = 0; // Will be implemented when expenses service is ready

        // Get unified financial stats from ledger
        const ledgerStats = ledgerData.success ? ledgerData.data.stats : null;

        setStats({
          totalRevenue,
          totalExpenses,
          pendingInvoices,
          paidInvoices,
          totalClients: clients.length,
          // Net balance = receivables (invoices) - payables (bills)
          netBalance: totalRevenue - (ledgerStats?.totalPayablesAmount || 0),
          totalPayables: ledgerStats?.totalPayablesAmount || 0,
          overdueCount: (ledgerStats?.overdueReceivables || 0) + (ledgerStats?.overduePayables || 0)
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-blue-200">Welcome back, {session?.user?.name || 'User'}!</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-white/20 rounded mb-4"></div>
              <div className="h-8 bg-white/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Welcome back, {session?.user?.name || 'User'}!</p>
        </div>
        <div className="text-right">
            <p className="text-sm text-gray-500">Last updated</p>
            <p className="text-sm text-gray-900">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Financial Overview - Minimalistic Request Finance Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Balance - Primary metric */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Net Balance</p>
              <p className={`text-3xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.netBalance >= 0 ? '+' : ''}
                <FormattedNumberDisplay value={Math.abs(stats.netBalance)} />
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stats.netBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {stats.netBalance >= 0 ? 
                <TrendingUp className="h-6 w-6 text-green-600" /> : 
                <TrendingDown className="h-6 w-6 text-red-600" />
              }
            </div>
          </div>
        </div>

        {/* Receivables (Invoices) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Receivables</p>
              <p className="text-2xl font-bold text-green-600">
                <FormattedNumberDisplay value={stats.totalRevenue} />
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.pendingInvoices} pending invoices</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <ArrowUpRight className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Payables (Bills) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Payables</p>
              <p className="text-2xl font-bold text-red-600">
                <FormattedNumberDisplay value={stats.totalPayables} />
              </p>
              <p className="text-xs text-gray-500 mt-1">Bills to pay</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowDownLeft className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
        </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => router.push('/dashboard/services/smart-invoicing/create')}
              className="flex items-center space-x-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="h-5 w-5" />
              <span>Create Invoice</span>
            </button>
            <button
              onClick={() => router.push('/dashboard/services/payables/create')}
              className="flex items-center space-x-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Receipt className="h-5 w-5" />
              <span>Create Payable</span>
            </button>
          </div>
        </div>

        {/* Alerts & Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
          <div className="space-y-3">
            {stats.overdueCount > 0 ? (
              <div className="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-orange-600 font-medium">{stats.overdueCount} overdue items</p>
                  <p className="text-orange-500 text-sm">Need immediate attention</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-green-600 font-medium">All up to date</p>
                  <p className="text-green-500 text-sm">No overdue items</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-blue-600 font-medium">{stats.totalClients} clients</p>
                  <p className="text-blue-500 text-sm">Active relationships</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            View all
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 text-sm font-medium">Smart Invoicing service active</p>
              <p className="text-gray-500 text-xs">Service • Just now</p>
            </div>
            <span className="text-green-600 text-sm font-medium">Active</span>
          </div>
          
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 text-sm font-medium">Account created</p>
              <p className="text-gray-500 text-xs">System • {new Date().toLocaleDateString()}</p>
            </div>
            <span className="text-blue-600 text-sm font-medium">Welcome!</span>
          </div>
        </div>
      </div>
    </div>
  );
} 