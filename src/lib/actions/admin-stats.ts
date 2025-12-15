'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { convertCryptoToUsd } from '@/lib/services/exchangeRateService';

interface PlanCount {
  _id: string | null;
  count: number;
}

interface GrowthData {
  _id: {
    year: number;
    month: number;
  };
  count: number;
}

interface ChainTransaction {
  _id: string;
  txHash: string;
  chainId?: number;
  chainName?: string;
  amount: number; // Original crypto amount
  currency: string; // Original currency (e.g., CELO, USDT)
  amountUsd?: number; // Converted USD amount (if available)
  exchangeRate?: number; // Rate used for conversion
  type: 'invoice' | 'payable' | 'ledger';
  relatedId: string;
  createdAt: Date;
  status: string;
}

export interface AdminStats {
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
  chainTransactions: {
    total: number;
    celo: number;
    totalAmount: number;
    transactions: ChainTransaction[];
  };
}

/**
 * Get admin dashboard statistics (server action)
 * Only accessible to users with adminTag
 */
export async function getAdminStats(): Promise<{ 
  success: boolean; 
  data?: AdminStats; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    const now = new Date();
    // Fix: Create new Date objects instead of mutating
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // User statistics
    const totalUsers = await db.collection('users').countDocuments();
    const usersToday = await db.collection('users').countDocuments({
      createdAt: { $gte: startOfToday }
    });
    const usersThisWeek = await db.collection('users').countDocuments({
      createdAt: { $gte: startOfWeek }
    });
    const usersThisMonth = await db.collection('users').countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const usersThisYear = await db.collection('users').countDocuments({
      createdAt: { $gte: startOfYear }
    });

    // Users by plan
    const usersByPlanRaw = await db.collection('users').aggregate([
      {
        $group: {
          _id: '$subscription.planId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    const usersByPlan = (usersByPlanRaw as PlanCount[]).map((item) => ({
      planId: item._id || 'unknown',
      count: item.count
    }));

    // Users by onboarding status
    const completedOnboarding = await db.collection('users').countDocuments({
      $or: [
        { 'onboarding.isCompleted': true },
        { 'onboarding.currentStep': { $gte: 4 } }
      ]
    });
    const pendingOnboarding = totalUsers - completedOnboarding;

    // Invoice statistics
    const totalInvoices = await db.collection('invoices').countDocuments();
    const invoicesToday = await db.collection('invoices').countDocuments({
      createdAt: { $gte: startOfToday }
    });
    const invoicesThisMonth = await db.collection('invoices').countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const paidInvoices = await db.collection('invoices').countDocuments({
      status: 'paid'
    });
    const unpaidInvoices = await db.collection('invoices').countDocuments({
      status: { $in: ['pending', 'sent', 'viewed'] }
    });

    // Payable statistics
    const totalPayables = await db.collection('payables').countDocuments();
    const payablesThisMonth = await db.collection('payables').countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const paidPayables = await db.collection('payables').countDocuments({
      status: 'paid'
    });

    // Organization statistics
    const totalOrganizations = await db.collection('organizations').countDocuments();
    const organizationsThisMonth = await db.collection('organizations').countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Revenue statistics - calculate from paid invoices directly (more accurate)
    let invoiceRevenue = 0;
    let invoiceCount = 0;
    let ledgerRevenue = 0;
    let ledgerCount = 0;

    try {
      // Get all paid invoices and calculate revenue manually for better error handling
      const paidInvoices = await db.collection('invoices').find({
        status: 'paid'
      }, {
        projection: {
          total: 1,
          totalAmount: 1,
          amount: 1
        }
      }).toArray();

      invoiceCount = paidInvoices.length;
      invoiceRevenue = paidInvoices.reduce((sum, inv) => {
        const amount = inv.total || inv.totalAmount || inv.amount || 0;
        return sum + (typeof amount === 'number' ? amount : 0);
      }, 0);
    } catch (error) {
      console.error('Error calculating invoice revenue:', error);
    }

    // Also get from financial_ledger as backup (if collection exists)
    try {
      const ledgerEntries = await db.collection('financial_ledger').find({
        type: 'receivable',
        status: 'paid'
      }, {
        projection: {
          amount: 1
        }
      }).toArray();

      ledgerCount = ledgerEntries.length;
      ledgerRevenue = ledgerEntries.reduce((sum, entry) => {
        const amount = entry.amount || 0;
        return sum + (typeof amount === 'number' ? amount : 0);
      }, 0);
    } catch (error) {
      // Collection might not exist, continue without ledger revenue
      console.error('Error calculating ledger revenue (collection may not exist):', error);
    }

    // Use the higher value (invoices are more accurate, but ledger might have additional entries)
    const totalRevenue = Math.max(invoiceRevenue, ledgerRevenue);
    const revenueTransactions = Math.max(invoiceCount, ledgerCount);

    // Growth metrics (users over time)
    const userGrowthRaw = await db.collection('users').aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]).toArray();
    const userGrowth = (userGrowthRaw as GrowthData[]).map((item) => ({
      period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count
    }));

    // Active users (logged in within last 30 days)
    // Check both lastLogin and lastLoginAt fields since different parts of the code use different field names
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const activeUsers = await db.collection('users').countDocuments({
      $or: [
        { lastLogin: { $gte: thirtyDaysAgo, $exists: true } },
        { lastLoginAt: { $gte: thirtyDaysAgo, $exists: true } }
      ]
    });

    // Chain/Blockchain transactions
    // Get transactions from invoices with txHash
    const invoiceTransactions = await db.collection('invoices').find({
      txHash: { $exists: true, $ne: null },
      status: 'paid'
    }, {
      projection: {
        _id: 1,
        txHash: 1,
        chainId: 1,
        total: 1,
        totalAmount: 1,
        amount: 1,
        currency: 1,
        createdAt: 1,
        status: 1
      }
    }).toArray();

    // Get transactions from payables with txHash
    const payableTransactions = await db.collection('payables').find({
      txHash: { $exists: true, $ne: null },
      status: 'paid'
    }, {
      projection: {
        _id: 1,
        txHash: 1,
        chainId: 1,
        total: 1,
        totalAmount: 1,
        amount: 1,
        currency: 1,
        createdAt: 1,
        status: 1
      }
    }).toArray();

    // Get transactions from financial_ledger with transactionHash (if collection exists)
    let ledgerTransactions: Array<{
      _id: any;
      transactionHash: string;
      blockchainNetwork?: string;
      amount?: number;
      currency?: string;
      createdAt: Date | string;
      status: string;
      type?: string;
    }> = [];
    
    try {
      ledgerTransactions = await db.collection('financial_ledger').find({
        transactionHash: { $exists: true, $ne: null },
        status: 'paid'
      }, {
        projection: {
          _id: 1,
          transactionHash: 1,
          blockchainNetwork: 1,
          amount: 1,
          currency: 1,
          createdAt: 1,
          status: 1,
          type: 1
        }
      }).toArray();
    } catch (error) {
      // Collection might not exist, continue without ledger transactions
      console.error('Error fetching ledger transactions (collection may not exist):', error);
    }

    // Helper function to check if currency is crypto
    const isCryptoCurrency = (currency: string): boolean => {
      const cryptoCurrencies = ['CELO', 'ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'MATIC', 'BNB', 'AVAX'];
      return cryptoCurrencies.includes(currency.toUpperCase());
    };

    // Helper function to convert crypto to USD (with error handling)
    const convertToUsd = async (amount: number, currency: string): Promise<{ amountUsd: number; rate?: number }> => {
      // If already USD, return as is
      if (currency.toUpperCase() === 'USD') {
        return { amountUsd: amount };
      }

      // If not crypto, assume it's already in USD equivalent (for backward compatibility)
      if (!isCryptoCurrency(currency)) {
        return { amountUsd: amount };
      }

      try {
        const rate = await convertCryptoToUsd(1, currency);
        return { amountUsd: amount * rate, rate };
      } catch (error) {
        console.error(`Error converting ${currency} to USD:`, error);
        // Fallback: return 0 to avoid incorrect totals
        return { amountUsd: 0 };
      }
    };

    // Combine and format chain transactions with USD conversion
    const allChainTransactionsPromises = [
      ...invoiceTransactions.map(async (inv: {
        _id: any;
        txHash: string;
        chainId?: number;
        total?: number;
        totalAmount?: number;
        amount?: number;
        currency?: string;
        createdAt: Date | string;
        status: string;
      }) => {
        const chainId = inv.chainId;
        let chainName = 'Unknown';
        if (chainId === 42220) {
          chainName = 'Celo';
        } else if (chainId === 1) {
          chainName = 'Ethereum';
        } else if (chainId === 137) {
          chainName = 'Polygon';
        } else if (chainId === 56) {
          chainName = 'BSC';
        } else if (chainId === 43114) {
          chainName = 'Avalanche';
        } else if (chainId) {
          chainName = `Chain ${chainId}`;
        }
        
        const amount = inv.total || inv.totalAmount || inv.amount || 0;
        const currency = inv.currency || 'USD';
        const conversion = await convertToUsd(amount, currency);
        
        return {
          _id: inv._id.toString(),
          txHash: inv.txHash,
          chainId: chainId,
          chainName: chainName,
          amount: amount,
          currency: currency,
          amountUsd: conversion.amountUsd,
          exchangeRate: conversion.rate,
          type: 'invoice' as const,
          relatedId: inv._id.toString(),
          createdAt: inv.createdAt instanceof Date ? inv.createdAt : new Date(inv.createdAt),
          status: inv.status
        };
      }),
      ...payableTransactions.map(async (pay: {
        _id: any;
        txHash: string;
        chainId?: number;
        total?: number;
        totalAmount?: number;
        amount?: number;
        currency?: string;
        createdAt: Date | string;
        status: string;
      }) => {
        const chainId = pay.chainId;
        let chainName = 'Unknown';
        if (chainId === 42220) {
          chainName = 'Celo';
        } else if (chainId === 1) {
          chainName = 'Ethereum';
        } else if (chainId === 137) {
          chainName = 'Polygon';
        } else if (chainId === 56) {
          chainName = 'BSC';
        } else if (chainId === 43114) {
          chainName = 'Avalanche';
        } else if (chainId) {
          chainName = `Chain ${chainId}`;
        }
        
        const amount = pay.total || pay.totalAmount || pay.amount || 0;
        const currency = pay.currency || 'USD';
        const conversion = await convertToUsd(amount, currency);
        
        return {
          _id: pay._id.toString(),
          txHash: pay.txHash,
          chainId: chainId,
          chainName: chainName,
          amount: amount,
          currency: currency,
          amountUsd: conversion.amountUsd,
          exchangeRate: conversion.rate,
          type: 'payable' as const,
          relatedId: pay._id.toString(),
          createdAt: pay.createdAt instanceof Date ? pay.createdAt : new Date(pay.createdAt),
          status: pay.status
        };
      }),
      ...ledgerTransactions.map(async (led: {
        _id: any;
        transactionHash: string;
        blockchainNetwork?: string;
        amount?: number;
        currency?: string;
        createdAt: Date | string;
        status: string;
        type?: string;
      }) => {
        let chainId = led.blockchainNetwork === 'Celo' ? 42220 : undefined;
        let chainName = led.blockchainNetwork || 'Unknown';
        
        // Try to extract chainId from blockchainNetwork if it's a number string
        if (!chainId && led.blockchainNetwork) {
          const networkStr = String(led.blockchainNetwork);
          if (networkStr === 'Celo' || networkStr.includes('42220')) {
            chainId = 42220;
            chainName = 'Celo';
          } else if (networkStr === 'Ethereum' || networkStr.includes('1')) {
            chainId = 1;
            chainName = 'Ethereum';
          }
        }
        
        const amount = led.amount || 0;
        const currency = led.currency || 'USD';
        const conversion = await convertToUsd(amount, currency);
        
        return {
          _id: led._id.toString(),
          txHash: led.transactionHash,
          chainId: chainId,
          chainName: chainName,
          amount: amount,
          currency: currency,
          amountUsd: conversion.amountUsd,
          exchangeRate: conversion.rate,
          type: led.type === 'receivable' ? 'invoice' as const : 'payable' as const,
          relatedId: led._id.toString(),
          createdAt: led.createdAt instanceof Date ? led.createdAt : new Date(led.createdAt),
          status: led.status
        };
      })
    ];

    // Wait for all conversions to complete
    const allChainTransactions = (await Promise.all(allChainTransactionsPromises)).sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    }); // Sort by newest first

    const celoTransactions = allChainTransactions.filter(tx => tx.chainId === 42220 || tx.chainName === 'Celo');
    // Use USD amounts for total (convert crypto to USD)
    const totalChainAmount = allChainTransactions.reduce((sum, tx) => sum + (tx.amountUsd || tx.amount || 0), 0);

    return {
      success: true,
      data: {
        users: {
          total: totalUsers,
          today: usersToday,
          thisWeek: usersThisWeek,
          thisMonth: usersThisMonth,
          thisYear: usersThisYear,
          active: activeUsers,
          byPlan: usersByPlan,
          onboarding: {
            completed: completedOnboarding,
            pending: pendingOnboarding
          },
          growth: userGrowth
        },
        invoices: {
          total: totalInvoices,
          today: invoicesToday,
          thisMonth: invoicesThisMonth,
          paid: paidInvoices,
          unpaid: unpaidInvoices
        },
        payables: {
          total: totalPayables,
          thisMonth: payablesThisMonth,
          paid: paidPayables
        },
        organizations: {
          total: totalOrganizations,
          thisMonth: organizationsThisMonth
        },
        revenue: {
          total: totalRevenue,
          transactions: revenueTransactions
        },
        chainTransactions: {
          total: allChainTransactions.length,
          celo: celoTransactions.length,
          totalAmount: totalChainAmount,
          transactions: allChainTransactions.slice(0, 50) // Limit to 50 most recent
        }
      }
    };
  } catch (error) {
    console.error('Admin stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch admin statistics'
    };
  }
}

