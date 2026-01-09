"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * Get payable details with related invoice number if available
 */
export async function getPayableWithInvoice(payableId: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');
    const invoicesCollection = db.collection('invoices');

    // Build query
    const isOrganization = !!session.user.organizationId;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    let query: Record<string, unknown>;
    
    if (isOrganization) {
      query = {
        _id: new ObjectId(payableId),
        $or: [
          { organizationId: session.user.organizationId },
          { organizationId: new ObjectId(session.user.organizationId) }
        ]
      };
    } else {
      query = {
        _id: new ObjectId(payableId),
        $or: [
          issuerIdQuery,
          { userId: session.user.email }
        ]
      };
    }

    const payable = await payablesCollection.findOne(query);

    if (!payable) {
      return { success: false, error: 'Payable not found' };
    }

    // Get invoice number and payment details if relatedInvoiceId exists
    let invoiceNumber: string | null = null;
    let invoiceChainId: number | undefined = undefined;
    let invoiceTokenAddress: string | undefined = undefined;
    let invoiceTokenSymbol: string | undefined = undefined;
    let invoicePaymentAddress: string | undefined = undefined; // Invoice creator's receiving address
    
    if (payable.relatedInvoiceId) {
      try {
        const invoice = await invoicesCollection.findOne(
          { _id: new ObjectId(payable.relatedInvoiceId) },
          { projection: { invoiceNumber: 1, paymentSettings: 1, chainId: 1, tokenAddress: 1, currency: 1, paymentAddress: 1, payeeAddress: 1 } }
        );
        if (invoice) {
          invoiceNumber = invoice.invoiceNumber || null;
          // Extract chainId and tokenAddress from invoice paymentSettings or top-level
          invoiceChainId = invoice.paymentSettings?.chainId || invoice.chainId;
          invoiceTokenAddress = invoice.paymentSettings?.tokenAddress || invoice.tokenAddress;
          invoiceTokenSymbol = invoice.paymentSettings?.currency || invoice.currency;
          // Get the invoice creator's receiving address (this is the correct recipient for payments)
          invoicePaymentAddress = invoice.paymentAddress || invoice.payeeAddress || invoice.paymentSettings?.address;
        }
      } catch (error) {
        console.error('Error fetching related invoice:', error);
        // Continue without invoice number
      }
    }

    // Transform payable data
    const payableData = {
      _id: payable._id.toString(),
      payableNumber: payable.payableNumber || 'Payable',
      payableName: payable.payableName || 'Payable',
      payableType: payable.payableType || 'regular',
      issueDate: payable.issueDate?.toISOString() || new Date().toISOString(),
      dueDate: payable.dueDate?.toISOString() || new Date().toISOString(),
      paymentDate: payable.paymentDate?.toISOString(),
      companyName: payable.companyName || '',
      companyEmail: payable.companyEmail || '',
      companyPhone: payable.companyPhone,
      companyAddress: payable.companyAddress,
      companyTaxNumber: payable.companyTaxNumber,
      vendorName: payable.vendorName || '',
      vendorEmail: payable.vendorEmail || '',
      vendorPhone: payable.vendorPhone,
      vendorAddress: payable.vendorAddress,
      currency: payable.currency || 'USD',
      paymentMethod: payable.paymentMethod || 'fiat',
      paymentNetwork: payable.paymentNetwork,
      // Use invoice's payment address if available (correct recipient), otherwise use payable's
      paymentAddress: invoicePaymentAddress || payable.paymentAddress,
      enableMultiCurrency: payable.enableMultiCurrency || false,
      items: payable.items || [],
      subtotal: payable.subtotal || 0,
      totalTax: payable.totalTax || 0,
      total: payable.total || payable.amount || 0,
      memo: payable.memo || '',
      status: payable.status || 'pending',
      priority: payable.priority || 'medium',
      category: payable.category || '',
      approvalStatus: payable.approvalStatus || 'pending',
      approvedBy: payable.approvedBy,
      approvedAt: payable.approvedAt?.toISOString(),
      approvalNotes: payable.approvalNotes,
      paymentStatus: payable.paymentStatus || 'pending',
      paymentMethodDetails: (() => {
        const details = payable.paymentMethodDetails || {};
        // If crypto payment and we have invoice data, enrich cryptoDetails
        if (payable.paymentMethod === 'crypto' && (invoiceChainId || invoiceTokenAddress)) {
          const cryptoDetails = details.cryptoDetails || {};
          return {
            ...details,
            cryptoDetails: {
              ...cryptoDetails,
              chainId: cryptoDetails.chainId || invoiceChainId,
              tokenAddress: cryptoDetails.tokenAddress || invoiceTokenAddress,
              tokenSymbol: cryptoDetails.tokenSymbol || invoiceTokenSymbol || payable.currency,
              network: cryptoDetails.network || payable.paymentNetwork,
              // Use invoice's payment address if available (correct recipient), otherwise use payable's
              address: cryptoDetails.address || invoicePaymentAddress || payable.paymentAddress,
            }
          };
        }
        return details;
      })(),
      attachedFiles: payable.attachedFiles || [],
      relatedInvoiceId: payable.relatedInvoiceId?.toString(),
      invoiceNumber, // Add invoice number
      ledgerEntryId: payable.ledgerEntryId?.toString(),
      ledgerStatus: payable.ledgerStatus || '',
      frequency: payable.frequency || '',
      recurringEndDate: payable.recurringEndDate?.toISOString(),
      statusHistory: payable.statusHistory || [],
      lastNotificationSent: payable.lastNotificationSent?.toISOString(),
      notificationCount: payable.notificationCount || 0,
      txHash: payable.txHash, // Transaction hash for crypto payments
      chainId: payable.chainId || invoiceChainId, // Chain ID for crypto payments (from payable or invoice)
      tokenAddress: payable.tokenAddress || invoiceTokenAddress, // Token address (from payable or invoice)
      createdAt: payable.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: payable.updatedAt?.toISOString() || new Date().toISOString(),
    };

    return { success: true, data: payableData };
  } catch (error) {
    console.error('Error fetching payable with invoice:', error);
    return { success: false, error: 'Failed to fetch payable' };
  }
}

