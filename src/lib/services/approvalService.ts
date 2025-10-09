import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { 
  ApprovalSettings, 
  ApprovalWorkflow, 
  ApprovalStep, 
  AuditLog,
  OrganizationMemberWithApproval,
  BillWithApproval
} from '@/types/approval';
import { NotificationService } from './notificationService';

export class ApprovalService {
  // Get organization approval settings
  static async getApprovalSettings(organizationId: string): Promise<ApprovalSettings | null> {
    try {
      const db = await getDatabase();
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(organizationId)
      });

      if (!organization) {
        return null;
      }

      // Return approval settings or default settings with organization email
      return organization.approvalSettings || this.getDefaultApprovalSettings(organization.billingEmail);
    } catch (error) {
      console.error('Error getting approval settings:', error);
      return null;
    }
  }

  // Update organization approval settings
  static async updateApprovalSettings(
    organizationId: string, 
    settings: Partial<ApprovalSettings>
  ): Promise<boolean> {
    try {
      const db = await getDatabase();
      
      const result = await db.collection('organizations').updateOne(
        { _id: new ObjectId(organizationId) },
        { 
          $set: { 
            approvalSettings: settings,
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating approval settings:', error);
      return false;
    }
  }

  // Create approval workflow for a bill
  static async createApprovalWorkflow(
    billId: string,
    organizationId: string,
    createdBy: string,
    amount: number
  ): Promise<ApprovalWorkflow | null> {
    try {
      const db = await getDatabase();
      
      // Get organization approval settings
      const settings = await this.getApprovalSettings(organizationId);
      if (!settings) {
        console.error('No approval settings found for organization');
        return null;
      }

      // Determine amount threshold
      const amountThreshold = this.getAmountThreshold(amount, settings);
      const requiredApprovers = settings.approvalRules.requiredApprovers[amountThreshold];

      // Check if auto-approval applies
      const autoApproved = this.shouldAutoApprove(amount, settings);

      // Get organization members with approval permissions
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(organizationId)
      });

      if (!organization) {
        console.error('Organization not found');
        return null;
      }

      // Find approvers
      const approvers = this.findApprovers(organization.members, settings);
      const fallbackApprovers = this.findFallbackApprovers(organization.members, settings);
      
      console.log('🔍 [ApprovalService] Creating approval workflow:', {
        organizationId,
        createdBy,
        amount,
        amountThreshold,
        requiredApprovers,
        autoApproved,
        approvers: approvers.map(a => ({ userId: a.userId, email: a.email, role: a.role })),
        fallbackApprovers: fallbackApprovers.map(a => ({ userId: a.userId, email: a.email, role: a.role }))
      });

      // Create approval steps
      const approvalSteps: ApprovalStep[] = [];
      
      if (!autoApproved) {
        for (let i = 0; i < requiredApprovers; i++) {
          const approver = approvers[i] || fallbackApprovers[i % fallbackApprovers.length];
          
          if (approver) {
            approvalSteps.push({
              stepNumber: i + 1,
              approverId: approver.userId,
              approverEmail: approver.email,
              approverRole: approver.role,
              decision: 'pending',
              assignedAt: new Date(),
              isFallback: i >= approvers.length,
              autoApproved: false
            });
          }
        }
      }

      // Create approval workflow
      const workflow: ApprovalWorkflow = {
        billId,
        organizationId,
        status: autoApproved ? 'approved' : 'pending',
        approvals: approvalSteps,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
        currentStep: autoApproved ? approvalSteps.length + 1 : 1,
        assignedApprovers: approvers.map(a => a.userId),
        fallbackApprovers: fallbackApprovers.map(a => a.userId),
        appliedRules: {
          amountThreshold,
          requiredApprovers,
          autoApproved,
          reason: autoApproved ? 'Auto-approved based on rules' : undefined
        }
      };

      // Save to database
      const result = await db.collection('approval_workflows').insertOne(workflow);
      
      console.log('✅ [ApprovalService] Approval workflow created:', {
        workflowId: result.insertedId,
        workflow: {
          _id: result.insertedId,
          status: workflow.status,
          organizationId: workflow.organizationId,
          billId: workflow.billId,
          currentStep: workflow.currentStep,
          approvals: workflow.approvals.map(a => ({
            stepNumber: a.stepNumber,
            approverId: a.approverId,
            approverEmail: a.approverEmail,
            decision: a.decision
          }))
        }
      });
      
      if (result.insertedId) {
        workflow._id = result.insertedId.toString();
        
        // Log the creation
        await this.logAuditAction(
          organizationId,
          createdBy,
          'create',
          'approval',
          result.insertedId.toString(),
          'Approval workflow created',
          { amount, amountThreshold, requiredApprovers, autoApproved }
        );

        return workflow;
      }

      return null;
    } catch (error) {
      console.error('Error creating approval workflow:', error);
      return null;
    }
  }

  // Process approval decision
  static async processApprovalDecision(
    workflowId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<boolean> {
    try {
      const db = await getDatabase();
      
      // Get workflow
      const workflow = await db.collection('approval_workflows').findOne({
        _id: new ObjectId(workflowId)
      });

      if (!workflow) {
        console.error('Approval workflow not found');
        return false;
      }

      // Find the current approval step
      const currentStep = workflow.approvals.find(
        (step: ApprovalStep) => step.stepNumber === workflow.currentStep
      );

      if (!currentStep) {
        console.error('Current approval step not found');
        return false;
      }

      // Verify approver
      if (currentStep.approverId !== approverId) {
        console.error('Approver mismatch');
        return false;
      }

      // Update approval step
      const updatedApprovals = workflow.approvals.map((step: ApprovalStep) => {
        if (step.stepNumber === workflow.currentStep) {
          return {
            ...step,
            decision,
            comments,
            completedAt: new Date()
          };
        }
        return step;
      });

      // Determine next status
      let newStatus: 'pending' | 'approved' | 'rejected' | 'cancelled';
      let nextStep = workflow.currentStep;

      if (decision === 'rejected') {
        newStatus = 'rejected';
      } else if (workflow.currentStep >= workflow.approvals.length) {
        newStatus = 'approved';
        nextStep = workflow.currentStep + 1;
      } else {
        newStatus = 'pending';
        nextStep = workflow.currentStep + 1;
      }

      // Update workflow
      const result = await db.collection('approval_workflows').updateOne(
        { _id: new ObjectId(workflowId) },
        {
          $set: {
            status: newStatus,
            approvals: updatedApprovals,
            currentStep: nextStep,
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        // Log the approval action
        await this.logAuditAction(
          workflow.organizationId,
          approverId,
          decision === 'approved' ? 'approve' : 'reject',
          'approval',
          workflowId,
          `Bill ${decision} by approver`,
          { 
            billId: workflow.billId,
            stepNumber: workflow.currentStep,
            comments,
            finalStatus: newStatus
          }
        );

        // Send notifications
        await this.sendApprovalNotifications(workflow, decision, comments, approverId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error processing approval decision:', error);
      return false;
    }
  }

  // Get approval workflow for a bill
  static async getApprovalWorkflow(billId: string): Promise<ApprovalWorkflow | null> {
    try {
      const db = await getDatabase();
      
      const workflow = await db.collection('approval_workflows').findOne({
        billId
      });

      return workflow;
    } catch (error) {
      console.error('Error getting approval workflow:', error);
      return null;
    }
  }

  // Update workflow with bill ID after bill creation
  static async updateWorkflowBillId(workflowId: string, billId: ObjectId): Promise<boolean> {
    try {
      const db = await getDatabase();
      
      const result = await db.collection('approval_workflows').updateOne(
        { _id: new ObjectId(workflowId) },
        { 
          $set: { 
            billId: billId,
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating workflow bill ID:', error);
      return false;
    }
  }

  // Get pending approvals for a user
  static async getPendingApprovals(userId: string): Promise<ApprovalWorkflow[]> {
    try {
      const db = await getDatabase();
      
      console.log('🔍 [ApprovalService] Getting pending approvals for userId:', userId);
      
      // First, let's see all approval workflows for debugging
      const allWorkflows = await db.collection('approval_workflows').find({}).toArray();
      console.log('🔍 [ApprovalService] All approval workflows found:', {
        count: allWorkflows.length,
        workflows: allWorkflows.map(w => ({
          _id: w._id,
          status: w.status,
          organizationId: w.organizationId,
          billId: w.billId,
          currentStep: w.currentStep,
          approvals: w.approvals?.map((a: any) => ({
            stepNumber: a.stepNumber,
            approverId: a.approverId,
            approverEmail: a.approverEmail,
            decision: a.decision
          }))
        }))
      });
      
      // Get all pending workflows where user is an approver
      // Handle both string and ObjectId user IDs
      const allPendingWorkflows = await db.collection('approval_workflows').find({
        status: 'pending',
        $or: [
          { 'approvals.approverId': userId },
          { 'approvals.approverId': new ObjectId(userId) }
        ],
        'approvals.decision': 'pending'
      }).toArray();

      // Filter to only include workflows where the user's step is current or past
      const workflows = allPendingWorkflows.filter(workflow => {
        const userApproval = workflow.approvals.find((approval: any) => {
          // Handle both string and ObjectId comparisons
          const approverIdStr = approval.approverId?.toString();
          const userIdStr = userId.toString();
          return approverIdStr === userIdStr && approval.decision === 'pending';
        });
        return userApproval && userApproval.stepNumber <= workflow.currentStep;
      });

      console.log('🔍 [ApprovalService] Pending approvals found for user:', {
        userId,
        count: workflows.length,
        workflows: workflows.map(w => ({
          _id: w._id,
          status: w.status,
          billId: w.billId,
          currentStep: w.currentStep
        }))
      });

      return workflows;
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }

  // Log audit action
  static async logAuditAction(
    organizationId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Get user details - handle both string and ObjectId userId
      const userQuery = typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId) 
        ? { _id: new ObjectId(userId) }
        : { _id: userId };
      
      const user = await db.collection('users').findOne(userQuery);

      if (!user) {
        console.error('User not found for audit log');
        return;
      }

      // Get user role in organization
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(organizationId),
        'members.userId': userId
      });

      const member = organization?.members.find((m: any) => m.userId === userId);
      const userRole = member?.role || 'unknown';

      const auditLog: AuditLog = {
        organizationId,
        userId,
        userEmail: user.email,
        userRole,
        action: action as any,
        entityType: entityType as any,
        entityId,
        details: {
          description,
          metadata
        },
        timestamp: new Date()
      };

      await db.collection('audit_logs').insertOne(auditLog);
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  }

  // Helper methods
  private static getDefaultApprovalSettings(billingEmail?: string): ApprovalSettings {
    return {
      requireApproval: true,
      approvalRules: {
        amountThresholds: {
          low: 100,      // Under $100 - auto approve
          medium: 1000,  // $100-$1000 - single approval
          high: 1000     // Over $1000 - requires approval even for owners
        },
        currency: 'USD',
        requiredApprovers: {
          low: 1,
          medium: 1,
          high: 2
        },
        fallbackApprovers: [],
        autoApprove: {
          enabled: false,
          conditions: {
            vendorWhitelist: [],
            categoryWhitelist: [],
            amountLimit: 100
          }
        }
      },
      emailSettings: {
        primaryEmail: billingEmail || '',
        notificationEmails: [],
        approvalNotifications: true,
        paymentNotifications: true
      }
    };
  }

  private static getAmountThreshold(amount: number, settings: ApprovalSettings): 'low' | 'medium' | 'high' {
    if (amount < settings.approvalRules.amountThresholds.low) {
      return 'low';
    } else if (amount < settings.approvalRules.amountThresholds.medium) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  private static shouldAutoApprove(amount: number, settings: ApprovalSettings): boolean {
    if (!settings.approvalRules.autoApprove.enabled) {
      return false;
    }

    const { conditions } = settings.approvalRules.autoApprove;
    
    // Check amount limit
    if (amount <= conditions.amountLimit) {
      return true;
    }

    // Additional auto-approval conditions can be added here
    return false;
  }

  private static findApprovers(members: any[], settings: ApprovalSettings): any[] {
    return members.filter((member: any) => 
      member.role === 'approver' && member.status === 'active'
    );
  }

  private static findFallbackApprovers(members: any[], settings: ApprovalSettings): any[] {
    return members.filter((member: any) => 
      (member.role === 'admin' || member.role === 'owner') && member.status === 'active'
    );
  }

  // Send approval notifications
  private static async sendApprovalNotifications(
    workflow: ApprovalWorkflow,
    decision: 'approved' | 'rejected',
    comments: string | undefined,
    approverId: string
  ): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Get bill details
      const bill = await db.collection('bills').findOne({
        _id: new ObjectId(workflow.billId)
      });

      if (!bill) {
        console.error('Bill not found for notification');
        return;
      }

      // Get organization details
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(workflow.organizationId)
      });

      if (!organization) {
        console.error('Organization not found for notification');
        return;
      }

      // Get bill creator details
      const creator = await db.collection('users').findOne({
        _id: new ObjectId(workflow.createdBy)
      });

      if (!creator) {
        console.error('Bill creator not found for notification');
        return;
      }

      // Get approver details
      const approver = await db.collection('users').findOne({
        _id: new ObjectId(approverId)
      });

      if (!approver) {
        console.error('Approver not found for notification');
        return;
      }

      // Send notification to bill creator
      await NotificationService.sendApprovalDecision(
        creator.email,
        creator.name || creator.email,
        decision,
        {
          vendor: bill.vendor,
          amount: bill.amount,
          currency: bill.currency,
          description: bill.description
        },
        approver.name || approver.email,
        comments,
        organization.name
      );

      // If approved and there are more steps, notify next approver
      if (decision === 'approved' && workflow.currentStep <= workflow.approvals.length) {
        const nextStep = workflow.approvals.find(step => step.stepNumber === workflow.currentStep);
        if (nextStep) {
          await NotificationService.sendApprovalRequest(
            nextStep.approverEmail,
            nextStep.approverEmail, // We don't have the approver's name here
            {
              vendor: bill.vendor,
              amount: bill.amount,
              currency: bill.currency,
              description: bill.description,
              dueDate: bill.dueDate.toISOString()
            },
            workflow,
            organization.name
          );
        }
      }

    } catch (error) {
      console.error('Error sending approval notifications:', error);
    }
  }
}
