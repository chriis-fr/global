import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

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

/**
 * Get admin dashboard statistics
 * Only accessible to users with adminTag
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !session.user.adminTag) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
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

    // Revenue statistics (from ledger)
    const revenueStatsRaw = await db.collection('ledger').aggregate([
      {
        $match: {
          type: 'receivable',
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalRevenue = (revenueStatsRaw[0] as { totalRevenue?: number })?.totalRevenue || 0;
    const revenueTransactions = (revenueStatsRaw[0] as { count?: number })?.count || 0;

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
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const activeUsers = await db.collection('users').countDocuments({
      lastLogin: { $gte: thirtyDaysAgo }
    });

    return NextResponse.json({
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
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch admin statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

