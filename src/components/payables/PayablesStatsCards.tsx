'use client';

import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Clock, CheckCircle, DollarSign } from 'lucide-react';
import FormattedNumberDisplay from '@/components/FormattedNumber';
import { getPayablesStats } from '@/app/actions/payable-actions';

interface PayableStats {
  totalPayables: number;
  pendingCount: number;
  paidCount: number;
  totalAmount: number;
}

function StatsCardsContent() {
  const [stats, setStats] = useState<PayableStats>({
    totalPayables: 0,
    pendingCount: 0,
    paidCount: 0,
    totalAmount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load stats independently - doesn't block page render
    getPayablesStats().then(result => {
      if (result.success && result.data) {
        setStats({
          totalPayables: result.data.totalPayables || 0,
          pendingCount: (result.data.statusCounts?.pending || 0) + (result.data.statusCounts?.approved || 0),
          paidCount: result.data.statusCounts?.paid || 0,
          totalAmount: result.data.totalAmount || 0
        });
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
            <div className="h-4 bg-white/20 rounded w-24 mb-2"></div>
            <div className="h-8 bg-white/20 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Total Payables</p>
            <p className="text-2xl font-bold text-white">{stats.totalPayables}</p>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <Receipt className="h-6 w-6 text-blue-400" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pendingCount}</p>
          </div>
          <div className="p-3 bg-yellow-500/20 rounded-lg">
            <Clock className="h-6 w-6 text-yellow-400" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Paid</p>
            <p className="text-2xl font-bold text-green-400">{stats.paidCount}</p>
          </div>
          <div className="p-3 bg-green-500/20 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-400" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">Total Amount</p>
            <p className="text-2xl font-bold text-white">
              <FormattedNumberDisplay value={stats.totalAmount} />
            </p>
          </div>
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <DollarSign className="h-6 w-6 text-blue-400" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function PayablesStatsCards() {
  return (
    <Suspense fallback={
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
            <div className="h-4 bg-white/20 rounded w-24 mb-2"></div>
            <div className="h-8 bg-white/20 rounded w-16"></div>
          </div>
        ))}
      </div>
    }>
      <StatsCardsContent />
    </Suspense>
  );
}

