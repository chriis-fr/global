'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '@/lib/contexts/PermissionContext';

interface PermissionGuardProps {
  children: ReactNode;
  permission: keyof ReturnType<typeof usePermissions>['permissions'];
  fallback?: ReactNode;
  requireAll?: boolean; // If true, requires ALL permissions to be true
  permissions?: Array<keyof ReturnType<typeof usePermissions>['permissions']>;
}

export function PermissionGuard({ 
  children, 
  permission, 
  fallback = null, 
  requireAll = false,
  permissions = []
}: PermissionGuardProps) {
  const { permissions: userPermissions, loading } = usePermissions();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded h-4 w-full"></div>;
  }

  // Check single permission
  if (permission && !permissions.length) {
    if (userPermissions[permission]) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    const hasPermissions = requireAll 
      ? permissions.every(p => userPermissions[p])
      : permissions.some(p => userPermissions[p]);

    if (hasPermissions) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  }

  return <>{fallback}</>;
}

// Specific permission guard components
export function TreasuryGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canManageTreasury" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function TeamGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canManageTeam" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function SettingsGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canManageSettings" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function BillCreationGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canCreateBills" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function ApprovalGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canApproveBills" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function PaymentGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canExecutePayments" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function FinancialDataGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canViewFinancialData" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function ExportGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission="canExportData" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// Admin/Owner guard (requires either admin or owner permissions)
export function AdminGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard 
      permissions={['canManageTreasury', 'canManageTeam', 'canManageSettings']} 
      requireAll={true}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}

// Finance operations guard (create bills OR execute payments)
export function FinanceOperationsGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard 
      permissions={['canCreateBills', 'canExecutePayments']} 
      requireAll={false}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}
