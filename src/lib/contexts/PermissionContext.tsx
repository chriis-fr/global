'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
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
    canMarkInvoiceAsPaid: boolean;
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
    canMarkInvoiceAsPaid: false,
  });
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const lastFetchTime = useRef(0);
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - only refresh on logout/login

  const fetchPermissions = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    // Check localStorage cache first
    const cacheKey = `permissions_${session.user.email}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!forceRefresh && cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        const now = Date.now();
        
        // Use cached data if it's less than 24 hours old
        if ((now - parsed.timestamp) < CACHE_DURATION) {
          setPermissions(parsed.permissions);
          setMember(parsed.member);
          setLoading(false);
          return;
        }
      } catch {
        // If cache is corrupted, remove it and fetch fresh
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/permissions');
      const data = await response.json();

      if (data.success) {
        setPermissions(data.data.permissions);
        setMember(data.data.member);
        
        // Cache in localStorage
        const cacheData = {
          permissions: data.data.permissions,
          member: data.data.member,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } else {
        setError(data.message || 'Failed to fetch permissions');
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  const refreshPermissions = async () => {
    await fetchPermissions(true); // Force refresh
  };

  useEffect(() => {
    if (status === 'authenticated' && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchPermissions();
    } else if (status === 'unauthenticated') {
      hasInitialized.current = false;
      lastFetchTime.current = 0;
      
      // Clear all permission caches on logout
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('permissions_')) {
          localStorage.removeItem(key);
        }
      });
      
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
        canMarkInvoiceAsPaid: false,
      });
      setMember(null);
    }
  }, [status, fetchPermissions]);

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
