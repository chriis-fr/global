'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { NotificationService } from '@/lib/services/notificationService';

/**
 * Sync invoice status when payable approval status changes
 * This ensures the sender's invoice reflects the organization's approval decision
 */
export async function syncInvoiceStatusWithPayable(
  payableId: string,
  approvalStatus: 'approved' | 'rejected',
  approvalNotes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    
    // Get the payable
    const payable = await db.collection('payables').findOne({
      _id: new ObjectId(payableId)
    });

    if (!payable) {
      return { success: false, message: 'Payable not found' };
    }

    // Get the related invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(payable.relatedInvoiceId)
    });

    if (!invoice) {
      return { success: false, message: 'Related invoice not found' };
    }

    // Update payable status
    await db.collection('payables').updateOne(
      { _id: new ObjectId(payableId) },
      {
        $set: {
          approvalStatus,
          status: approvalStatus === 'approved' ? 'approved' : 'rejected',
          approvedAt: new Date(),
          approvalNotes: approvalNotes || '',
          updatedAt: new Date()
        }
      }
    );

    // Update invoice status to reflect approval decision
    const invoiceStatus = approvalStatus === 'approved' ? 'approved' : 'rejected';
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(payable.relatedInvoiceId) },
      {
        $set: {
          status: invoiceStatus,
          approvalStatus,
          approvedAt: approvalStatus === 'approved' ? new Date() : null,
          approvalNotes: approvalNotes || '',
          updatedAt: new Date()
        }
      }
    );

    // Send notification to invoice sender about approval decision
    await sendApprovalDecisionNotification(
      invoice,
      payable,
      approvalStatus,
      approvalNotes,
      session.user.name || session.user.email || 'Unknown Approver'
    );

    console.log(`✅ [Status Sync] Invoice ${invoice.invoiceNumber} status updated to: ${invoiceStatus}`);
    
    return { 
      success: true, 
      message: `Invoice status updated to ${invoiceStatus}` 
    };

  } catch (error) {
    console.error('❌ [Status Sync] Error syncing invoice status:', error);
    return { 
      success: false, 
      message: 'Failed to sync invoice status' 
    };
  }
}

/**
 * Send notification to invoice sender about approval decision
 */
async function sendApprovalDecisionNotification(
  invoice: Record<string, unknown>,
  payable: Record<string, unknown>,
  approvalStatus: 'approved' | 'rejected',
  approvalNotes: string | undefined,
  approverName: string
) {
  try {
    console.log('📧 [Status Sync] Sending approval decision notification to sender');
    
    // Get sender details
    const db = await connectToDatabase();
    const sender = await db.collection('users').findOne({
      $or: [
        { _id: new ObjectId(invoice.issuerId) },
        { email: invoice.userId }
      ]
    });

    if (!sender) {
      console.error('❌ [Status Sync] Invoice sender not found');
      return;
    }

    // Get organization details for notification
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(payable.organizationId)
    });

    if (!organization) {
      console.error('❌ [Status Sync] Organization not found');
      return;
    }

    // Send notification
    await NotificationService.sendApprovalDecision(
      sender.email,
      sender.name || sender.email,
      approverName,
      approvalStatus,
      {
        type: 'invoice',
        number: invoice.invoiceNumber,
        name: invoice.invoiceName || invoice.invoiceNumber,
        amount: invoice.totalAmount || invoice.total,
        currency: invoice.currency
      },
      organization.name,
      approvalNotes
    );

    console.log('✅ [Status Sync] Approval decision notification sent to:', sender.email);

  } catch (error) {
    console.error('❌ [Status Sync] Error sending approval decision notification:', error);
  }
}

/**
 * Get invoice status for a specific payable
 * This can be used to check the current status
 */
export async function getInvoiceStatusForPayable(
  payableId: string
): Promise<{ success: boolean; invoiceStatus?: string; message: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    
    // Get the payable
    const payable = await db.collection('payables').findOne({
      _id: new ObjectId(payableId)
    });

    if (!payable) {
      return { success: false, message: 'Payable not found' };
    }

    // Get the related invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(payable.relatedInvoiceId)
    });

    if (!invoice) {
      return { success: false, message: 'Related invoice not found' };
    }

    return { 
      success: true, 
      invoiceStatus: invoice.status,
      message: 'Invoice status retrieved successfully'
    };

  } catch (error) {
    console.error('❌ [Status Sync] Error getting invoice status:', error);
    return { 
      success: false, 
      message: 'Failed to get invoice status' 
    };
  }
}
