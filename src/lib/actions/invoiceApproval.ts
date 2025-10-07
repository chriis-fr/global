'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function approveInvoice(invoiceId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await getDatabase();
    
    // Get the invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(invoiceId)
    });

    if (!invoice) {
      return { success: false, message: 'Invoice not found' };
    }

    // Check if user has permission to approve this invoice
    if (invoice.organizationId) {
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(invoice.organizationId)
      });

      if (!organization) {
        return { success: false, message: 'Organization not found' };
      }

      const userMember = organization.members.find((member: any) => 
        member.userId.toString() === session.user.id
      );

      if (!userMember) {
        return { success: false, message: 'You are not a member of this organization' };
      }

      // Check if user has approval permissions
      const canApprove = userMember.role === 'owner' || 
                        userMember.role === 'admin' || 
                        userMember.role === 'approver' ||
                        userMember.permissions?.canApproveBills;

      if (!canApprove) {
        return { success: false, message: 'You do not have permission to approve invoices' };
      }
    } else {
      // Individual invoice - only the creator can approve
      if (invoice.issuerId !== session.user.id) {
        return { success: false, message: 'You can only approve your own invoices' };
      }
    }

    // Update invoice status
    const result = await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: session.user.id,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ [Approval] Invoice approved successfully, status updated to "approved"');
      return { success: true, message: 'Invoice approved successfully. It can now be sent to the recipient.' };
    } else {
      return { success: false, message: 'Failed to approve invoice' };
    }
  } catch (error) {
    console.error('Error approving invoice:', error);
    return { success: false, message: 'Failed to approve invoice' };
  }
}

export async function rejectInvoice(invoiceId: string, reason?: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await getDatabase();
    
    // Get the invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(invoiceId)
    });

    if (!invoice) {
      return { success: false, message: 'Invoice not found' };
    }

    // Check if user has permission to reject this invoice
    if (invoice.organizationId) {
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(invoice.organizationId)
      });

      if (!organization) {
        return { success: false, message: 'Organization not found' };
      }

      const userMember = organization.members.find((member: any) => 
        member.userId.toString() === session.user.id
      );

      if (!userMember) {
        return { success: false, message: 'You are not a member of this organization' };
      }

      // Check if user has approval permissions
      const canReject = userMember.role === 'owner' || 
                       userMember.role === 'admin' || 
                       userMember.role === 'approver' ||
                       userMember.permissions?.canApproveBills;

      if (!canReject) {
        return { success: false, message: 'You do not have permission to reject invoices' };
      }
    } else {
      // Individual invoice - only the creator can reject
      if (invoice.issuerId !== session.user.id) {
        return { success: false, message: 'You can only reject your own invoices' };
      }
    }

    // Update invoice status
    const result = await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: session.user.id,
          rejectionReason: reason || 'No reason provided',
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Invoice rejected successfully' };
    } else {
      return { success: false, message: 'Failed to reject invoice' };
    }
  } catch (error) {
    console.error('Error rejecting invoice:', error);
    return { success: false, message: 'Failed to reject invoice' };
  }
}

export async function getPendingApprovals(): Promise<{
  success: boolean;
  data?: any[];
  message?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await getDatabase();
    
    // Get user's organization
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user?.organizationId) {
      return { success: false, message: 'User is not part of an organization' };
    }

    // Get pending approval invoices for the organization
    const pendingInvoices = await db.collection('invoices').find({
      organizationId: new ObjectId(user.organizationId.toString()),
      status: 'pending_approval'
    }).sort({ createdAt: -1 }).toArray();

    // Also try with string comparison to debug
    const pendingInvoicesString = await db.collection('invoices').find({
      organizationId: user.organizationId.toString(),
      status: 'pending_approval'
    }).sort({ createdAt: -1 }).toArray();

    // Get all invoices to see what we have
    const allInvoices = await db.collection('invoices').find({
      organizationId: new ObjectId(user.organizationId.toString())
    }).toArray();

    console.log('🔍 [Pending Approvals] Query details:', {
      organizationId: user.organizationId,
      organizationIdObjectId: new ObjectId(user.organizationId.toString()),
      pendingInvoicesCount: pendingInvoices.length,
      pendingInvoicesStringCount: pendingInvoicesString.length,
      allInvoicesCount: allInvoices.length,
      userEmail: session.user.email,
      allInvoiceStatuses: allInvoices.map(inv => ({ 
        id: inv._id?.toString(), 
        status: inv.status, 
        orgId: inv.organizationId?.toString() 
      }))
    });

    // Use whichever query found results
    const finalPendingInvoices = pendingInvoices.length > 0 ? pendingInvoices : pendingInvoicesString;

    return {
      success: true,
      data: finalPendingInvoices.map(invoice => ({
        _id: invoice._id?.toString(),
        invoiceNumber: invoice.invoiceNumber,
        invoiceName: invoice.invoiceName,
        total: invoice.total,
        currency: invoice.currency,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        createdAt: invoice.createdAt,
        createdBy: invoice.issuerId
      }))
    };
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return { success: false, message: 'Failed to get pending approvals' };
  }
}
