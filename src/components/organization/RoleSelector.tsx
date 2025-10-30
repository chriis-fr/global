'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Shield, Crown, DollarSign, Calculator, CheckCircle } from 'lucide-react';
import { REQUEST_FINANCE_ROLES, type RoleKey } from '@/lib/utils/roles';

interface RoleSelectorProps {
  selectedRole: RoleKey;
  onRoleChange: (role: RoleKey) => void;
  disabled?: boolean;
  showPermissions?: boolean;
}

export default function RoleSelector({ 
  selectedRole, 
  onRoleChange, 
  disabled = false,
  showPermissions = true 
}: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getRoleIcon = (role: RoleKey) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'financeManager':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'accountant':
        return <Calculator className="h-4 w-4 text-purple-500" />;
      case 'approver':
        return <CheckCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Shield className="h-4 w-4 text-gray-400" />;
    }
  };


  const getPermissionSummary = (role: RoleKey) => {
    const permissions = REQUEST_FINANCE_ROLES[role].permissions;
    const capabilities = [];
    
    if (permissions.canManageTreasury) capabilities.push('Treasury Control');
    if (permissions.canManageTeam) capabilities.push('Team Management');
    if (permissions.canCreateInvoices) capabilities.push('Create Invoices');
    if (permissions.canApproveBills) capabilities.push('Approve Bills');
    if (permissions.canExecutePayments) capabilities.push('Execute Payments');
    if (permissions.canViewAllData) capabilities.push('View All Data');
    if (permissions.canExportData) capabilities.push('Export Data');
    
    return capabilities.slice(0, 3).join(', ') + (capabilities.length > 3 ? '...' : '');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-blue-300 text-sm font-medium mb-2">
        Role *
      </label>
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/15'
        }`}
      >
        <div className="flex items-center space-x-2">
          {getRoleIcon(selectedRole)}
          <span className="capitalize">{REQUEST_FINANCE_ROLES[selectedRole].name}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {Object.entries(REQUEST_FINANCE_ROLES)
            .filter(([roleKey]) => roleKey !== 'owner') // Remove owner from selectable roles
            .map(([roleKey, roleData]) => (
            <button
              key={roleKey}
              type="button"
              onClick={() => {
                onRoleChange(roleKey as RoleKey);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getRoleIcon(roleKey as RoleKey)}
                  <div>
                    <div className="text-white font-medium">{roleData.name}</div>
                    <div className="text-blue-200 text-sm">{roleData.description}</div>
                    {showPermissions && (
                      <div className="text-gray-400 text-xs mt-1">
                        {getPermissionSummary(roleKey as RoleKey)}
                      </div>
                    )}
                  </div>
                </div>
                {selectedRole === roleKey && (
                  <CheckCircle className="h-4 w-4 text-blue-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
