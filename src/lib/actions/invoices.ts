'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { CurrencyService } from '@/lib/services/currencyService';

// Invoice List Item Interface (minimal data for list view only)
export interface InvoiceListItem {
  _id: string;
  invoiceNumber: string;
  clientName: string; // Just name, no full details
  total: number;
  currency: string;
  status: string;
  dueDate: string;
  createdAt: string;
  recipientType?: 'individual' | 'organization';
  // NO: items, full client details, company details, etc.
}

// Invoice Details Interface (full data only when needed)
export interface InvoiceDetails {
  _id: string;
  invoiceNumber: string;
  invoiceName?: string;
  issueDate: string;
  dueDate: string;
  organizationId?: string;
  issuerId?: string;
  type?: string;
  companyDetails: {
    name: string;
    email: string;
    phone?: string;
    address?: Record<string, unknown>;
    logo?: string;
    taxNumber?: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  clientDetails: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
    address?: Record<string, unknown>;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
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
  totalAmount: number;
  status: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
  recipientType?: 'individual' | 'organization';
  paymentSettings?: {
    method?: string;
    bankAccount?: {
      bankName?: string;
      accountNumber?: string;
      routingNumber?: string;
    };
    cryptoNetwork?: string;
    walletAddress?: string;
  };
  taxes?: any;
  notes?: string;
  sentVia?: 'email' | 'whatsapp';
  // Full data for detail view
}

// Invoice List Response Interface (minimal data)
export interface InvoiceListResponse {
  invoices: InvoiceListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    totalRevenue: number;
    preferredCurrency: string;
    totalInvoices: number;
    statusCounts: {
      draft: number;
      sent: number;
      pending: number;
      paid: number;
      overdue: number;
    };
  };
}

// Full Invoice List Response Interface (for invoices page)
export interface FullInvoiceListResponse {
  invoices: InvoiceDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    totalRevenue: number;
    preferredCurrency: string;
    totalInvoices: number;
    statusCounts: {
      draft: number;
      sent: number;
      pending: number;
      pending_approval: number;
      rejected: number;
      paid: number;
      overdue: number;
    };
  };
}

/**
 * Get invoices list with pagination - only list view data
 * Matches existing API structure but optimized for performance
 */
export async function getInvoicesList(
  page: number = 1,
  limit: number = 10,
  status?: string,
  searchQuery?: string
): Promise<{ success: boolean; data?: InvoiceListResponse; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    let query = isOrganization 
      ? { organizationId: session.user.organizationId }
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
          { invoiceNumber: { $regex: searchQuery, $options: 'i' } },
          { 'clientDetails.name': { $regex: searchQuery, $options: 'i' } },
          { 'clientDetails.companyName': { $regex: searchQuery, $options: 'i' } }
        ]
      } as typeof query & { $or: Array<Record<string, unknown>> };
    }

    // Get total count
    const total = await invoicesCollection.countDocuments(query);

    // Get status counts for all invoices (not just paginated ones)
    const baseQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const [draftCount, sentCount, pendingCount, paidCount, overdueCount] = await Promise.all([
      invoicesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'sent' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      invoicesCollection.countDocuments({ ...baseQuery, status: 'overdue' })
    ]);

    // Get invoices with pagination - only essential fields
    const skip = (page - 1) * limit;
    const invoices = await invoicesCollection
      .find(query, {
        projection: {
          _id: 1,
          invoiceNumber: 1,
          'clientDetails.name': 1,
          'clientDetails.companyName': 1,
          total: 1,
          totalAmount: 1,
          currency: 1,
          status: 1,
          dueDate: 1,
          createdAt: 1,
          recipientType: 1
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Transform to minimal data structure
    const invoiceList: InvoiceListItem[] = invoices.map(invoice => ({
      _id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber || 'Invoice',
      clientName: invoice.clientDetails?.companyName || 
                 invoice.clientDetails?.name || 
                 'Client',
      total: invoice.total || invoice.totalAmount || 0,
      currency: invoice.currency || 'USD',
      status: invoice.status || 'draft',
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      recipientType: invoice.recipientType
    }));

    // Calculate total revenue (only approved invoices)
    const revenueQuery = {
      ...baseQuery,
      status: { $in: ['approved', 'sent', 'paid'] }
    };
    
    const allInvoices = await invoicesCollection.find(revenueQuery).toArray();
    const totalRevenue = await CurrencyService.calculateTotalRevenue(allInvoices as Record<string, unknown>[], preferredCurrency);

    const response: InvoiceListResponse = {
      invoices: invoiceList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalRevenue,
        preferredCurrency,
        totalInvoices: total,
        statusCounts: {
          draft: draftCount,
          sent: sentCount,
          pending: pendingCount,
          paid: paidCount,
          overdue: overdueCount
        }
      }
    };

    return { success: true, data: response };

  } catch (error) {
    console.error('Error fetching invoices list:', error);
    return { success: false, error: 'Failed to fetch invoices list' };
  }
}

