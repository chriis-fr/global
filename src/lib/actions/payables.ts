'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// Payable List Item Interface (minimal data for list view only)
export interface PayableListItem {
  _id: string;
  payableNumber: string;
  vendorName: string; // Just name, no full details
  total: number;
  currency: string;
  status: string;
  dueDate: string;
  createdAt: string;
  // NO: full vendor details, items, payment details, etc.
}

// Payable Details Interface (full data only when needed)
export interface PayableDetails {
  _id: string;
  payableNumber: string;
  payableName: string;
  issueDate: string;
  dueDate: string;
  companyDetails: {
    name: string;
    email: string;
    phone?: string;
    address?: any;
  };
  vendorDetails: {
    name: string;
    email: string;
    phone?: string;
    address?: any;
  };
  currency: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    tax?: number;
  }>;
  subtotal: number;
  totalTax: number;
  total: number;
  status: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
  // Full data for detail view
}

// Payable List Response Interface
export interface PayableListResponse {
  payables: PayableListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    totalAmount: number;
    totalPayables: number;
    statusCounts: {
      draft: number;
      pending: number;
      approved: number;
      paid: number;
      overdue: number;
    };
  };
}

/**
 * Get payables list with pagination - only list view data
 * Matches existing API structure but optimized for performance
 */
export async function getPayablesList(
  page: number = 1,
  limit: number = 10,
  status?: string,
  searchQuery?: string
): Promise<{ success: boolean; data?: PayableListResponse; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query - Organization members should always see organization's payables
    const isOrganization = !!session.user.organizationId;
    let query = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Add status filter
    if (status) {
      query = { ...query, status } as typeof query & { status: string };
    }

    // Add search filter
    if (searchQuery) {
      query = {
        ...query,
        $or: [
          { payableNumber: { $regex: searchQuery, $options: 'i' } },
          { vendorName: { $regex: searchQuery, $options: 'i' } }
        ]
      } as typeof query & { $or: any[] };
    }

    // Get total count
    const total = await payablesCollection.countDocuments(query);

    // Get status counts for all payables (not just paginated ones)
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const [draftCount, pendingCount, approvedCount, paidCount, overdueCount] = await Promise.all([
      payablesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'approved' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'overdue' })
    ]);

    // Get payables with pagination - only essential fields
    const skip = (page - 1) * limit;
    const payables = await payablesCollection
      .find(query, {
        projection: {
          _id: 1,
          payableNumber: 1,
          vendorName: 1,
          total: 1,
          amount: 1,
          currency: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Transform to minimal data structure
    const payableList: PayableListItem[] = payables.map(payable => ({
      _id: payable._id.toString(),
      payableNumber: payable.payableNumber || 'Payable',
      vendorName: payable.vendorName || 'Vendor',
      total: payable.total || payable.amount || 0,
      currency: payable.currency || 'USD',
      status: payable.status || 'pending',
      dueDate: payable.dueDate?.toISOString() || new Date().toISOString(),
      createdAt: payable.createdAt?.toISOString() || new Date().toISOString()
    }));

    // Calculate total amount (only approved payables)
    const totalAmountQuery = {
      ...baseQuery,
      status: { $in: ['approved', 'pending', 'pending_approval'] }
    };
    
    const allPayables = await payablesCollection.find(totalAmountQuery).toArray();
    const totalAmount = allPayables.reduce((sum, payable) => sum + (payable.total || payable.amount || 0), 0);

    const response: PayableListResponse = {
      payables: payableList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalAmount,
        totalPayables: total,
        statusCounts: {
          draft: draftCount,
          pending: pendingCount,
          approved: approvedCount,
          paid: paidCount,
          overdue: overdueCount
        }
      }
    };

    return { success: true, data: response };

  } catch (error) {
    console.error('Error fetching payables list:', error);
    return { success: false, error: 'Failed to fetch payables list' };
  }
}

/**
 * Get payable details - full data only when needed
 * Matches existing payable structure but loaded on demand
 */
export async function getPayableDetails(payableId: string): Promise<{ success: boolean; data?: PayableDetails; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query - Organization members should always see organization's payables
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { 
          _id: new ObjectId(payableId),
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          _id: new ObjectId(payableId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const payable = await payablesCollection.findOne(query);

    if (!payable) {
      return { success: false, error: 'Payable not found' };
    }

    // Transform to full data structure
    const payableDetails: PayableDetails = {
      _id: payable._id.toString(),
      payableNumber: payable.payableNumber || 'Payable',
      payableName: payable.payableName || 'Payable',
      issueDate: payable.issueDate?.toISOString() || new Date().toISOString(),
      dueDate: payable.dueDate?.toISOString() || new Date().toISOString(),
      companyDetails: {
        name: payable.companyName || '',
        email: payable.companyEmail || '',
        phone: payable.companyPhone,
        address: payable.companyAddress
      },
      vendorDetails: {
        name: payable.vendorName || '',
        email: payable.vendorEmail || '',
        phone: payable.vendorPhone,
        address: payable.vendorAddress
      },
      currency: payable.currency || 'USD',
      items: payable.items || [],
      subtotal: payable.subtotal || 0,
      totalTax: payable.totalTax || 0,
      total: payable.total || payable.amount || 0,
      status: payable.status || 'pending',
      memo: payable.memo,
      createdAt: payable.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: payable.updatedAt?.toISOString() || new Date().toISOString()
    };

    return { success: true, data: payableDetails };

  } catch (error) {
    console.error('Error fetching payable details:', error);
    return { success: false, error: 'Failed to fetch payable details' };
  }
}

/**
 * Get payables statistics - only counts and totals
 */
export async function getPayablesStats(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query - Organization members should always see organization's payables
    const isOrganization = !!session.user.organizationId;
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get status counts
    const [draftCount, pendingCount, approvedCount, paidCount, overdueCount] = await Promise.all([
      payablesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'approved' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'overdue' })
    ]);

    // Calculate total amount (only approved payables)
    const totalAmountQuery = {
      ...baseQuery,
      status: { $in: ['approved', 'pending', 'pending_approval'] }
    };
    
    const allPayables = await payablesCollection.find(totalAmountQuery).toArray();
    const totalAmount = allPayables.reduce((sum, payable) => sum + (payable.total || payable.amount || 0), 0);

    const total = await payablesCollection.countDocuments(baseQuery);

    const stats = {
      totalAmount,
      totalPayables: total,
      statusCounts: {
        draft: draftCount,
        pending: pendingCount,
        approved: approvedCount,
        paid: paidCount,
        overdue: overdueCount
      }
    };

    return { success: true, data: stats };

  } catch (error) {
    console.error('Error fetching payables stats:', error);
    return { success: false, error: 'Failed to fetch payables stats' };
  }
}

/**
 * Search payables with pagination
 */
export async function searchPayables(
  searchQuery: string,
  page: number = 1,
  limit: number = 10
): Promise<{ success: boolean; data?: PayableListResponse; error?: string }> {
  return getPayablesList(page, limit, undefined, searchQuery);
}
