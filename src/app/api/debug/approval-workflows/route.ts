import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    
    // Get user
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    console.log('🔍 [Debug Approval Workflows] User details:', {
      _id: user._id,
      email: user.email,
      organizationId: user.organizationId
    });

    // Get all approval workflows
    const allWorkflows = await db.collection('approval_workflows').find({}).toArray();
    
    console.log('🔍 [Debug Approval Workflows] All workflows:', {
      count: allWorkflows.length,
      workflows: allWorkflows.map(w => ({
        _id: w._id,
        status: w.status,
        organizationId: w.organizationId,
        billId: w.billId,
        currentStep: w.currentStep,
        createdBy: w.createdBy,
          approvals: w.approvals?.map((a: { stepNumber: number; approverId: string; approverEmail: string; approverRole: string; decision: string }) => ({
          stepNumber: a.stepNumber,
          approverId: a.approverId,
          approverEmail: a.approverEmail,
          approverRole: a.approverRole,
          decision: a.decision
        }))
      }))
    });

    // Get all payables with pending_approval status
    const pendingPayables = await db.collection('payables').find({
      status: 'pending_approval'
    }).toArray();

    console.log('🔍 [Debug Approval Workflows] Pending payables:', {
      count: pendingPayables.length,
      payables: pendingPayables.map(p => ({
        _id: p._id,
        payableNumber: p.payableNumber,
        organizationId: p.organizationId,
        userId: p.userId,
        status: p.status,
        total: p.total,
        currency: p.currency
      }))
    });

    // Check if user is in organization and can approve
    if (user.organizationId) {
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(user.organizationId)
      });

      if (organization) {
        const member = organization.members.find((m: { userId: string }) => 
          m.userId.toString() === user._id?.toString()
        );

        console.log('🔍 [Debug Approval Workflows] User organization membership:', {
          organizationId: user.organizationId,
          organizationName: organization.name,
          userRole: member?.role,
          canApprove: member && ['owner', 'admin', 'approver'].includes(member.role)
        });

        // Find workflows where this user is an approver
        const userWorkflows = allWorkflows.filter(w => 
          w.approvals?.some((a: { approverId: string }) => a.approverId === user._id?.toString())
        );

        console.log('🔍 [Debug Approval Workflows] Workflows where user is approver:', {
          count: userWorkflows.length,
          workflows: userWorkflows.map(w => ({
            _id: w._id,
            status: w.status,
            billId: w.billId,
            currentStep: w.currentStep,
            userApprovalStep: w.approvals?.find((a: { approverId: string }) => a.approverId === user._id?.toString())
          }))
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Approval workflows debug info',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          organizationId: user.organizationId
        },
        allWorkflows: allWorkflows.map(w => ({
          _id: w._id,
          status: w.status,
          organizationId: w.organizationId,
          billId: w.billId,
          currentStep: w.currentStep,
          createdBy: w.createdBy,
          approvals: w.approvals?.map((a: { stepNumber: number; approverId: string; approverEmail: string; approverRole: string; decision: string }) => ({
            stepNumber: a.stepNumber,
            approverId: a.approverId,
            approverEmail: a.approverEmail,
            approverRole: a.approverRole,
            decision: a.decision
          }))
        })),
        pendingPayables: pendingPayables.map(p => ({
          _id: p._id,
          payableNumber: p.payableNumber,
          organizationId: p.organizationId,
          userId: p.userId,
          status: p.status,
          total: p.total,
          currency: p.currency
        }))
      }
    });

  } catch (error) {
    console.error('Error debugging approval workflows:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to debug approval workflows' },
      { status: 500 }
    );
  }
}
