'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function approveInvoice(invoiceId: string): Promise<{
  success: boolean;
  message: string;
  fullyApproved?: boolean;
  invoiceData?: any;
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
      const canApprove = userMember.role === 'admin' || 
                        userMember.role === 'approver' ||
                        userMember.permissions?.canApproveBills;

      if (!canApprove) {
        return { success: false, message: 'You do not have permission to approve invoices' };
      }

      // Check if owner can approve their own invoice based on organization size
      if (userMember.role === 'owner' && invoice.issuerId === session.user.id) {
        // Count total approvers (admins + approvers)
        const totalApprovers = organization.members.filter((member: any) => 
          member.role === 'admin' || member.role === 'approver'
        ).length;
        
        // If there are fewer approvers than required approvals, allow owner to approve
        if (totalApprovers < invoice.requiredApprovals) {
          console.log('⚠️ [Approval] Owner can approve own invoice due to insufficient approvers');
        } else {
          return { success: false, message: 'You cannot approve your own invoices. Please ask another admin or approver to review and approve this invoice.' };
        }
      }

      // Get organization approval settings to determine required approvals
      if (!organization?.approvalSettings) {
        return { success: false, message: 'Organization approval settings not found' };
      }

      const approvalSettings = organization.approvalSettings;
      const invoiceAmount = invoice.total || 0;
      
      // Determine required number of approvals based on amount
      let requiredApprovals = 1; // Default
      if (invoiceAmount >= approvalSettings.approvalRules.amountThresholds.high) {
        requiredApprovals = approvalSettings.approvalRules.requiredApprovers.high;
      } else if (invoiceAmount >= approvalSettings.approvalRules.amountThresholds.medium) {
        requiredApprovals = approvalSettings.approvalRules.requiredApprovers.medium;
      } else {
        requiredApprovals = approvalSettings.approvalRules.requiredApprovers.low;
      }

           // Get current approval count
           const currentApprovals = invoice.approvals || [];
           
           // Check if user has already approved this invoice
           const alreadyApproved = currentApprovals.some((approval: any) => 
             approval.approverId === session.user.id
           );

           if (alreadyApproved) {
             return { success: false, message: 'You have already approved this invoice' };
           }

           // Add new approval
           const newApproval = {
             approverId: session.user.id,
             approverName: session.user.name || session.user.email || 'Unknown User',
             approverEmail: session.user.email,
             approvedAt: new Date(),
             comments: ''
           };

           const updatedApprovals = [...currentApprovals, newApproval];
           const newApprovalCount = updatedApprovals.length;

           // Determine new status based on approval count
           let newStatus = 'pending_approval';
           if (newApprovalCount >= requiredApprovals) {
             newStatus = 'approved';
             console.log('✅ [Approval] Invoice fully approved, ready to send');
           } else {
             console.log(`⏳ [Approval] Invoice needs ${requiredApprovals - newApprovalCount} more approval(s)`);
           }

           // Update invoice with new approval and status
           const result = await db.collection('invoices').updateOne(
             { _id: new ObjectId(invoiceId) },
             {
               $set: {
                 status: newStatus,
                 approvals: updatedApprovals,
                 approvalCount: newApprovalCount,
                 requiredApprovals: requiredApprovals,
                 updatedAt: new Date()
               }
             }
           );

      if (result.modifiedCount > 0) {
        if (newStatus === 'approved') {
          // Invoice is fully approved - return data for frontend PDF generation
          console.log('✅ [Auto-Send] Invoice fully approved, returning data for frontend PDF generation');
          
          // Get the client email from the invoice - check multiple possible locations
          const clientEmail = invoice.clientDetails?.email || invoice.clientEmail || invoice.clientDetails?.clientEmail;
          
          if (!clientEmail) {
            console.log('⚠️ [Auto-Send] No client email found, cannot auto-send');
            return { 
              success: true, 
              message: `Invoice approved successfully! It has received all required approvals (${newApprovalCount}/${requiredApprovals}) but cannot be auto-sent because no client email was provided. Please send it manually.` 
            };
          }

          // Determine the greeting name
          const firstName = invoice.clientDetails?.firstName || invoice.clientName?.split(' ')[0] || '';
          const lastName = invoice.clientDetails?.lastName || invoice.clientName?.split(' ').slice(1).join(' ') || '';
          const fullName = [firstName, lastName].filter(Boolean).join(' ');
          const companyName = invoice.clientDetails?.companyName || invoice.clientCompany;
          const greetingName = companyName 
            ? (fullName || companyName)
            : (fullName || 'Client');
          
          // Return the invoice data so the frontend can generate PDF and send it
          return {
            success: true,
            message: `Invoice approved successfully! It has received all required approvals (${newApprovalCount}/${requiredApprovals}) and is ready to be sent.`,
            fullyApproved: true,
            invoiceData: {
              _id: invoice._id?.toString(),
              invoiceNumber: invoice.invoiceNumber,
              clientEmail: clientEmail,
              greetingName: greetingName,
              total: invoice.total || invoice.totalAmount,
              currency: invoice.currency,
              dueDate: invoice.dueDate,
              companyName: invoice.companyDetails?.name || invoice.companyName || 'Your Company',
              clientName: invoice.clientDetails?.companyName || greetingName || 'Client',
              paymentMethods: invoice.paymentSettings?.method === 'fiat' ? ['Bank Transfer'] : ['Cryptocurrency']
            }
          };
        } else {
          return { 
            success: true, 
            message: `Invoice approved! It now has ${newApprovalCount}/${requiredApprovals} approvals. ${requiredApprovals - newApprovalCount} more approval(s) needed.` 
          };
        }
      } else {
        return { success: false, message: 'Failed to approve invoice' };
      }
    } else {
      // Individual invoice - only the creator can approve
      if (invoice.issuerId !== session.user.id) {
        return { success: false, message: 'You can only approve your own invoices' };
      }
      
      // For individual invoices, just approve directly
      const result = await db.collection('invoices').updateOne(
        { _id: new ObjectId(invoiceId) },
        { $set: { status: 'approved', updatedAt: new Date() } }
      );
      
      if (result.modifiedCount > 0) {
        return { success: true, message: 'Invoice approved successfully!' };
      } else {
        return { success: false, message: 'Failed to approve invoice' };
      }
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
      const canReject = userMember.role === 'admin' || 
                       userMember.role === 'approver' ||
                       userMember.permissions?.canApproveBills;

      if (!canReject) {
        return { success: false, message: 'You do not have permission to reject invoices' };
      }

      // Check if owner can reject their own invoice based on organization size
      if (userMember.role === 'owner' && invoice.issuerId === session.user.id) {
        // Count total approvers (admins + approvers)
        const totalApprovers = organization.members.filter((member: any) => 
          member.role === 'admin' || member.role === 'approver'
        ).length;
        
        // If there are fewer approvers than required approvals, allow owner to reject
        if (totalApprovers < invoice.requiredApprovals) {
          console.log('⚠️ [Approval] Owner can reject own invoice due to insufficient approvers');
        } else {
          return { success: false, message: 'You cannot reject your own invoices. Please ask another admin or approver to review this invoice.' };
        }
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

           // Get creator information for each invoice
           const enrichedInvoices = await Promise.all(
             finalPendingInvoices.map(async (invoice) => {
               // Get creator details
               const creator = await db.collection('users').findOne({
                 _id: new ObjectId(invoice.issuerId)
               });

               return {
                 _id: invoice._id?.toString(),
                 invoiceNumber: invoice.invoiceNumber,
                 invoiceName: invoice.invoiceName,
                 total: invoice.total,
                 currency: invoice.currency,
                 clientName: invoice.clientDetails?.firstName && invoice.clientDetails?.lastName 
                   ? `${invoice.clientDetails.firstName} ${invoice.clientDetails.lastName}`.trim()
                   : invoice.clientDetails?.companyName || 'Unknown Client',
                 clientEmail: invoice.clientDetails?.email || '',
                 createdAt: invoice.createdAt,
                 createdBy: invoice.issuerId,
                 createdByName: creator?.name || creator?.email || 'Unknown User',
                 createdByEmail: creator?.email || '',
                 approvalCount: invoice.approvalCount || 0,
                 requiredApprovals: invoice.requiredApprovals || 1,
                 approvals: invoice.approvals || []
               };
             })
           );

    return {
      success: true,
      data: enrichedInvoices
    };
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return { success: false, message: 'Failed to get pending approvals' };
  }
}



