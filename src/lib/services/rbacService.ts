import { OrganizationMember } from '@/types/organization';

export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: string;
  permissions: Permission[];
  restrictions: Permission[];
}

export class RBACService {
  // Define role permissions
  private static readonly ROLE_PERMISSIONS: Record<string, RolePermissions> = {
    owner: {
      role: 'owner',
      permissions: [
        // Treasury Management
        { action: 'create', resource: 'payment_method' },
        { action: 'read', resource: 'payment_method' },
        { action: 'update', resource: 'payment_method' },
        { action: 'delete', resource: 'payment_method' },
        
        // Team Management
        { action: 'create', resource: 'member' },
        { action: 'read', resource: 'member' },
        { action: 'update', resource: 'member' },
        { action: 'delete', resource: 'member' },
        { action: 'invite', resource: 'member' },
        
        // Organization Settings
        { action: 'read', resource: 'organization' },
        { action: 'update', resource: 'organization' },
        { action: 'manage', resource: 'approval_settings' },
        
        // Bills and Payments
        { action: 'create', resource: 'bill' },
        { action: 'read', resource: 'bill' },
        { action: 'update', resource: 'bill' },
        { action: 'delete', resource: 'bill' },
        { action: 'approve', resource: 'bill' },
        { action: 'reject', resource: 'bill' },
        { action: 'pay', resource: 'bill' },
        
        // Invoices
        { action: 'create', resource: 'invoice' },
        { action: 'read', resource: 'invoice' },
        { action: 'update', resource: 'invoice' },
        { action: 'delete', resource: 'invoice' },
        { action: 'mark_paid', resource: 'invoice' },
        
        // Financial Data
        { action: 'read', resource: 'transaction' },
        { action: 'reconcile', resource: 'transaction' },
        { action: 'export', resource: 'transaction' },
        { action: 'export', resource: 'report' },
        
        // Audit and Compliance
        { action: 'read', resource: 'audit_log' },
        { action: 'export', resource: 'audit_log' }
      ],
      restrictions: []
    },

    admin: {
      role: 'admin',
      permissions: [
        // Treasury Management
        { action: 'create', resource: 'payment_method' },
        { action: 'read', resource: 'payment_method' },
        { action: 'update', resource: 'payment_method' },
        { action: 'delete', resource: 'payment_method' },
        
        // Team Management
        { action: 'create', resource: 'member' },
        { action: 'read', resource: 'member' },
        { action: 'update', resource: 'member' },
        { action: 'delete', resource: 'member' },
        { action: 'invite', resource: 'member' },
        
        // Organization Settings
        { action: 'read', resource: 'organization' },
        { action: 'update', resource: 'organization' },
        { action: 'manage', resource: 'approval_settings' },
        
        // Bills and Payments
        { action: 'create', resource: 'bill' },
        { action: 'read', resource: 'bill' },
        { action: 'update', resource: 'bill' },
        { action: 'delete', resource: 'bill' },
        { action: 'approve', resource: 'bill' },
        { action: 'reject', resource: 'bill' },
        { action: 'pay', resource: 'bill' },
        
        // Invoices
        { action: 'create', resource: 'invoice' },
        { action: 'read', resource: 'invoice' },
        { action: 'update', resource: 'invoice' },
        { action: 'delete', resource: 'invoice' },
        { action: 'mark_paid', resource: 'invoice' },
        
        // Financial Data
        { action: 'read', resource: 'transaction' },
        { action: 'reconcile', resource: 'transaction' },
        { action: 'export', resource: 'transaction' },
        { action: 'export', resource: 'report' },
        
        // Audit and Compliance
        { action: 'read', resource: 'audit_log' },
        { action: 'export', resource: 'audit_log' }
      ],
      restrictions: []
    },

    financeManager: {
      role: 'financeManager',
      permissions: [
        // Bills and Payments (limited)
        { action: 'create', resource: 'bill' },
        { action: 'read', resource: 'bill' },
        { action: 'update', resource: 'bill', conditions: { status: ['draft', 'pending_approval'] } },
        { action: 'pay', resource: 'bill', conditions: { status: 'approved' } },
        
        // Financial Data
        { action: 'read', resource: 'transaction' },
        { action: 'reconcile', resource: 'transaction' },
        { action: 'export', resource: 'transaction' },
        { action: 'export', resource: 'report' },
        
        // Limited organization access
        { action: 'read', resource: 'organization' },
        { action: 'read', resource: 'member' }
      ],
      restrictions: [
        // Cannot manage treasury
        { action: 'create', resource: 'payment_method' },
        { action: 'update', resource: 'payment_method' },
        { action: 'delete', resource: 'payment_method' },
        
        // Cannot manage team
        { action: 'create', resource: 'member' },
        { action: 'update', resource: 'member' },
        { action: 'delete', resource: 'member' },
        { action: 'invite', resource: 'member' },
        
        // Cannot manage settings
        { action: 'update', resource: 'organization' },
        { action: 'manage', resource: 'approval_settings' },
        
        // Cannot approve bills
        { action: 'approve', resource: 'bill' },
        { action: 'reject', resource: 'bill' }
      ]
    },

    approver: {
      role: 'approver',
      permissions: [
        // Approval only
        { action: 'read', resource: 'bill', conditions: { status: ['pending_approval'] } },
        { action: 'approve', resource: 'bill' },
        { action: 'reject', resource: 'bill' },
        
        // Limited organization access
        { action: 'read', resource: 'organization' },
        { action: 'read', resource: 'member' },
        
        // Invoices (can mark approved invoices as paid)
        { action: 'read', resource: 'invoice' },
        { action: 'mark_paid', resource: 'invoice' },
        
        // Audit access
        { action: 'read', resource: 'audit_log' }
      ],
      restrictions: [
        // Cannot create or manage bills
        { action: 'create', resource: 'bill' },
        { action: 'update', resource: 'bill' },
        { action: 'delete', resource: 'bill' },
        { action: 'pay', resource: 'bill' },
        
        // Cannot manage treasury
        { action: 'create', resource: 'payment_method' },
        { action: 'update', resource: 'payment_method' },
        { action: 'delete', resource: 'payment_method' },
        
        // Cannot manage team
        { action: 'create', resource: 'member' },
        { action: 'update', resource: 'member' },
        { action: 'delete', resource: 'member' },
        { action: 'invite', resource: 'member' },
        
        // Cannot manage settings
        { action: 'update', resource: 'organization' },
        { action: 'manage', resource: 'approval_settings' },
        
        // Cannot access financial data
        { action: 'read', resource: 'transaction' },
        { action: 'reconcile', resource: 'transaction' },
        { action: 'export', resource: 'transaction' },
        { action: 'export', resource: 'report' }
      ]
    },

    accountant: {
      role: 'accountant',
      permissions: [
        // Read-only access to bills
        { action: 'read', resource: 'bill' },
        
        // Financial data access
        { action: 'read', resource: 'transaction' },
        { action: 'reconcile', resource: 'transaction' },
        { action: 'export', resource: 'transaction' },
        { action: 'export', resource: 'report' },
        
        // Limited organization access
        { action: 'read', resource: 'organization' },
        { action: 'read', resource: 'member' },
        
        // Audit access
        { action: 'read', resource: 'audit_log' },
        { action: 'export', resource: 'audit_log' }
      ],
      restrictions: [
        // Cannot create or manage bills
        { action: 'create', resource: 'bill' },
        { action: 'update', resource: 'bill' },
        { action: 'delete', resource: 'bill' },
        { action: 'approve', resource: 'bill' },
        { action: 'reject', resource: 'bill' },
        { action: 'pay', resource: 'bill' },
        
        // Cannot manage treasury
        { action: 'create', resource: 'payment_method' },
        { action: 'update', resource: 'payment_method' },
        { action: 'delete', resource: 'payment_method' },
        
        // Cannot manage team
        { action: 'create', resource: 'member' },
        { action: 'update', resource: 'member' },
        { action: 'delete', resource: 'member' },
        { action: 'invite', resource: 'member' },
        
        // Cannot manage settings
        { action: 'update', resource: 'organization' },
        { action: 'manage', resource: 'approval_settings' }
      ]
    }
  };

