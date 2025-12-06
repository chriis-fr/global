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

    // Get invoice number if relatedInvoiceId exists
    let invoiceNumber: string | null = null;
    if (payable.relatedInvoiceId) {
      try {
        const invoice = await invoicesCollection.findOne(
          { _id: new ObjectId(payable.relatedInvoiceId) },
          { projection: { invoiceNumber: 1 } }
        );
        if (invoice) {
          invoiceNumber = invoice.invoiceNumber || null;
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
      paymentAddress: payable.paymentAddress,
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
      paymentMethodDetails: payable.paymentMethodDetails || {},
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
      chainId: payable.chainId, // Chain ID for crypto payments
      createdAt: payable.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: payable.updatedAt?.toISOString() || new Date().toISOString(),
    };

    return { success: true, data: payableData };
  } catch (error) {
    console.error('Error fetching payable with invoice:', error);
    return { success: false, error: 'Failed to fetch payable' };
  }
}