/**
 * Get invoices list with pagination - minimal data for list view
 * Optimized for performance with only essential fields
 */
export async function getInvoicesListMinimal(
  page: number = 1,
  limit: number = 10,
  status?: string,
  searchQuery?: string
): Promise<{ success: boolean; data?: FullInvoiceListResponse; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    let query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : {
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Add status filter
    if (status && status !== 'all') {
      query = { ...query, status };
    }

    // Add search filter
    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      query = {
        ...query,
        $or: [
          { invoiceNumber: searchRegex },
          { 'clientDetails.companyName': searchRegex },
          { 'clientDetails.firstName': searchRegex },
          { 'clientDetails.lastName': searchRegex },
          { 'clientDetails.email': searchRegex },
          { status: searchRegex }
        ]
      };
    }

    // Get total count
    const total = await invoicesCollection.countDocuments(query);

    // Calculate pagination
    const skip = (page - 1) * limit;
    const pages = Math.ceil(total / limit);

    // Get invoices with minimal data for list view only
    const invoices = await invoicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        invoiceNumber: 1,
        invoiceName: 1,
        issueDate: 1,
        dueDate: 1,
        status: 1,
        total: 1,
        totalAmount: 1,
        currency: 1,
        createdAt: 1,
        updatedAt: 1,
        recipientType: 1,
        organizationId: 1,
        issuerId: 1,
        type: 1,
        // Minimal client info for display
        'clientDetails.name': 1,
        'clientDetails.companyName': 1,
        'clientDetails.email': 1,
        'clientDetails.firstName': 1,
        'clientDetails.lastName': 1,
        // Minimal company info for display
        'companyDetails.name': 1,
        'companyDetails.email': 1,
        // NO: items, full client details, payment settings, taxes, etc.
      })
      .toArray();

    // Transform to minimal data structure for list view
    const invoiceList: InvoiceDetails[] = invoices.map(invoice => ({
      _id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber || 'Invoice',
      invoiceName: invoice.invoiceName,
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      organizationId: invoice.organizationId?.toString(),
      issuerId: invoice.issuerId?.toString(),
      type: invoice.type,
      companyDetails: {
        name: invoice.companyDetails?.name || '',
        email: invoice.companyDetails?.email || ''
      },
      clientDetails: {
        name: invoice.clientDetails?.name || '',
        email: invoice.clientDetails?.email || '',
        companyName: invoice.clientDetails?.companyName,
        firstName: invoice.clientDetails?.firstName,
        lastName: invoice.clientDetails?.lastName
      },
      currency: invoice.currency || 'USD',
      items: [], // Empty for list view - only load when viewing details
      paymentSettings: {}, // Empty for list view - only load when viewing details
      subtotal: 0, // Not needed for list view
      totalTax: 0, // Not needed for list view
      total: invoice.total || invoice.totalAmount || 0,
      totalAmount: invoice.totalAmount || invoice.total || 0,
      status: invoice.status || 'draft',
      memo: '', // Not needed for list view
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: invoice.updatedAt?.toISOString() || new Date().toISOString(),
      recipientType: invoice.recipientType,
      taxes: undefined // Not needed for list view
    }));

    // Calculate total revenue (only approved invoices)
    const revenueQuery = {
      ...query,
      status: { $in: ['approved', 'sent', 'paid'] }
    };
    
    const allInvoices = await invoicesCollection.find(revenueQuery).toArray();
    const totalRevenue = await CurrencyService.calculateTotalRevenue(allInvoices as Record<string, unknown>[], preferredCurrency);

    // Calculate status counts
    const statusCounts = await invoicesCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const statusCountsObj = {
      draft: 0,
      sent: 0,
      pending: 0,
      pending_approval: 0,
      rejected: 0,
      paid: 0,
      overdue: 0
    };

    statusCounts.forEach(item => {
      if (item._id in statusCountsObj) {
        statusCountsObj[item._id as keyof typeof statusCountsObj] = item.count;
      }
    });

    const response: FullInvoiceListResponse = {
      invoices: invoiceList,
      pagination: {
        page,
        limit,
        total,
        pages
      },
      stats: {
        totalRevenue,
        preferredCurrency,
        totalInvoices: total,
        statusCounts: statusCountsObj
      }
    };

    return { success: true, data: response };

  } catch (error) {
    console.error('Error fetching full invoices list:', error);
    return { success: false, error: 'Failed to fetch full invoices list' };
  }
}

