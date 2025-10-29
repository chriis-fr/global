import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApprovalService } from '@/lib/services/approvalService';
import { NotificationService } from '@/lib/services/notificationService';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { BillWithApproval, ApprovalWorkflow } from '@/types/approval';

// GET /api/bills - Get bills for organization
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
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization and check permissions
    let organization = null;
    let member = null;
    
    if (user.organizationId) {
      organization = await db.collection('organizations').findOne({
        _id: user.organizationId
      });

      if (organization) {
        member = organization.members.find((m: { userId: string }) => m.userId.toString() === user._id?.toString());
      }
    }

    // Check if user can view bills
    if (user.organizationId && member) {
      const canViewBills = RBACService.hasPermission(member, 'read', 'bill');
      if (!canViewBills) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions to view bills' },
          { status: 403 }
        );
      }
    }

    // Get bills based on user type
    let bills;
    if (user.organizationId) {
      // Organization member - get organization bills
      bills = await db.collection('bills').find({
        organizationId: user.organizationId
      }).sort({ createdAt: -1 }).toArray();
    } else {
      // Individual user - get their own bills
      bills = await db.collection('bills').find({
        createdBy: user._id
      }).sort({ createdAt: -1 }).toArray();
    }

    // Enrich bills with approval workflow data
    const enrichedBills = await Promise.all(
      bills.map(async (bill) => {
        const workflow = await ApprovalService.getApprovalWorkflow(bill._id.toString());
        return {
          ...bill,
          approvalWorkflow: workflow
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedBills,
      message: 'Bills retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting bills:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to get bills',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/bills - Create new bill
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
    const { vendor, amount, currency, description, category, dueDate } = body;

    // Validate required fields
    if (!vendor || !amount || !description || !dueDate) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization and check permissions
    let organization = null;
    let member = null;
    
    if (user.organizationId) {
      organization = await db.collection('organizations').findOne({
        _id: user.organizationId
      });

      if (organization) {
        member = organization.members.find((m: { userId: string }) => m.userId.toString() === user._id?.toString());
      }
    }

    // Check if user can create bills
    if (user.organizationId && member) {
      const canCreateBills = RBACService.canCreateBills(member);
      if (!canCreateBills) {
        return NextResponse.json(
          { success: false, message: 'Insufficient permissions to create bills' },
          { status: 403 }
        );
      }
    }

    // Create bill
    const billData: BillWithApproval = {
      organizationId: user.organizationId?.toString() || user._id?.toString(),
      vendor,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      description,
      category: category || 'other',
      dueDate: new Date(dueDate),
      approvalStatus: 'draft',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user._id!.toString()
    };

    // Ensure we don't pass a string _id to Mongo; let Mongo generate one
    const billToInsert: Omit<BillWithApproval, '_id'> = { ...billData };
    delete (billToInsert as { _id?: unknown })._id;
    const result = await db.collection('bills').insertOne(billToInsert as unknown as Record<string, unknown>);
    
    if (!result.insertedId) {
      return NextResponse.json(
        { success: false, message: 'Failed to create bill' },
        { status: 500 }
      );
    }

    const billId = result.insertedId.toString();
    billData._id = billId;

    // Get approval settings
    const approvalSettings = await ApprovalService.getApprovalSettings(
      user.organizationId?.toString() || user._id?.toString()
    );

    let workflow: ApprovalWorkflow | null = null;
    let approvalStatus = 'draft';

    // If approval is required, create workflow
    if (approvalSettings?.requireApproval) {
      workflow = await ApprovalService.createApprovalWorkflow(
        billId,
        user.organizationId?.toString() || user._id?.toString(),
        user._id!.toString(),
        parseFloat(amount)
      );

      if (workflow) {
        const activeWorkflow = workflow; // Store in const for proper type narrowing
        approvalStatus = activeWorkflow.status === 'approved' ? 'approved' : 'pending_approval';
        
        // Update bill with approval status
        await db.collection('bills').updateOne(
          { _id: new ObjectId(billId) },
          { 
            $set: { 
              approvalStatus,
              updatedAt: new Date()
            }
          }
        );

        // Send approval notifications if workflow is pending
        if (activeWorkflow.status === 'pending') {
          const currentStepNumber = activeWorkflow.currentStep;
          const currentStep = activeWorkflow.approvals.find(step => step.stepNumber === currentStepNumber);
          if (currentStep) {
            // Get organization name for notifications
            const orgName = organization?.name || 'Your Organization';
            
            // Send notification to current approver
            await NotificationService.sendApprovalRequest(
              currentStep.approverEmail,
              currentStep.approverEmail, // We don't have the approver's name here
              {
                vendor,
                amount: parseFloat(amount),
                currency: currency || 'USD',
                description,
                dueDate
              },
              activeWorkflow,
              orgName
            );
          }
        }
      }
    } else {
      // No approval required, mark as approved
      approvalStatus = 'approved';
      await db.collection('bills').updateOne(
        { _id: new ObjectId(billId) },
        { 
          $set: { 
            approvalStatus,
            updatedAt: new Date()
          }
        }
      );
    }

    // Log the bill creation
    await ApprovalService.logAuditAction(
      user.organizationId?.toString() || user._id!.toString(),
      user._id!.toString(),
      'create',
      'bill',
      billId,
      'Bill created',
      { 
        vendor, 
        amount: parseFloat(amount), 
        currency: currency || 'USD',
        approvalStatus,
        hasWorkflow: !!workflow
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        ...billData,
        approvalWorkflow: workflow,
        approvalStatus
      },
      message: 'Bill created successfully'
    });

  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create bill',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
