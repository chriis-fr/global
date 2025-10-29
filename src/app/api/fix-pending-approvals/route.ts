import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ApprovalService } from '@/lib/services/approvalService';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    
    // Get user
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not in organization' },
        { status: 404 }
      );
    }

    console.log('🔧 [Fix Pending Approvals] Starting fix for organization:', user.organizationId);

    // Find all payables with pending_approval status that don't have approval workflows
    const pendingPayables = await db.collection('payables').find({
      organizationId: user.organizationId,
      status: 'pending_approval'
    }).toArray();

    console.log('🔧 [Fix Pending Approvals] Found pending payables:', {
      count: pendingPayables.length,
      payables: pendingPayables.map(p => ({
        _id: p._id,
        payableNumber: p.payableNumber,
        total: p.total,
        currency: p.currency
      }))
    });

    let fixedCount = 0;
    let errorCount = 0;

    for (const payable of pendingPayables) {
      try {
        // Check if approval workflow already exists for this payable
        const existingWorkflow = await db.collection('approval_workflows').findOne({
          billId: payable._id.toString()
        });

        if (existingWorkflow) {
          console.log('⏭️ [Fix Pending Approvals] Workflow already exists for payable:', payable.payableNumber);
          continue;
        }

        // Create approval workflow for this payable
        const approvalWorkflow = await ApprovalService.createApprovalWorkflow(
          payable._id.toString(),
          user.organizationId,
          payable.userId || user.email,
          payable.total || 0
        );

        if (approvalWorkflow) {
          console.log('✅ [Fix Pending Approvals] Created workflow for payable:', {
            payableNumber: payable.payableNumber,
            workflowId: approvalWorkflow._id
          });
          fixedCount++;
        } else {
          console.error('❌ [Fix Pending Approvals] Failed to create workflow for payable:', payable.payableNumber);
          errorCount++;
        }
      } catch (error) {
        console.error('❌ [Fix Pending Approvals] Error processing payable:', payable.payableNumber, error);
        errorCount++;
      }
    }

    console.log('🔧 [Fix Pending Approvals] Fix completed:', {
      totalPayables: pendingPayables.length,
      fixedCount,
      errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Pending approvals fix completed',
      data: {
        totalPayables: pendingPayables.length,
        fixedCount,
        errorCount
      }
    });

  } catch (error) {
    console.error('Error fixing pending approvals:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fix pending approvals' },
      { status: 500 }
    );
  }
}
