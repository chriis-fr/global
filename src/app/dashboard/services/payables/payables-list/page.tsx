'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Receipt, 
  Search,
  Filter,
  Eye,
  Edit,
  ArrowLeft,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  DollarSign
} from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';

interface Payable {
  _id: string;
  payableNumber: string;
  payableName: string;
  vendorName: string;
  vendorEmail: string;
  vendorCompany?: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

interface PayableStats {
  totalPayables: number;
  pendingCount: number;
  paidCount: number;
  totalAmount: number;
  overdueCount: number;
}

const PAYABLE_STATUSES = [
  { value: 'all', label: 'All Status', color: 'text-gray-600' },
  { value: 'draft', label: 'Draft', color: 'text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-600' },
  { value: 'approved', label: 'Approved', color: 'text-blue-600' },
  { value: 'paid', label: 'Paid', color: 'text-green-600' },
  { value: 'overdue', label: 'Overdue', color: 'text-red-600' }
];

const PAYABLE_CATEGORIES = [
  'All Categories',
  'Office Supplies',
  'Software & Services',
  'Marketing & Advertising',
  'Travel & Entertainment',
  'Professional Services',
  'Utilities',
  'Rent & Facilities',
  'Equipment & Hardware',
  'Training & Development',
  'Legal & Compliance',
  'Insurance',
  'Other'
];

const PAYABLE_PRIORITIES = [
  { value: 'all', label: 'All Priorities', color: 'text-gray-600' },
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-red-600' }
];

export default function PayablesListPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [payables, setPayables] = useState<Payable[]>([]);
  const [stats, setStats] = useState<PayableStats>({
    totalPayables: 0,
    pendingCount: 0,
    paidCount: 0,
    totalAmount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPayables, setSelectedPayables] = useState<string[]>([]);

  // Load payables data
  const loadPayables = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/payables?convertToPreferred=false'); // Keep original amounts
      const data = await response.json();
      
      if (data.success) {
        setPayables(data.data.payables || []);
        setStats(data.data.stats || {
          totalPayables: 0,
          pendingCount: 0,
          paidCount: 0,
          totalAmount: 0,
          overdueCount: 0
        });
      }
    } catch (error) {
      console.error('Error loading payables:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    loadPayables();
  }, [loadPayables]);

  // Filter payables based on search and filters
  const filteredPayables = payables.filter(payable => {
    const matchesSearch = payable.payableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payable.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payable.vendorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payable.payableNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payable.status === statusFilter;
    const matchesCategory = categoryFilter === 'All Categories' || payable.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || payable.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  const handleSelectPayable = (payableId: string) => {
    setSelectedPayables(prev => 
      prev.includes(payableId) 
        ? prev.filter(id => id !== payableId)
        : [...prev, payableId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPayables.length === filteredPayables.length) {
      setSelectedPayables([]);
    } else {
      setSelectedPayables(filteredPayables.map(p => p._id));
    }
  };

  const handleDeletePayable = async (payableId: string) => {
    if (!confirm('Are you sure you want to delete this payable?')) return;
    
    try {
      const response = await fetch(`/api/payables/${payableId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setPayables(prev => prev.filter(p => p._id !== payableId));
      }
    } catch (error) {
      console.error('Error deleting payable:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
      case 'approved':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'approved':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (dueDate: string, status: string) => {
    return status !== 'paid' && new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/services/payables?refresh=true')}
            className="p-2 text-blue-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Payables</h1>
            <p className="text-blue-200">
              Manage and track all your vendor payments and expenses
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
          >
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/dashboard/services/payables/create')}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Payable</span>
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Payables</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.totalPayables}
              </p>
            </div>
            <Receipt className="h-8 w-8 text-blue-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Total Amount</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : <FormattedNumberDisplay value={stats.totalAmount} usePreferredCurrency={true} />}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-red-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Pending</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.pendingCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Overdue</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats.overdueCount}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {PAYABLE_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {PAYABLE_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {PAYABLE_PRIORITIES.map(priority => (
                  <option key={priority.value} value={priority.value}>{priority.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPayables.length === filteredPayables.length && filteredPayables.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Payable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-white/70">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Loading payables...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-white/70">
                    <Receipt className="h-12 w-12 mx-auto mb-4 text-white/30" />
                    <p className="text-lg font-medium mb-2">No payables found</p>
                    <p className="text-sm">
                      {searchTerm || statusFilter !== 'all' || categoryFilter !== 'All Categories' || priorityFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Create your first payable to get started'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayables.map((payable, index) => (
                  <motion.tr
                    key={payable._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPayables.includes(payable._id)}
                        onChange={() => handleSelectPayable(payable._id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                          <Receipt className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {payable.payableNumber || 'PAY-' + payable._id.slice(-6)}
                          </div>
                          <div className="text-sm text-white/70">{payable.payableName}</div>
                          <div className="text-xs text-white/50">{payable.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {payable.vendorCompany || payable.vendorName}
                        </div>
                        <div className="text-sm text-white/70">{payable.vendorEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">
                        <FormattedNumberDisplay value={payable.amount} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${isOverdue(payable.dueDate, payable.status) ? 'text-red-400' : 'text-white/70'}`}>
                        {formatDate(payable.dueDate)}
                        {isOverdue(payable.dueDate, payable.status) && (
                          <div className="text-xs text-red-400">Overdue</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(payable.status)}
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(payable.status)}`}>
                          {payable.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${getPriorityColor(payable.priority)}`}>
                        {payable.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => router.push(`/dashboard/services/payables/${payable._id}`)}
                          className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/services/payables/create?id=${payable._id}`)}
                          className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePayable(payable._id)}
                          className="p-1 text-white/70 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedPayables.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-blue-200">
              {selectedPayables.length} payable{selectedPayables.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Export
              </button>
              <button className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
