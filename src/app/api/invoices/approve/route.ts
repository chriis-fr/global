import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { InvoiceService } from '@/lib/services/invoiceService';

// POST /api/invoices/approve - Approve or reject an invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { invoiceId, action, reason, comments } = body;

    if (!invoiceId || !action) {
      return NextResponse.json(
        { success: false, message: 'Invoice ID and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the invoice
    const invoice = await InvoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if user belongs to the same organization
    if (invoice.organizationId.toString() !== user.organizationId?.toString()) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(
      invoice.organizationId.toString(), 
      user._id!.toString()
    );
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can approve/reject invoices' },
        { status: 403 }
      );
    }

    // Check if invoice is pending approval
    if (invoice.status !== 'pending_approval') {
      return NextResponse.json(
        { success: false, message: 'Invoice is not pending approval' },
        { status: 400 }
      );
    }

    let updatedInvoice;

    if (action === 'approve') {
      // Approve the invoice
      updatedInvoice = await InvoiceService.updateInvoice(invoiceId, {
        status: 'sent',
        approvalWorkflow: {
          ...invoice.approvalWorkflow,
          requiresApproval: invoice.approvalWorkflow?.requiresApproval ?? true,
          submittedBy: invoice.approvalWorkflow?.submittedBy ?? invoice.issuerId,
          submittedAt: invoice.approvalWorkflow?.submittedAt ?? invoice.createdAt,
          approvedBy: user._id,
          approvedAt: new Date(),
          comments
        }
      });

      // Send the invoice
      if (updatedInvoice) {
        await InvoiceService.sendInvoice(invoiceId);
      }
    } else {
      // Reject the invoice
      updatedInvoice = await InvoiceService.updateInvoice(invoiceId, {
        status: 'rejected',
        approvalWorkflow: {
          ...invoice.approvalWorkflow,
          requiresApproval: invoice.approvalWorkflow?.requiresApproval ?? true,
          submittedBy: invoice.approvalWorkflow?.submittedBy ?? invoice.issuerId,
          submittedAt: invoice.approvalWorkflow?.submittedAt ?? invoice.createdAt,
          rejectedBy: user._id,
          rejectedAt: new Date(),
          rejectionReason: reason,
          comments
        }
      });
    }

    if (!updatedInvoice) {
      return NextResponse.json(
        { success: false, message: 'Failed to update invoice' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: `Invoice ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing invoice approval:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process invoice approval',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 