  // Check if user has permission for an action
  static hasPermission(
    member: OrganizationMember,
    action: string,
    resource: string,
    conditions?: Record<string, any>
  ): boolean {
    const rolePermissions = this.ROLE_PERMISSIONS[member.role];
    
    if (!rolePermissions) {
      console.warn(`Unknown role: ${member.role}`);
      return false;
    }

    // Check restrictions first
    const isRestricted = rolePermissions.restrictions.some(restriction => 
      this.matchesPermission(restriction, action, resource, conditions)
    );

    if (isRestricted) {
      return false;
    }

    // Check permissions
    return rolePermissions.permissions.some(permission => 
      this.matchesPermission(permission, action, resource, conditions)
    );
  }

  // Get all permissions for a role
  static getRolePermissions(role: string): Permission[] {
    const rolePermissions = this.ROLE_PERMISSIONS[role];
    return rolePermissions ? rolePermissions.permissions : [];
  }

  // Get all restrictions for a role
  static getRoleRestrictions(role: string): Permission[] {
    const rolePermissions = this.ROLE_PERMISSIONS[role];
    return rolePermissions ? rolePermissions.restrictions : [];
  }

  // Get available roles
  static getAvailableRoles(): string[] {
    return Object.keys(this.ROLE_PERMISSIONS);
  }

