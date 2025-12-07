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

