'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  FileText, 
  DollarSign,
  Loader2,
  ArrowUp,
  CheckCircle,
  XCircle,
  UserCheck
} from 'lucide-react';

interface AdminStats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    active: number;
    byPlan: Array<{ planId: string; count: number }>;
    onboarding: {
      completed: number;
      pending: number;
    };
    growth: Array<{ period: string; count: number }>;
  };
  invoices: {
    total: number;
    today: number;
    thisMonth: number;
    paid: number;
    unpaid: number;
  };
  payables: {
    total: number;
    thisMonth: number;
    paid: number;
  };
  organizations: {
    total: number;
    thisMonth: number;
  };
  revenue: {
    total: number;
    transactions: number;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  adminTag: boolean;
  role: string;
  userType: string;
  createdAt: string;
  lastLogin?: string;
  isEmailVerified: boolean;
  planId: string;
  subscriptionStatus: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  organizationId?: string;
  services: {
    smartInvoicing: boolean;
    accountsReceivable: boolean;
    accountsPayable: boolean;
  };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  // Check authentication and admin access
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth');
      return;
    }

    if (!session?.user?.adminTag) {
      router.push('/dashboard');
      return;
    }

    loadStats();
    loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        cache: 'no-store'
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        console.error('Failed to load stats:', data.message);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (page: number) => {
    setUsersLoading(true);
    try {
      const response = await fetch(`/api/admin/users?page=${page}&limit=50`, {
        cache: 'no-store'
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
        setUsersTotal(data.data.pagination.total);
        setUsersPage(page);
      } else {
        console.error('Failed to load users:', data.message);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session?.user?.adminTag) {
    return null; // Will redirect
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-gray-600">Failed to load admin statistics</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">System overview and user management</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  loadStats();
                  loadUsers(usersPage);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                title="Refresh data"
              >
                <ArrowUp className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.users.total.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">{stats.users.thisMonth} this month</span>
                </div>
              </div>
              <Users className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users (30d)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.users.active.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <UserCheck className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-gray-600">{((stats.users.active / stats.users.total) * 100).toFixed(1)}% active</span>
                </div>
              </div>
              <UserCheck className="h-12 w-12 text-green-500" />
            </div>
          </div>

          {/* Total Invoices */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.invoices.total.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-gray-600">{stats.invoices.thisMonth} this month</span>
                </div>
              </div>
              <FileText className="h-12 w-12 text-purple-500" />
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.revenue.total)}</p>
                <div className="flex items-center mt-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-gray-600">{stats.revenue.transactions} transactions</span>
                </div>
              </div>
              <DollarSign className="h-12 w-12 text-green-500" />
            </div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* User Growth */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Growth</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Today</span>
                <span className="font-semibold">{stats.users.today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Week</span>
                <span className="font-semibold">{stats.users.thisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month</span>
                <span className="font-semibold">{stats.users.thisMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Year</span>
                <span className="font-semibold">{stats.users.thisYear}</span>
              </div>
            </div>
          </div>

          {/* Onboarding Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Onboarding Status</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-gray-600">Completed</span>
                </div>
                <span className="font-semibold">{stats.users.onboarding.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-gray-600">Pending</span>
                </div>
                <span className="font-semibold">{stats.users.onboarding.pending}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(stats.users.onboarding.completed / stats.users.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {((stats.users.onboarding.completed / stats.users.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Users by Plan */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Users by Plan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.users.byPlan.map((plan) => (
              <div key={plan.planId} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{plan.planId || 'Unknown'}</p>
                <p className="text-2xl font-bold text-gray-900">{plan.count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">All Users</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadUsers(usersPage - 1)}
                  disabled={usersPage === 1 || usersLoading}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {usersPage} of {Math.ceil(usersTotal / 50)}
                </span>
                <button
                  onClick={() => loadUsers(usersPage + 1)}
                  disabled={usersPage >= Math.ceil(usersTotal / 50) || usersLoading}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          {usersLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            {user.adminTag && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{user.planId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.onboardingCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Step {user.onboardingStep}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscriptionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