  // Check if user can approve bills
  static canApproveBills(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'approve', 'bill');
  }

  // Check if user can create bills
  static canCreateBills(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'create', 'bill');
  }

  // Check if user can execute payments
  static canExecutePayments(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'pay', 'bill');
  }

  // Check if user can manage treasury
  static canManageTreasury(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'create', 'payment_method') &&
           this.hasPermission(member, 'update', 'payment_method') &&
           this.hasPermission(member, 'delete', 'payment_method');
  }

  // Check if user can manage team
  static canManageTeam(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'invite', 'member') &&
           this.hasPermission(member, 'update', 'member') &&
           this.hasPermission(member, 'delete', 'member');
  }

  // Check if user can manage settings
  static canManageSettings(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'manage', 'approval_settings') &&
           this.hasPermission(member, 'update', 'organization');
  }

  // Check if user can mark invoices as paid
  static canMarkInvoiceAsPaid(member: OrganizationMember): boolean {
    return this.hasPermission(member, 'mark_paid', 'invoice');
  }

  // Get approval limits for a user
  static getApprovalLimits(member: OrganizationMember): {
    maxAmount: number;
    requiresDualApproval: boolean;
  } {
    const role = member.role;
    
    // Define approval limits by role
    const limits = {
      owner: { maxAmount: Infinity, requiresDualApproval: false },
      admin: { maxAmount: Infinity, requiresDualApproval: false },
      financeManager: { maxAmount: 0, requiresDualApproval: false }, // Cannot approve
      approver: { maxAmount: 10000, requiresDualApproval: false },
      accountant: { maxAmount: 0, requiresDualApproval: false } // Cannot approve
    };

    return limits[role as keyof typeof limits] || { maxAmount: 0, requiresDualApproval: false };
  }

  // Private helper method to match permissions
  private static matchesPermission(
    permission: Permission,
    action: string,
    resource: string,
    conditions?: Record<string, any>
  ): boolean {
    // Check action and resource
    if (permission.action !== action || permission.resource !== resource) {
      return false;
    }

    // Check conditions if specified
    if (permission.conditions && conditions) {
      for (const [key, value] of Object.entries(permission.conditions)) {
        if (conditions[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }
}