/**
 * Get full invoices data for export operations
 * Loads complete invoice data when needed (CSV export, etc.)
 */
export async function getFullInvoicesForExport(
  status?: string,
  searchQuery?: string
): Promise<{ success: boolean; data?: InvoiceDetails[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    let query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : {
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Add status filter
    if (status && status !== 'all') {
      query = { ...query, status };
    }

    // Add search filter
    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      query = {
        ...query,
        $or: [
          { invoiceNumber: searchRegex },
          { 'clientDetails.companyName': searchRegex },
          { 'clientDetails.firstName': searchRegex },
          { 'clientDetails.lastName': searchRegex },
          { 'clientDetails.email': searchRegex },
          { status: searchRegex }
        ]
      };
    }

    // Get ALL invoices with full data for export
    const invoices = await invoicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Transform to full data structure
    const invoiceList: InvoiceDetails[] = invoices.map(invoice => ({
      _id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber || 'Invoice',
      invoiceName: invoice.invoiceName,
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      organizationId: invoice.organizationId?.toString(),
      issuerId: invoice.issuerId?.toString(),
      type: invoice.type,
      companyDetails: invoice.companyDetails || {},
      clientDetails: invoice.clientDetails || {},
      currency: invoice.currency || 'USD',
      items: invoice.items || [],
      paymentSettings: invoice.paymentSettings || {},
      subtotal: invoice.subtotal || 0,
      totalTax: invoice.totalTax || 0,
      total: invoice.total || invoice.totalAmount || 0,
      totalAmount: invoice.totalAmount || invoice.total || 0,
      status: invoice.status || 'draft',
      memo: invoice.memo,
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: invoice.updatedAt?.toISOString() || new Date().toISOString(),
      recipientType: invoice.recipientType,
      taxes: invoice.taxes,
      notes: invoice.notes
    }));

    return { success: true, data: invoiceList };

  } catch (error) {
    console.error('Error fetching full invoices for export:', error);
    return { success: false, error: 'Failed to fetch full invoices for export' };
  }
}

/**
 * Get invoice details - full data only when needed
 * Matches existing invoice structure but loaded on demand
 */
export async function getInvoiceDetails(invoiceId: string): Promise<{ success: boolean; data?: InvoiceDetails; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');

    // Build query - Organization members should always see organization's invoices
    const isOrganization = !!session.user.organizationId;
    const query = isOrganization 
      ? { 
          _id: new ObjectId(invoiceId),
          organizationId: session.user.organizationId 
        }
      : { 
          _id: new ObjectId(invoiceId),
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const invoice = await invoicesCollection.findOne(query);

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Transform to full data structure
    const invoiceDetails: InvoiceDetails = {
      _id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber || 'Invoice',
      invoiceName: invoice.invoiceName,
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : new Date().toISOString() || new Date().toISOString(),
      companyDetails: {
        name: invoice.companyDetails?.name || invoice.companyName || '',
        email: invoice.companyDetails?.email || invoice.companyEmail || '',
        phone: invoice.companyDetails?.phone || invoice.companyPhone,
        address: invoice.companyDetails?.address || invoice.companyAddress,
        logo: invoice.companyDetails?.logo || invoice.companyLogo
      },
      clientDetails: {
        name: invoice.clientDetails?.name || invoice.clientName || '',
        email: invoice.clientDetails?.email || invoice.clientEmail || '',
        phone: invoice.clientDetails?.phone || invoice.clientPhone,
        companyName: invoice.clientDetails?.companyName || invoice.clientCompany,
        address: invoice.clientDetails?.address || invoice.clientAddress
      },
      currency: invoice.currency || 'USD',
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      totalTax: invoice.totalTax || 0,
      total: invoice.total || 0,
      totalAmount: invoice.totalAmount || invoice.total || 0,
      status: invoice.status || 'draft',
      memo: invoice.memo,
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: invoice.updatedAt?.toISOString() || new Date().toISOString(),
      recipientType: invoice.recipientType
    };

    return { success: true, data: invoiceDetails };

  } catch (error) {
    console.error('Error fetching invoice details:', error);
    return { success: false, error: 'Failed to fetch invoice details' };
  }
}

/**
 * Search invoices with pagination
 */
export async function searchInvoices(
  searchQuery: string,
  page: number = 1,
  limit: number = 10
): Promise<{ success: boolean; data?: InvoiceListResponse; error?: string }> {
  return getInvoicesList(page, limit, undefined, searchQuery);
}
