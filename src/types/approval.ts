// Approval Workflow Types
export interface ApprovalSettings {
  // Main approval toggle
  requireApproval: boolean;
  
  // Approval rules
  approvalRules: {
    // Bill amount thresholds
    amountThresholds: {
      low: number;      // < $1000 - auto approve
      medium: number;   // $1000-$10000 - single approval
      high: number;     // > $10000 - dual approval
    };
    
    // Currency for thresholds
    currency: string;   // USD, EUR, etc.
    
    // Required approvers by amount
    requiredApprovers: {
      low: number;      // 1 approver
      medium: number;   // 1 approver
      high: number;     // 2 approvers
    };
    
    // Fallback approvers (Admin/Owner emails)
    fallbackApprovers: string[];
    
    // Auto-approval rules
    autoApprove: {
      enabled: boolean;
      conditions: {
        vendorWhitelist: string[];    // Pre-approved vendors
        categoryWhitelist: string[];  // Pre-approved categories
        amountLimit: number;          // Auto-approve under this amount
      };
    };
  };
  
  // Email settings
  emailSettings: {
    primaryEmail: string;           // Organization's primary email
    notificationEmails: string[];   // Additional notification emails
    approvalNotifications: boolean; // Send approval notifications
    paymentNotifications: boolean;  // Send payment notifications
  };
}

export interface ApprovalWorkflow {
  _id?: string;
  billId: string;
  organizationId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  
  // Approval chain
  approvals: ApprovalStep[];
  
  // Workflow metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the bill
  currentStep: number; // Current step in approval chain
  
  // Routing information
  assignedApprovers: string[]; // User IDs of assigned approvers
  fallbackApprovers: string[]; // User IDs of fallback approvers
  
  // Approval rules applied
  appliedRules: {
    amountThreshold: 'low' | 'medium' | 'high';
    requiredApprovers: number;
    autoApproved: boolean;
    reason?: string;
  };
}

export interface ApprovalStep {
  _id?: string;
  stepNumber: number;
  approverId: string;
  approverEmail: string;
  approverRole: string;
  
  // Approval decision
  decision: 'pending' | 'approved' | 'rejected';
  comments?: string;
  
  // Timestamps
  assignedAt: Date;
  completedAt?: Date;
  
  // Metadata
  isFallback: boolean; // Whether this was a fallback approver
  autoApproved: boolean; // Whether this was auto-approved
}

export interface AuditLog {
  _id?: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  
  // Action details
  action: 'create' | 'approve' | 'reject' | 'pay' | 'reconcile' | 'export' | 'settings_change';
  entityType: 'bill' | 'payment' | 'approval' | 'organization' | 'member';
  entityId: string;
  
  // Action metadata
  details: {
    description: string;
    previousValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  };
  
  // Timestamps
  timestamp: Date;
  
  // IP and session info
  ipAddress?: string;
  userAgent?: string;
}

// Extended organization member with approval permissions
export interface OrganizationMemberWithApproval extends OrganizationMember {
  // Approval-specific permissions
  canApprove: boolean;
  canCreateBills: boolean;
  canExecutePayments: boolean;
  canManageTreasury: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
  
  // Approval limits
  approvalLimits: {
    maxAmount: number; // Maximum amount they can approve
    requiresDualApproval: boolean; // Whether their approvals need second approval
  };
}

// Bill status with approval workflow
export interface BillWithApproval {
  _id?: string;
  organizationId: string;
  
  // Bill details
  vendor: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  dueDate: Date;
  
  // Approval workflow
  approvalWorkflow?: ApprovalWorkflow;
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  
  // Payment details
  paymentMethod?: string;
  paymentStatus: 'pending' | 'scheduled' | 'completed' | 'failed';
  paidAt?: Date;
  paidBy?: string;
  
  // Standard bill fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
