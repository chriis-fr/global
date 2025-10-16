import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { connectToDatabase } from '@/lib/database';

// GET /api/invoices/pending-approvals - Get invoices pending approval
export async function GET() {
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

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(
      user.organizationId.toString(), 
      user._id!.toString()
    );
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can view pending approvals' },
        { status: 403 }
      );
    }

    const db = await connectToDatabase();
    
    // Get invoices pending approval for this organization
    const pendingInvoices = await db.collection('invoices').find({
      organizationId: user.organizationId,
      status: 'pending_approval'
    }).toArray();

    // Get user details for each invoice
    const invoicesWithUserDetails = await Promise.all(
      pendingInvoices.map(async (invoice) => {
        const submittedBy = await UserService.getUserById(invoice.approvalWorkflow?.submittedBy?.toString() || '');
        return {
          ...invoice,
          submittedBy: submittedBy ? {
            name: submittedBy.name,
            email: submittedBy.email,
            profilePicture: submittedBy.profilePicture || submittedBy.avatar
          } : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        pendingInvoices: invoicesWithUserDetails,
        count: invoicesWithUserDetails.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch pending approvals',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 