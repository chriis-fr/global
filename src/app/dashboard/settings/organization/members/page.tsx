'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { Users, Plus, Mail, Clock, Shield, CheckCircle } from 'lucide-react';
import RoleSelector from '@/components/organization/RoleSelector';
import MemberCard from '@/components/organization/MemberCard';
import { type OrganizationMember } from '@/models/Organization';
import { getOrganizationData, getOrganizationMembers, getOrganizationSeatInfo } from '@/lib/actions/organization';
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
  const [seatInfo, setSeatInfo] = useState<{
    paidSeats: number;
    currentMembers: number;
    pendingInvitations: number;
    availableSeats: number;
    planName?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'financeManager' as RoleKey
  });

  const fetchSeatInfo = async () => {
    try {
      const result = await getOrganizationSeatInfo();
      if (result.success && result.data) {
        setSeatInfo(result.data);
      }
    } catch (error) {
      console.error('Error fetching seat info:', error);
    }
  };

  const fetchOrganizationData = useCallback(async () => {
    try {
      const result = await getOrganizationData();
      
      if (result.success && result.data) {
        setOrgInfo(result.data as unknown as OrganizationInfo);
        if (result.data.hasOrganization) {
          await Promise.all([
            fetchMembers(),
            fetchPendingInvitations(),
            fetchSeatInfo()
          ]);
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

    // Check seat limit before sending invitation
    if (seatInfo && seatInfo.availableSeats <= 0) {
      setMessage({ type: 'error', text: `You have reached your seat limit of ${seatInfo.paidSeats}. You currently have ${seatInfo.currentMembers} member${seatInfo.currentMembers === 1 ? '' : 's'} and ${seatInfo.pendingInvitations} pending invitation${seatInfo.pendingInvitations === 1 ? '' : 's'}. Please upgrade your plan to add more members.` });
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
        // Refresh both invitations and seat info to sync the page
        await Promise.all([
          fetchPendingInvitations(),
          fetchSeatInfo()
        ]);
      } else {
        console.log('❌ [Members Page] Invitation failed:', result.error);
        setMessage({ type: 'error', text: result.error || 'Failed to send invitation' });
        // Refresh seat info even on error to ensure UI is synced
        await fetchSeatInfo();
      }
    } catch (error) {
      console.error('❌ [Members Page] Error sending invitation:', error);
      setMessage({ type: 'error', text: 'Failed to send invitation. Please try again.' });
      // Refresh seat info on error
      await fetchSeatInfo();
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

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        setMessage({ type: 'error', text: 'Server returned an invalid response. Please try again.' });
        return;
      }

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

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        setMessage({ type: 'error', text: 'Server returned an invalid response. Please try again.' });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Member removed successfully!' });
        await Promise.all([
          fetchMembers(),
          fetchSeatInfo()
        ]);
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
        await Promise.all([
          fetchPendingInvitations(),
          fetchSeatInfo()
        ]);
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

      {/* Seat Limit Information */}
      {seatInfo && (
        <div className={`mb-6 p-4 rounded-lg border ${
          seatInfo.availableSeats > 0
            ? 'bg-blue-600/20 border-blue-500/50'
            : 'bg-blue-600/20 border-blue-500/50'
        }`}>
          <div className="flex items-start space-x-3">
            {seatInfo.availableSeats > 0 ? (
              <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Users className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-2">
                {seatInfo.availableSeats > 0 
                  ? `You can add ${seatInfo.availableSeats} more member${seatInfo.availableSeats === 1 ? '' : 's'}`
                  : `Your ${seatInfo.planName || 'current'} plan includes ${seatInfo.paidSeats} seat${seatInfo.paidSeats === 1 ? '' : 's'}`
                }
              </h3>
              <div className="space-y-1 text-blue-200 text-sm">
                <p>
                  <strong>Current plan:</strong> {seatInfo.planName || 'Unknown'} • 
                  <strong> Total seats:</strong> {seatInfo.paidSeats} • 
                  <strong> Active members:</strong> {seatInfo.currentMembers} {seatInfo.currentMembers === 1 ? 'member' : 'members'}
                  {seatInfo.pendingInvitations > 0 && (
                    <> • <strong>Pending invitations:</strong> {seatInfo.pendingInvitations}</>
                  )}
                </p>
                {seatInfo.availableSeats > 0 ? (
                  <p className="text-blue-300">
                    You have {seatInfo.availableSeats} seat{seatInfo.availableSeats === 1 ? '' : 's'} available to invite new team members.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    <p className="text-blue-300">
                      You&apos;re currently using all {seatInfo.paidSeats} seat{seatInfo.paidSeats === 1 ? '' : 's'} included in your plan.
                    </p>
                    <p className="text-blue-200">
                      To add more team members, you can upgrade your plan to include additional seats. Visit the <a href="/pricing" className="text-blue-400 hover:text-blue-300 underline">pricing page</a> to see available options.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
                     disabled={seatInfo !== null && seatInfo.availableSeats <= 0}
                     className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                       seatInfo !== null && seatInfo.availableSeats <= 0
                         ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                         : 'bg-blue-600 text-white hover:bg-blue-700'
                     }`}
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
                     disabled={adding || (seatInfo !== null && seatInfo.availableSeats <= 0)}
                     className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                       seatInfo !== null && seatInfo.availableSeats <= 0
                         ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                         : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                     }`}
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
                <Fragment key={member.userId}>
                <MemberCard
                  member={member as unknown as OrganizationMember}
                  currentUserRole={orgInfo?.userRole || 'member'}
                  onEditRole={(memberId, newRole) => setEditingMember({ userId: memberId, role: newRole })}
                  onRemoveMember={handleRemoveMember}
                  isEditing={editingMember?.userId === member.userId}
                  isUpdating={updating}
                  orgServices={orgInfo?.organization?.services as { smartInvoicing?: boolean; accountsPayable?: boolean } | undefined}
                />
                {editingMember?.userId === member.userId && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500/50">
                    <RoleSelector
                      selectedRole={((member as Record<string, unknown>).role ?? 'accountant') as RoleKey}
                      onRoleChange={(newRole) => {
                        const currentRole = (member as Record<string, unknown>).role as string;
                        if (newRole !== currentRole) {
                          handleUpdateMemberRole(member.userId as string, newRole);
                        }
                        setEditingMember(null);
                      }}
                      showPermissions={true}
                    />
                  </div>
                )}
                </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
} 