import { PermissionSet } from '@/models/Organization';

// Request Finance Role Definitions
export const REQUEST_FINANCE_ROLES = {
  owner: {
    name: 'Owner',
    description: 'Full access to everything (settings, team, payment methods, exports)',
    permissions: {
      canAddPaymentMethods: true,
      canModifyPaymentMethods: true,
      canManageTreasury: true,
      canManageTeam: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canManageCompanyInfo: true,
      canManageSettings: true,
      canCreateInvoices: true,
      canSendInvoices: true,
      canManageInvoices: true,
      canCreateBills: true,
      canApproveBills: true,
      canExecutePayments: true,
      canManagePayables: true,
      canViewAllData: true,
      canExportData: true,
      canReconcileTransactions: true,
      canManageAccounting: true,
      canApproveDocuments: true,
      canManageApprovalPolicies: true
    }
  },
  
  admin: {
    name: 'Admin',
    description: 'Full access to everything (settings, team, payment methods, exports)',
    permissions: {
      canAddPaymentMethods: true,
      canModifyPaymentMethods: true,
      canManageTreasury: true,
      canManageTeam: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canManageCompanyInfo: true,
      canManageSettings: true,
      canCreateInvoices: true,
      canSendInvoices: true,
      canManageInvoices: true,
      canCreateBills: true,
      canApproveBills: true,
      canExecutePayments: true,
      canManagePayables: true,
      canViewAllData: true,
      canExportData: true,
      canReconcileTransactions: true,
      canManageAccounting: true,
      canApproveDocuments: true,
      canManageApprovalPolicies: true
    }
  },
  
  financeManager: {
    name: 'Finance Manager',
    description: 'Create/manage invoices/bills/expenses/payments, run exports, approve and pay bills — but cannot change payment receivers or manage team',
    permissions: {
      canAddPaymentMethods: false,
      canModifyPaymentMethods: false,
      canManageTreasury: false,
      canManageTeam: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canManageCompanyInfo: false,
      canManageSettings: false,
      canCreateInvoices: true,
      canSendInvoices: true,
      canManageInvoices: true,
      canCreateBills: true,
      canApproveBills: true,
      canExecutePayments: true,
      canManagePayables: true,
      canViewAllData: true,
      canExportData: true,
      canReconcileTransactions: true,
      canManageAccounting: true,
      canApproveDocuments: true,
      canManageApprovalPolicies: true
    }
  },
  
  accountant: {
    name: 'Accountant',
    description: 'Focus on bookkeeping: reconcile, export accounting data, view invoices/payables; limited payment execution rights',
    permissions: {
      canAddPaymentMethods: false,
      canModifyPaymentMethods: false,
      canManageTreasury: false,
      canManageTeam: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canManageCompanyInfo: false,
      canManageSettings: false,
      canCreateInvoices: false,
      canSendInvoices: false,
      canManageInvoices: false,
      canCreateBills: false,
      canApproveBills: false,
      canExecutePayments: false,
      canManagePayables: false,
      canViewAllData: true,
      canExportData: true,
      canReconcileTransactions: true,
      canManageAccounting: true,
      canApproveDocuments: false,
      canManageApprovalPolicies: false
    }
  },
  
  approver: {
    name: 'Approver',
    description: 'Can approve documents (bills/invoices) in the workflow but cannot change bank/wallet or team settings',
    permissions: {
      canAddPaymentMethods: false,
      canModifyPaymentMethods: false,
      canManageTreasury: false,
      canManageTeam: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canManageCompanyInfo: false,
      canManageSettings: false,
      canCreateInvoices: false,
      canSendInvoices: false,
      canManageInvoices: false,
      canCreateBills: false,
      canApproveBills: true,
      canExecutePayments: false,
      canManagePayables: false,
      canViewAllData: true,
      canExportData: false,
      canReconcileTransactions: false,
      canManageAccounting: false,
      canApproveDocuments: true,
      canManageApprovalPolicies: false
    }
  }
} as const;

export type RoleKey = keyof typeof REQUEST_FINANCE_ROLES;

// Get permissions for a role
export function getRolePermissions(role: RoleKey): PermissionSet {
  return REQUEST_FINANCE_ROLES[role].permissions;
}

// Check if user has specific permission
export function hasPermission(userPermissions: PermissionSet, permission: keyof PermissionSet): boolean {
  return userPermissions[permission] === true;
}

// Get role display name
export function getRoleDisplayName(role: RoleKey): string {
  return REQUEST_FINANCE_ROLES[role].name;
}

// Get role description
export function getRoleDescription(role: RoleKey): string {
  return REQUEST_FINANCE_ROLES[role].description;
}

// Check if role can manage treasury (Admin/Owner only)
export function canManageTreasury(role: RoleKey): boolean {
  return role === 'owner' || role === 'admin';
}

// Check if role can manage team (Admin/Owner only)
export function canManageTeam(role: RoleKey): boolean {
  return role === 'owner' || role === 'admin';
}

// Check if role can execute payments (Finance Manager and above)
export function canExecutePayments(role: RoleKey): boolean {
  return role === 'owner' || role === 'admin' || role === 'financeManager';
}

// Check if role can approve documents (Approver and above)
export function canApproveDocuments(role: RoleKey): boolean {
  return role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'approver';
}