/**
 * Get paginated payables list with stats - Ultra fast server action
 * Replaces slow API route calls - no compilation delay
 */
export async function getPayablesListPaginated(
  page: number = 1,
  limit: number = 6,
  status?: string
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    let query: Record<string, unknown> = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };

    // Add status filter
    if (status && status !== 'all') {
      query = { ...query, status } as typeof query & { status: string };
    }

    // Get total count
    const total = await payablesCollection.countDocuments(query);

    // Get status counts for all payables (not just paginated)
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            issuerIdQuery,
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

    // Get paginated payables
    const skip = (page - 1) * limit;
    const payables = await payablesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Calculate total amount for unpaid payables
    const allPayables = await payablesCollection.find(baseQuery).toArray();
    const unpaidPayables = allPayables.filter(p => p.status !== 'paid');
    const totalAmount = unpaidPayables.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    // Transform payables
    const transformedPayables = payables.map(p => ({
      _id: p._id.toString(),
      payableNumber: p.payableNumber || 'Payable',
      companyName: p.companyName,
      vendorName: p.vendorName || '',
      vendorCompany: p.vendorCompany,
      vendorEmail: p.vendorEmail || '',
      total: p.total || p.amount || 0,
      currency: p.currency || 'USD',
      status: p.status || 'pending',
      dueDate: p.dueDate?.toISOString() || new Date().toISOString(),
      issueDate: p.issueDate?.toISOString() || new Date().toISOString(),
      category: p.category,
      priority: p.priority,
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return {
      success: true,
      data: {
        payables: transformedPayables,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalPayables: total,
          totalAmount,
          statusCounts: {
            draft: draftCount,
            pending: pendingCount,
            approved: approvedCount,
            paid: paidCount,
            overdue: overdueCount
          }
        }
      }
    };
  } catch (error) {
    console.error('Error getting payables list:', error);
    return { success: false, error: 'Failed to fetch payables' };
  }
}

/**
 * Get onboarding status for a service - Ultra fast server action
 * Replaces slow API route - no compilation delay
 */
export async function getOnboardingStatus(serviceKey: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    // Import services (pre-initialized, not created inside action)
    const { UserService } = await import('@/lib/services/userService');
    const { OrganizationService } = await import('@/lib/services/organizationService');

    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // For organization users, check organization onboarding
    if (user.organizationId) {
      const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
      if (!organization) {
        return { success: false, error: 'Organization not found' };
      }

      const organizationServiceOnboarding = organization.onboarding.serviceOnboarding || {};
      const organizationServices = organization.services || {};
      const serviceOnboarding = organizationServiceOnboarding[serviceKey];
      const isServiceEnabled = (organizationServices as unknown as Record<string, unknown>)[serviceKey];

      // Check if completed: service enabled OR onboarding completed
      let isCompleted = false;
      if (isServiceEnabled === true) {
        isCompleted = true;
      } else if (serviceOnboarding && typeof serviceOnboarding === 'object') {
        const onboardingData = serviceOnboarding as Record<string, unknown>;
        const completedValue = onboardingData.completed;
        if (completedValue === true || completedValue === 'true' || completedValue === 1) {
          isCompleted = true;
        }
      }

      return {
        success: true,
        data: {
          isCompleted,
          serviceKey,
          storageLocation: 'organization'
        }
      };
    } else {
      // For individual users
      const serviceOnboardingFromDirect = (user.onboarding as unknown as { serviceOnboarding?: Record<string, unknown> }).serviceOnboarding;
      const serviceOnboardingFromData = (user.onboarding.data as { serviceOnboarding?: Record<string, unknown> })?.serviceOnboarding;
      const serviceOnboarding = serviceOnboardingFromDirect || serviceOnboardingFromData || {};
      const serviceOnboardingData = (serviceOnboarding as Record<string, unknown>)[serviceKey];

      let isCompleted = false;
      if (serviceOnboardingData && typeof serviceOnboardingData === 'object') {
        const onboardingData = serviceOnboardingData as Record<string, unknown>;
        const completedValue = onboardingData.completed;
        if (completedValue === true || completedValue === 'true' || completedValue === 1) {
          isCompleted = true;
        }
      }

      return {
        success: true,
        data: {
          isCompleted,
          serviceKey,
          storageLocation: 'user'
        }
      };
    }
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    return { success: false, error: 'Failed to fetch onboarding status' };
  }
}

