'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Mail, Clock, Shield } from 'lucide-react';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import RoleSelector from '@/components/organization/RoleSelector';
import MemberCard from '@/components/organization/MemberCard';
import { type OrganizationMember } from '@/models/Organization';
import { getOrganizationData, getOrganizationMembers } from '@/lib/actions/organization';
import { sendInvitation, getPendingInvitations, resendInvitation, deleteInvitation } from '@/lib/actions/invitation';
import { type RoleKey } from '@/lib/utils/roles';

interface OrganizationInfo {
  userType: string;
  hasOrganization: boolean;
  organization?: Record<string, unknown>;
  userRole?: string;
  userPermissions?: Record<string, unknown>;
}

export default function OrganizationMembersPage() {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [members, setMembers] = useState<unknown[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<{ userId: string; role: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'financeManager' as RoleKey
  });

  const fetchOrganizationData = useCallback(async () => {
    try {
      const result = await getOrganizationData();
      
      if (result.success && result.data) {
        setOrgInfo(result.data as unknown as OrganizationInfo);
        if (result.data.hasOrganization) {
          await fetchMembers();
          await fetchPendingInvitations();
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load organization data' });
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizationData();
  }, [fetchOrganizationData]);

  const fetchMembers = async () => {
    try {
      const result = await getOrganizationMembers();
      
      if (result.success && result.data) {
        setMembers(result.data);
        console.log('✅ [Members Page] Members loaded:', result.data.length);
      } else {
        console.error('❌ [Members Page] Failed to load members:', result.error);
        setMessage({ type: 'error', text: result.error || 'Failed to load members' });
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setMessage({ type: 'error', text: 'Failed to load members' });
    }
  };

  // MIGRATION FUNCTION - COMMENTED OUT (No longer needed)
  // All existing organizations have been migrated, new organizations use proper structure
  
  // Force migration function
  // const forceMigration = async () => {
  //   try {
  //     const response = await fetch('/api/organization/force-migrate', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     const data = await response.json();

  //     if (data.success) {
  //       setMessage({ type: 'success', text: 'Migration completed successfully! Refreshing members...' });
  //       await fetchMembers();
  //     } else {
  //       setMessage({ type: 'error', text: data.message || 'Failed to migrate organization' });
  //     }
  //   } catch (error) {
  //     console.error('Error force migrating:', error);
  //     setMessage({ type: 'error', text: 'Failed to migrate organization' });
  //   }
  // };

  const fetchPendingInvitations = async () => {
    try {
      const result = await getPendingInvitations();
      
      if (result.success && result.data) {
        setPendingInvitations(result.data);
      } else {
        console.warn('Failed to fetch pending invitations:', result.error);
        // Don't show error to user, just log it
      }
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      // Don't show error to user, just log it
    }
  };

  const handleAddMember = async () => {
    if (!formData.email || !formData.role) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    console.log('📧 [Members Page] Starting invitation process...');
    console.log('📧 [Members Page] Email:', formData.email);
    console.log('📧 [Members Page] Role:', formData.role);

    setAdding(true);
    try {
      console.log('📧 [Members Page] Calling sendInvitation server action...');
      const result = await sendInvitation(formData.email, formData.role);
      console.log('📧 [Members Page] Server action result:', result);

      if (result.success) {
        console.log('✅ [Members Page] Invitation sent successfully');
        setMessage({ type: 'success', text: `Invitation sent to ${formData.email}! They will receive an email with instructions to join.` });
        setShowAddForm(false);
        setFormData({ email: '', role: 'financeManager' });
        await fetchPendingInvitations();
      } else {
        console.log('❌ [Members Page] Invitation failed:', result.error);
        setMessage({ type: 'error', text: result.error || 'Failed to send invitation' });
      }
    } catch (error) {
      console.error('❌ [Members Page] Error sending invitation:', error);
      setMessage({ type: 'error', text: 'Failed to send invitation. Please try again.' });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/organization/members', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Member role updated successfully!' });
        setEditingMember(null);
        await fetchMembers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update member role' });
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      setMessage({ type: 'error', text: 'Failed to update member role. Please try again.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/organization/members?userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Member removed successfully!' });
        await fetchMembers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to remove member' });
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setMessage({ type: 'error', text: 'Failed to remove member. Please try again.' });
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setResending(invitationId);
    try {
      const result = await resendInvitation(invitationId);

      if (result.success) {
        setMessage({ type: 'success', text: 'Invitation resent successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to resend invitation' });
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      setMessage({ type: 'error', text: 'Failed to resend invitation. Please try again.' });
    } finally {
      setResending(null);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to delete this invitation?')) {
      return;
    }

    setDeleting(invitationId);
    try {
      const result = await deleteInvitation(invitationId);

      if (result.success) {
        setMessage({ type: 'success', text: 'Invitation deleted successfully!' });
        await fetchPendingInvitations();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete invitation' });
      }
    } catch (error) {
      console.error('Error deleting invitation:', error);
      setMessage({ type: 'error', text: 'Failed to delete invitation. Please try again.' });
    } finally {
      setDeleting(null);
    }
  };


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Members</h1>
          <p className="text-blue-200">Manage your organization members and their roles.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
          </div>
        </div>
        <DashboardFloatingButton />
      </div>
    );
  }

  if (!orgInfo?.hasOrganization) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Members</h1>
          <p className="text-blue-200">Manage your organization members and their roles.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
          <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Organization Found</h3>
          <p className="text-blue-200">
            You need to create an organization first to manage members.
          </p>
        </div>
        <DashboardFloatingButton />
      </div>
    );
  }

  const isAdmin = orgInfo.userRole === 'owner' || orgInfo.userRole === 'admin';

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Members</h1>
        <p className="text-blue-200">
          Manage your organization members and their roles. {!isAdmin && 'Only admins can manage members.'}
        </p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-600/20 border border-green-500/50 text-green-200' 
            : 'bg-red-600/20 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
         {/* Add Member Section */}
         {isAdmin && (
           <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 relative z-10">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-semibold text-white">Add New Member</h2>
               <div className="flex space-x-2">
                 {/* MIGRATION BUTTON - COMMENTED OUT (No longer needed) */}
                 {/* <button
                   onClick={forceMigration}
                   className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
                 >
                   <Shield className="h-4 w-4" />
                   <span>Force Migration</span>
                 </button> */}
                 {!showAddForm && (
                   <button
                     onClick={() => setShowAddForm(true)}
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                   >
                     <Plus className="h-4 w-4" />
                     <span>Add Member</span>
                   </button>
                 )}
               </div>
             </div>

             {showAddForm && (
               <div className="space-y-4 relative z-20">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-blue-300 text-sm font-medium mb-2">
                       Email Address *
                     </label>
                     <input
                       type="email"
                       value={formData.email}
                       onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                       className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                       placeholder="Enter member's email"
                     />
                   </div>
                   
                   <div className="relative z-30">
                     <RoleSelector
                       selectedRole={formData.role}
                       onRoleChange={(role) => setFormData(prev => ({ ...prev, role }))}
                       showPermissions={true}
                     />
                   </div>
                 </div>

                 <div className="flex justify-end space-x-3">
                   <button
                     onClick={() => {
                       setShowAddForm(false);
                       setFormData({ email: '', role: 'financeManager' });
                     }}
                     className="px-4 py-2 text-blue-300 hover:text-white transition-colors"
                     disabled={adding}
                   >
                     Cancel
                   </button>
                   <button
                     onClick={handleAddMember}
                     disabled={adding}
                     className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                   >
                     {adding ? (
                       <>
                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                         <span>Sending...</span>
                       </>
                     ) : (
                       <>
                         <Plus className="h-4 w-4" />
                         <span>Send Invitation</span>
                       </>
                     )}
                   </button>
                 </div>
               </div>
             )}
           </div>
         )}

         {/* Pending Invitations */}
         {pendingInvitations.length > 0 && (
           <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
             <h2 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
               <Mail className="h-5 w-5" />
               <span>Pending Invitations</span>
             </h2>
             
            <div className="space-y-3">
              {(pendingInvitations as Array<Record<string, unknown>>).map((invitation) => {
                const inv = invitation as { _id: string; email?: string; role?: string; expiresAt?: string };
                return (
                <div key={inv._id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                       <Mail className="h-5 w-5 text-white" />
                     </div>
                     <div>
                      <h3 className="text-white font-medium">{inv.email || '(no email)'}</h3>
                      <p className="text-blue-200 text-sm">Invited as {inv.role}</p>
                       <div className="flex items-center space-x-1 text-gray-400 text-xs mt-1">
                         <Clock className="h-3 w-3" />
                        <span>Expires {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : ''}</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center space-x-2">
                     <div className="px-2 py-1 bg-orange-600/20 text-orange-300 border border-orange-500/50 rounded-full text-xs">
                       Pending
                     </div>
                     
                     <button
                      onClick={() => handleResendInvitation(inv._id)}
                      disabled={resending === inv._id}
                       className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1 disabled:opacity-50 text-sm"
                     >
                      {resending === inv._id ? (
                         <>
                           <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                           <span>Resending...</span>
                         </>
                       ) : (
                         <>
                           <Mail className="h-3 w-3" />
                           <span>Resend</span>
                         </>
                       )}
                     </button>
                     
                     <button
                      onClick={() => handleDeleteInvitation(inv._id)}
                      disabled={deleting === inv._id}
                       className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-1 disabled:opacity-50 text-sm"
                     >
                      {deleting === inv._id ? (
                         <>
                           <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                           <span>Deleting...</span>
                         </>
                       ) : (
                         <>
                           <Shield className="h-3 w-3" />
                           <span>Delete</span>
                         </>
                       )}
                     </button>
                   </div>
                </div>
                );
              })}
             </div>
           </div>
         )}

        {/* Members List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Current Members</h2>
          
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No members found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(members as Array<Record<string, unknown>>).map((m) => {
                const member = m as { userId: string } & Record<string, unknown>;
                return (
                <MemberCard
                  key={member.userId}
                  member={member as unknown as OrganizationMember}
                  currentUserRole={orgInfo?.userRole || 'member'}
                  onEditRole={(userId, newRole) => {
                    setEditingMember({ userId, role: newRole });
                    handleUpdateMemberRole(userId, newRole);
                  }}
                  onRemoveMember={handleRemoveMember}
                  isEditing={editingMember?.userId === member.userId}
                  isUpdating={updating}
                />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DashboardFloatingButton />
    </div>
  );
} 