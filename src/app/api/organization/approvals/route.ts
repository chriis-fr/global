import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApprovalService } from '@/lib/services/approvalService';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET /api/organization/approvals - Get pending approvals for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can approve bills
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: any) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canApproveBills(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions to view approvals' },
        { status: 403 }
      );
    }

    // Get pending approvals for this user
    const pendingApprovals = await ApprovalService.getPendingApprovals(user._id!.toString());

    // Enrich with bill details
    const enrichedApprovals = await Promise.all(
      pendingApprovals.map(async (approval) => {
        const bill = await db.collection('bills').findOne({
          _id: new ObjectId(approval.billId)
        });

        return {
          ...approval,
          bill: bill ? {
            _id: bill._id,
            vendor: bill.vendor,
            amount: bill.amount,
            currency: bill.currency,
            description: bill.description,
            category: bill.category,
            dueDate: bill.dueDate,
            createdAt: bill.createdAt
          } : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedApprovals,
      message: 'Pending approvals retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to get pending approvals',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/organization/approvals - Process approval decision
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflowId, decision, comments } = body;

    if (!workflowId || !decision) {
      return NextResponse.json(
        { success: false, message: 'Workflow ID and decision are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, message: 'Decision must be either "approved" or "rejected"' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can approve bills
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: any) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canApproveBills(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions to approve bills' },
        { status: 403 }
      );
    }

    // Process the approval decision
    const success = await ApprovalService.processApprovalDecision(
      workflowId,
      user._id!.toString(),
      decision,
      comments
    );

    if (success) {
      // If approved and this was the final approval, update bill status
      if (decision === 'approved') {
        const workflow = await ApprovalService.getApprovalWorkflow(workflowId);
        if (workflow && workflow.status === 'approved') {
          // Update bill status to approved
          await db.collection('bills').updateOne(
            { _id: new ObjectId(workflow.billId) },
            { 
              $set: { 
                approvalStatus: 'approved',
                updatedAt: new Date()
              }
            }
          );
        }
      } else if (decision === 'rejected') {
        // Update bill status to rejected
        const workflow = await ApprovalService.getApprovalWorkflow(workflowId);
        if (workflow) {
          await db.collection('bills').updateOne(
            { _id: new ObjectId(workflow.billId) },
            { 
              $set: { 
                approvalStatus: 'rejected',
                updatedAt: new Date()
              }
            }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: `Bill ${decision} successfully`
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to process approval decision' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error processing approval decision:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process approval decision',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