/**
 * Get payables stats only - Ultra fast, can be cached
 * Separate from payables list for independent loading
 */
export async function getPayablesStats() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build base query
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };

    // Run all queries in parallel for maximum speed
    const [total, draftCount, pendingCount, approvedCount, paidCount, overdueCount, allPayables] = await Promise.all([
      payablesCollection.countDocuments(baseQuery),
      payablesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'approved' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'overdue' }),
      payablesCollection.find(baseQuery).toArray()
    ]);

    // Calculate total amount for unpaid payables
    const unpaidPayables = allPayables.filter(p => p.status !== 'paid');
    const totalAmount = unpaidPayables.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    return {
      success: true,
      data: {
        totalPayables: total,
        totalAmount,
        statusCounts: {
          draft: draftCount,
          pending: pendingCount,
          approved: approvedCount,
          paid: paidCount,
          overdue: overdueCount
        }
      }
    };
  } catch (error) {
    console.error('Error getting payables stats:', error);
    return { success: false, error: 'Failed to fetch stats' };
  }
}

/**
 * Delete a payable
 */
export async function deletePayable(payableId: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query - Organization members should see organization's payables
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    const query: Record<string, unknown> = isOrganization 
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
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };

    const result = await payablesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return { success: false, error: 'Payable not found or unauthorized' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting payable:', error);
    return { success: false, error: 'Failed to delete payable' };
  }
}

/**
 * Get all payables for list page (no pagination, client-side filtering)
 */
export async function getAllPayables() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Build query
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    const baseQuery = isOrganization 
      ? { 
          $or: [
            { organizationId: session.user.organizationId },
            { organizationId: new ObjectId(session.user.organizationId) }
          ]
        }
      : { 
          $or: [
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };

    // Get all payables
    const payables = await payablesCollection
      .find(baseQuery)
      .sort({ createdAt: -1 })
      .toArray();

    // Get status counts
    const [, pendingCount, approvedCount, paidCount, overdueCount] = await Promise.all([
      payablesCollection.countDocuments({ ...baseQuery, status: 'draft' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'pending' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'approved' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'paid' }),
      payablesCollection.countDocuments({ ...baseQuery, status: 'overdue' })
    ]);

    // Calculate total amount for unpaid payables
    const unpaidPayables = payables.filter(p => p.status !== 'paid');
    const totalAmount = unpaidPayables.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    // Transform payables
    const transformedPayables = payables.map(p => ({
      _id: p._id.toString(),
      payableNumber: p.payableNumber || 'Payable',
      payableName: p.payableName || p.payableNumber || 'Payable',
      companyName: p.companyName,
      vendorName: p.vendorName || '',
      vendorCompany: p.vendorCompany,
      vendorEmail: p.vendorEmail || '',
      amount: p.amount || p.total || 0,
      total: p.total || p.amount || 0,
      currency: p.currency || 'USD',
      status: p.status || 'pending',
      dueDate: p.dueDate?.toISOString() || new Date().toISOString(),
      issueDate: p.issueDate?.toISOString() || new Date().toISOString(),
      description: p.description || p.memo || '',
      category: p.category || '',
      priority: p.priority || 'medium',
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: p.updatedAt?.toISOString() || new Date().toISOString(),
    }));

    return {
      success: true,
      data: {
        payables: transformedPayables,
        stats: {
          totalPayables: payables.length,
          pendingCount: pendingCount + approvedCount,
          paidCount,
          totalAmount,
          overdueCount
        }
      }
    };
  } catch (error) {
    console.error('Error getting all payables:', error);
    return { success: false, error: 'Failed to fetch payables' };
  }
}

