'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Users
} from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoices: number;
  paidInvoices: number;
  totalClients: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalClients: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch real data from API
        const [invoicesResponse, clientsResponse] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/clients')
        ]);

        const invoicesData = await invoicesResponse.json();
        const clientsData = await clientsResponse.json();

        // Calculate real stats
        const invoices = invoicesData.success ? invoicesData.data.invoices || [] : [];
        const clients = clientsData.success ? clientsData.data : [];

        const totalRevenue = invoices
          .filter((inv: { status: string; totalAmount?: number }) => inv.status === 'paid')
          .reduce((sum: number, inv: { totalAmount?: number }) => sum + (inv.totalAmount || 0), 0);

        const totalExpenses = 0; // Will be implemented when expenses service is ready

        const pendingInvoices = invoices.filter((inv: { status: string }) => inv.status === 'pending').length;
        const paidInvoices = invoices.filter((inv: { status: string }) => inv.status === 'paid').length;

        setStats({
          totalRevenue,
          totalExpenses,
          pendingInvoices,
          paidInvoices,
          totalClients: clients.length
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-blue-200">Welcome back, {session?.user?.name || 'User'}!</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-blue-200">Last updated</p>
          <p className="text-sm text-white">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total Expenses</p>
              <p className="text-2xl font-bold text-white">${stats.totalExpenses.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Pending Invoices</p>
              <p className="text-2xl font-bold text-white">{stats.pendingInvoices}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <FileText className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Total Clients</p>
              <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
            View all
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FileText className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Smart Invoicing service active</p>
              <p className="text-blue-200 text-xs">Service • Just now</p>
            </div>
            <span className="text-green-400 text-sm font-medium">Active</span>
          </div>
          
          <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Account created</p>
              <p className="text-blue-200 text-xs">System • {new Date().toLocaleDateString()}</p>
            </div>
            <span className="text-blue-400 text-sm font-medium">Welcome!</span>
          </div>
        </div>
      </div>
    </div>
  );
} 