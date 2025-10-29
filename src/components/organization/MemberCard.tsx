'use client';

import { useState } from 'react';
import { User, Crown, Shield, DollarSign, Calculator, CheckCircle, Edit, Trash2, Clock } from 'lucide-react';
import Image from 'next/image';
import { OrganizationMember } from '@/models/Organization';
import { type RoleKey } from '@/lib/utils/roles';
import PermissionMatrix from './PermissionMatrix';

interface MemberCardProps {
  member: OrganizationMember;
  currentUserRole: string;
  onEditRole?: (memberId: string, newRole: RoleKey) => void;
  onRemoveMember?: (memberId: string) => void;
  isEditing?: boolean;
  isUpdating?: boolean;
}

export default function MemberCard({
  member,
  currentUserRole,
  onEditRole,
  onRemoveMember,
  isEditing = false,
  isUpdating = false
}: MemberCardProps) {
  const [showPermissions, setShowPermissions] = useState(false);

  const getRoleIcon = (role: string) => {
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
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-600/20 text-yellow-300 border-yellow-500/50';
      case 'admin':
        return 'bg-blue-600/20 text-blue-300 border-blue-500/50';
      case 'financeManager':
        return 'bg-green-600/20 text-green-300 border-green-500/50';
      case 'accountant':
        return 'bg-purple-600/20 text-purple-300 border-purple-500/50';
      case 'approver':
        return 'bg-orange-600/20 text-orange-300 border-orange-500/50';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/50';
    }
  };

  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemove = canEdit && member.role !== 'owner';
  const isOwner = member.role === 'owner';

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Unknown';
    
    try {
      // Handle both Date objects and ISO strings
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date provided to formatDate:', date);
        return 'Unknown';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', date);
      return 'Unknown';
    }
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            {member.profilePicture ? (
              <Image 
                src={member.profilePicture} 
                alt={member.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-white font-medium">{member.name}</h3>
            <p className="text-blue-200 text-sm">{member.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`px-2 py-1 rounded-full border text-xs flex items-center space-x-1 ${getRoleBadgeColor(member.role)}`}>
                {getRoleIcon(member.role)}
                <span className="capitalize">{member.role}</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-400 text-xs">
                <Clock className="h-3 w-3" />
                <span>Joined {formatDate(member.joinedAt)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {canEdit && !isOwner && (
            <div className="flex space-x-1">
              <button
                onClick={() => setShowPermissions(!showPermissions)}
                className="p-1 text-blue-300 hover:text-white transition-colors"
                title="View permissions"
              >
                <Shield className="h-4 w-4" />
              </button>
              <button
                onClick={() => onEditRole?.(member.userId.toString(), member.role as RoleKey)}
                className="p-1 text-blue-300 hover:text-white transition-colors"
                title="Edit role"
              >
                <Edit className="h-4 w-4" />
              </button>
              {canRemove && (
                <button
                  onClick={() => onRemoveMember?.(member.userId.toString())}
                  className="p-1 text-red-300 hover:text-red-400 transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showPermissions && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <PermissionMatrix 
            role={member.role as RoleKey} 
            permissions={member.permissions}
            compact={true}
          />
        </div>
      )}

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-sm text-blue-300">
            {isUpdating ? 'Updating role...' : 'Select new role for this member'}
          </div>
        </div>
      )}
    </div>
  );
}
