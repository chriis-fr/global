import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    
    // Get user's organization
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user?.organizationId) {
      return NextResponse.json({ success: false, message: 'User is not part of an organization' });
    }

    // Get organization details
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    // Get pending approval invoices
    const pendingInvoices = await db.collection('invoices').find({
      organizationId: new ObjectId(user.organizationId.toString()),
      status: 'pending_approval'
    }).toArray();

    // Get approved invoices
    const approvedInvoices = await db.collection('invoices').find({
      organizationId: new ObjectId(user.organizationId.toString()),
      status: 'approved'
    }).toArray();

    // Get sent invoices
    const sentInvoices = await db.collection('invoices').find({
      organizationId: new ObjectId(user.organizationId.toString()),
      status: 'sent'
    }).toArray();

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          name: organization?.name,
          approvalSettings: organization?.approvalSettings,
          memberCount: organization?.members?.length || 0,
          approvers: organization?.members?.filter((m: any) => 
            m.role === 'admin' || m.role === 'approver'
          ).length || 0
        },
        invoices: {
          pending: pendingInvoices.map(inv => ({
            id: inv._id?.toString(),
            number: inv.invoiceNumber,
            name: inv.invoiceName,
            amount: inv.total,
            currency: inv.currency,
            clientEmail: inv.clientDetails?.email || inv.clientEmail,
            approvalCount: inv.approvalCount || 0,
            requiredApprovals: inv.requiredApprovals || 1,
            approvals: inv.approvals || []
          })),
          approved: approvedInvoices.map(inv => ({
            id: inv._id?.toString(),
            number: inv.invoiceNumber,
            name: inv.invoiceName,
            amount: inv.total,
            currency: inv.currency,
            clientEmail: inv.clientDetails?.email || inv.clientEmail,
            approvalCount: inv.approvalCount || 0,
            requiredApprovals: inv.requiredApprovals || 1
          })),
          sent: sentInvoices.map(inv => ({
            id: inv._id?.toString(),
            number: inv.invoiceNumber,
            name: inv.invoiceName,
            amount: inv.total,
            currency: inv.currency,
            clientEmail: inv.clientDetails?.email || inv.clientEmail,
            sentAt: inv.sentAt
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error in approval flow debug:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get approval flow data' },
      { status: 500 }
    );
  }
}
