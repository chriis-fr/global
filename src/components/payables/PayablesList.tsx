'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Eye, Edit3, Plus } from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { getPayablesListPaginated } from '@/app/actions/payable-actions';

interface Payable {
  _id: string;
  payableNumber: string;
  companyName?: string;
  vendorName: string;
  vendorCompany?: string;
  vendorEmail: string;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  dueDate: string;
  issueDate: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface PayablesListProps {
  onCreatePayable: () => void;
}

function PayablesListContent({ onCreatePayable }: PayablesListProps) {
  const router = useRouter();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayablesCount, setTotalPayablesCount] = useState(0);
  const limit = 6;

  const loadPayables = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const result = await getPayablesListPaginated(page, limit);
      
      if (result.success && result.data) {
        setPayables(result.data.payables.slice(0, limit));
        setTotalPages(result.data.pagination?.pages || 1);
        setTotalPayablesCount(result.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error loading payables:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadPayables(currentPage);
  }, [currentPage, loadPayables]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-blue-300 bg-blue-500/20';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-blue-300 bg-blue-500/20';
    }
  };

  if (loading && payables.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg animate-pulse">
            <div className="h-4 bg-white/20 rounded w-32"></div>
            <div className="h-4 bg-white/20 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (payables.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No bills yet</h3>
        <p className="text-blue-200 mb-6">Get started by adding your first bill or invoice.</p>
        <button
          onClick={onCreatePayable}
          className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95"
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Bill</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Bills & Invoices</h3>
        <button
          onClick={onCreatePayable}
          className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95"
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Bill</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
      
      <div className="space-y-4">
        {payables.map((payable) => (
          <div key={payable._id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {payable.companyName || payable.vendorCompany || payable.vendorName}
                  </p>
                  <p className="text-sm text-blue-300">#{payable.payableNumber}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(payable.status)}`}>
                  {payable.status}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  <FormattedNumberDisplay value={payable.total} />
                </p>
                <p className="text-sm text-blue-300">{payable.currency}</p>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => router.push(`/dashboard/services/payables/${payable._id}`)}
                  className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50 touch-manipulation active:scale-95"
                  style={{ touchAction: 'manipulation' }}
                  title="View Bill"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {payable.status === 'draft' && (
                  <button
                    onClick={() => router.push(`/dashboard/services/payables/create?id=${payable._id}`)}
                    className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-lg hover:bg-blue-50 touch-manipulation active:scale-95"
                    style={{ touchAction: 'manipulation' }}
                    title="Edit Bill"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Pagination Controls */}
        {totalPayablesCount > limit && (
          <div className="flex items-center justify-between pt-6 border-t border-white/20">
            <div className="text-sm text-blue-200">
              Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalPayablesCount)} of {totalPayablesCount} bills
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const newPage = currentPage - 1;
                  if (newPage >= 1) {
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                Previous
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation active:scale-95 ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-white bg-white/10 hover:bg-white/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  const newPage = currentPage + 1;
                  if (newPage <= totalPages) {
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PayablesList({ onCreatePayable }: PayablesListProps) {
  return (
    <PayablesListContent onCreatePayable={onCreatePayable} />
  );
}

