import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { 
  ApprovalSettings, 
  ApprovalWorkflow, 
  ApprovalStep, 
  AuditLog
} from '@/types/approval';
import { NotificationService } from './notificationService';

// Type definitions for database operations
interface DatabaseWorkflow extends Omit<ApprovalWorkflow, '_id'> {
  _id?: ObjectId;
}

interface DatabaseAuditLog extends Omit<AuditLog, '_id'> {
  _id?: ObjectId;
}

interface OrganizationMember {
  userId: string | ObjectId;
  email: string;
  role: string;
  status: string;
}


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
    } catch {
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
    } catch {
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
        return null;
      }

      // Find approvers
      const approvers = this.findApprovers(organization.members);
      const fallbackApprovers = this.findFallbackApprovers(organization.members);
      
      // Creating approval workflow

      // Create approval steps
      const approvalSteps: ApprovalStep[] = [];
      
      if (!autoApproved) {
        for (let i = 0; i < requiredApprovers; i++) {
          const approver = approvers[i] || fallbackApprovers[i % fallbackApprovers.length];
          
          if (approver) {
            approvalSteps.push({
              stepNumber: i + 1,
              approverId: approver.userId.toString(),
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
        assignedApprovers: approvers.map(a => a.userId.toString()),
        fallbackApprovers: fallbackApprovers.map(a => a.userId.toString()),
        appliedRules: {
          amountThreshold,
          requiredApprovers,
          autoApproved,
          reason: autoApproved ? 'Auto-approved based on rules' : undefined
        }
      };

      // Save to database
      const result = await db.collection('approval_workflows').insertOne(workflow as DatabaseWorkflow);
      
      // Approval workflow created successfully
      
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
    } catch {
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
        return false;
      }

      // Find the current approval step
      const currentStep = workflow.approvals.find(
        (step: ApprovalStep) => step.stepNumber === workflow.currentStep
      );

      if (!currentStep) {
        return false;
      }

      // Verify approver (handle both ObjectId and string types)
      const currentApproverId = currentStep.approverId?.toString();
      const approverIdStr = approverId.toString();
      
      if (currentApproverId !== approverIdStr) {
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
      } else {
        // Check if this was the last approval step
        const completedApprovals = updatedApprovals.filter((step: ApprovalStep) => step.decision === 'approved').length;
        const totalApprovals = workflow.approvals.length;
        
        if (completedApprovals >= totalApprovals) {
          newStatus = 'approved';
          nextStep = workflow.currentStep + 1;
        } else {
          newStatus = 'pending';
          nextStep = workflow.currentStep + 1;
        }
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

        // No notifications needed - status updates will be visible in the system

        return true;
      }

      return false;
    } catch {
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

      return workflow as unknown as ApprovalWorkflow;
    } catch {
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
    } catch {
      return false;
    }
  }

  // Get pending approvals for a user
  static async getPendingApprovals(userId: string): Promise<ApprovalWorkflow[]> {
    try {
      const db = await getDatabase();
      
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
      const workflows = allPendingWorkflows.filter((workflow: unknown) => {
        const userApproval = (workflow as ApprovalWorkflow).approvals.find((approval: ApprovalStep) => {
          // Handle both string and ObjectId comparisons
          const approverIdStr = approval.approverId?.toString();
          const userIdStr = userId.toString();
          return approverIdStr === userIdStr && approval.decision === 'pending';
        });
        return userApproval && userApproval.stepNumber <= (workflow as ApprovalWorkflow).currentStep;
      });

      // Pending approvals found

      return workflows as unknown as ApprovalWorkflow[];
    } catch {
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
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Get user details - handle both string and ObjectId userId
      const userQuery = typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId) 
        ? { _id: new ObjectId(userId) }
        : { _id: new ObjectId(userId) };
      
      const user = await db.collection('users').findOne(userQuery);

      if (!user) {
        return;
      }

      // Get user role in organization
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(organizationId),
        'members.userId': userId
      });

      const member = organization?.members.find((m: OrganizationMember) => m.userId === userId);
      const userRole = member?.role || 'unknown';

      const auditLog: AuditLog = {
        organizationId,
        userId,
        userEmail: user.email,
        userRole,
        action: action as 'create' | 'approve' | 'reject' | 'pay' | 'reconcile' | 'export' | 'settings_change',
        entityType: entityType as 'approval' | 'bill' | 'payment' | 'organization' | 'member',
        entityId,
        details: {
          description,
          metadata
        },
        timestamp: new Date()
      };

      await db.collection('audit_logs').insertOne(auditLog as DatabaseAuditLog);
    } catch {
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

  private static findApprovers(members: OrganizationMember[]): OrganizationMember[] {
    return members.filter((member: OrganizationMember) => 
      member.role === 'approver' && member.status === 'active'
    );
  }

  private static findFallbackApprovers(members: OrganizationMember[]): OrganizationMember[] {
    return members.filter((member: OrganizationMember) => 
      (member.role === 'admin' || member.role === 'owner') && member.status === 'active'
    );
  }

  // Send approval notifications - DISABLED: No notifications needed
  private static async sendApprovalNotifications_DISABLED(
    workflow: ApprovalWorkflow,
    decision: 'approved' | 'rejected',
    comments: string | undefined,
    approverId: string
  ): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Get payable details (we use payables, not bills)
      const payable = await db.collection('payables').findOne({
        _id: new ObjectId(workflow.billId)
      });

      if (!payable) {
        return;
      }

      // Get organization details
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(workflow.organizationId)
      });

      if (!organization) {
        return;
      }

      // Get payable creator details
      const creatorQuery = typeof workflow.createdBy === 'string' && /^[0-9a-fA-F]{24}$/.test(workflow.createdBy) 
        ? { _id: new ObjectId(workflow.createdBy) }
        : { _id: new ObjectId(workflow.createdBy) };
      
      const creator = await db.collection('users').findOne(creatorQuery);

      if (!creator) {
        return;
      }

      // Get approver details
      const approverQuery = typeof approverId === 'string' && /^[0-9a-fA-F]{24}$/.test(approverId) 
        ? { _id: new ObjectId(approverId) }
        : { _id: new ObjectId(approverId) };
      
      const approver = await db.collection('users').findOne(approverQuery);

      if (!approver) {
        return;
      }

      // Send notification to payable creator
      await NotificationService.sendApprovalDecision(
        creator.email,
        creator.name || creator.email,
        decision,
        {
          vendor: payable.vendorName || payable.vendor || 'Unknown Vendor',
          amount: payable.total || payable.amount,
          currency: payable.currency,
          description: payable.payableName || payable.description || 'Payable'
        },
        approver.name || approver.email,
        organization.name,
        comments
      );

      // If approved and there are more steps, notify next approver
      if (decision === 'approved' && workflow.currentStep <= workflow.approvals.length) {
        const nextStep = workflow.approvals.find(step => step.stepNumber === workflow.currentStep);
        if (nextStep) {
          await NotificationService.sendApprovalRequest(
            nextStep.approverEmail,
            nextStep.approverEmail, // We don't have the approver's name here
            {
              vendor: payable.vendorName || payable.vendor || 'Unknown Vendor',
              amount: payable.total || payable.amount,
              currency: payable.currency,
              description: payable.payableName || payable.description || 'Payable',
              dueDate: payable.dueDate ? new Date(payable.dueDate).toISOString() : new Date().toISOString()
            },
            workflow,
            organization.name
          );
        }
      }

    } catch {
    }
  }
}
