'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { OrganizationMember } from '@/types/organization';

interface PermissionContextType {
  permissions: {
    canManageTreasury: boolean;
    canManageTeam: boolean;
    canManageSettings: boolean;
    canCreateBills: boolean;
    canApproveBills: boolean;
    canExecutePayments: boolean;
    canViewFinancialData: boolean;
    canExportData: boolean;
  };
  member: OrganizationMember | null;
  loading: boolean;
  error: string | null;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState({
    canManageTreasury: false,
    canManageTeam: false,
    canManageSettings: false,
    canCreateBills: false,
    canApproveBills: false,
    canExecutePayments: false,
    canViewFinancialData: false,
    canExportData: false,
  });
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/permissions');
      const data = await response.json();

      if (data.success) {
        setPermissions(data.data.permissions);
        setMember(data.data.member);
      } else {
        setError(data.message || 'Failed to fetch permissions');
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPermissions();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setPermissions({
        canManageTreasury: false,
        canManageTeam: false,
        canManageSettings: false,
        canCreateBills: false,
        canApproveBills: false,
        canExecutePayments: false,
        canViewFinancialData: false,
        canExportData: false,
      });
      setMember(null);
    }
  }, [session, status]);

  const value: PermissionContextType = {
    permissions,
    member,
    loading,
    error,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Hook for checking specific permissions
export function usePermission(permission: keyof PermissionContextType['permissions']) {
  const { permissions } = usePermissions();
  return permissions[permission];
}

// Hook for checking if user can perform an action
export function useCanPerform(action: string, resource: string) {
  const { permissions } = usePermissions();
  
  // Map actions and resources to permission checks
  const permissionMap: Record<string, keyof PermissionContextType['permissions']> = {
    'create_payment_method': 'canManageTreasury',
    'update_payment_method': 'canManageTreasury',
    'delete_payment_method': 'canManageTreasury',
    'invite_member': 'canManageTeam',
    'update_member': 'canManageTeam',
    'delete_member': 'canManageTeam',
    'manage_approval_settings': 'canManageSettings',
    'update_organization': 'canManageSettings',
    'create_bill': 'canCreateBills',
    'approve_bill': 'canApproveBills',
    'reject_bill': 'canApproveBills',
    'pay_bill': 'canExecutePayments',
    'view_transaction': 'canViewFinancialData',
    'reconcile_transaction': 'canViewFinancialData',
    'export_report': 'canExportData',
    'export_audit_log': 'canExportData',
  };

  const permissionKey = permissionMap[`${action}_${resource}`];
  return permissionKey ? permissions[permissionKey] : false;
}
