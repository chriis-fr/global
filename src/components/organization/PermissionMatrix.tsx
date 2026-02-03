'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, DollarSign, Users, Settings, FileText, CheckCircle, XCircle } from 'lucide-react';
import { PermissionSet } from '@/models/Organization';
import { REQUEST_FINANCE_ROLES, type RoleKey } from '@/lib/utils/roles';

interface PermissionMatrixProps {
  role: RoleKey;
  permissions?: PermissionSet;
  showDetails?: boolean;
  compact?: boolean;
}

export default function PermissionMatrix({ 
  role, 
  permissions, 
  showDetails = false,
  compact = false 
}: PermissionMatrixProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const userPermissions = permissions || REQUEST_FINANCE_ROLES[role].permissions;

  const permissionCategories = [
    {
      title: 'Treasury Control',
      icon: <DollarSign className="h-4 w-4" />,
      permissions: [
        { key: 'canAddPaymentMethods', label: 'Add Payment Methods' },
        { key: 'canModifyPaymentMethods', label: 'Modify Payment Methods' },
        { key: 'canManageTreasury', label: 'Manage Treasury' }
      ]
    },
    {
      title: 'Team Management',
      icon: <Users className="h-4 w-4" />,
      permissions: [
        { key: 'canManageTeam', label: 'Manage Team' },
        { key: 'canInviteMembers', label: 'Invite Members' },
        { key: 'canRemoveMembers', label: 'Remove Members' }
      ]
    },
    {
      title: 'Company Settings',
      icon: <Settings className="h-4 w-4" />,
      permissions: [
        { key: 'canManageCompanyInfo', label: 'Manage Company Info' },
        { key: 'canManageSettings', label: 'Manage Settings' }
      ]
    },
    {
      title: 'Invoice Management',
      icon: <FileText className="h-4 w-4" />,
      permissions: [
        { key: 'canCreateInvoices', label: 'Create Invoices' },
        { key: 'canSendInvoices', label: 'Send Invoices' },
        { key: 'canManageInvoices', label: 'Manage Invoices' }
      ]
    },
    {
      title: 'Payables Management',
      icon: <Shield className="h-4 w-4" />,
      permissions: [
        { key: 'canCreateBills', label: 'Create Bills' },
        { key: 'canApproveBills', label: 'Approve Bills' },
        { key: 'canExecutePayments', label: 'Execute Payments' },
        { key: 'canManagePayables', label: 'Manage Payables' }
      ]
    },
    {
      title: 'Accounting & Reporting',
      icon: <CheckCircle className="h-4 w-4" />,
      permissions: [
        { key: 'canViewAllData', label: 'View All Data' },
        { key: 'canExportData', label: 'Export Data' },
        { key: 'canReconcileTransactions', label: 'Reconcile Transactions' },
        { key: 'canManageAccounting', label: 'Manage Accounting' }
      ]
    },
    {
      title: 'Approval Workflow',
      icon: <Shield className="h-4 w-4" />,
      permissions: [
        { key: 'canApproveDocuments', label: 'Approve Documents' },
        { key: 'canManageApprovalPolicies', label: 'Manage Approval Policies' }
      ]
    }
  ];

  const getPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <CheckCircle className="h-4 w-4 text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-red-400" />
    );
  };

  if (compact) {
    const totalPermissions = permissionCategories.reduce((acc, cat) => acc + cat.permissions.length, 0);
    const grantedPermissions = permissionCategories.reduce((acc, cat) => 
      acc + cat.permissions.filter(p => userPermissions[p.key as keyof PermissionSet]).length, 0
    );

    return (
      <div className="text-sm text-gray-400">
        {grantedPermissions} of {totalPermissions} permissions for this role
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Role Permissions</h3>
        {showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-blue-300 hover:text-white transition-colors"
          >
            <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {permissionCategories.map((category, index) => (
            <div key={index} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                {category.icon}
                <h4 className="text-white font-medium">{category.title}</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {category.permissions.map((permission) => {
                  const hasPermission = userPermissions[permission.key as keyof PermissionSet];
                  return (
                    <div key={permission.key} className="flex items-center space-x-2">
                      {getPermissionIcon(hasPermission)}
                      <span className={`text-sm ${hasPermission ? 'text-green-300' : 'text-red-300'}`}>
                        {permission.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {permissionCategories.map((category, index) => {
            const grantedCount = category.permissions.filter(p => 
              userPermissions[p.key as keyof PermissionSet]
            ).length;
            const totalCount = category.permissions.length;
            
            return (
              <div key={index} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  {category.icon}
                  <span className="text-white text-sm font-medium">{category.title}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {grantedCount}/{totalCount} permissions
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
