'use client';
import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, User, Shield, Crown } from 'lucide-react';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';

interface Member {
  userId: string;
  role: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface OrganizationInfo {
  userType: 'individual' | 'business';
  hasOrganization: boolean;
  organization: any;
  userRole: string | null;
}

export default function OrganizationMembersPage() {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'member'
  });

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    try {
      const response = await fetch('/api/organization');
      const data = await response.json();
      
      if (data.success) {
        setOrgInfo(data.data);
        if (data.data.hasOrganization) {
          await fetchMembers();
        }
      } else {
        setMessage({ type: 'error', text: 'Failed to load organization data' });
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/organization/members');
      const data = await response.json();
      
      if (data.success) {
        setMembers(data.data.members);
      } else {
        setMessage({ type: 'error', text: 'Failed to load members' });
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setMessage({ type: 'error', text: 'Failed to load members' });
    }
  };

  const handleAddMember = async () => {
    if (!formData.email || !formData.role) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setAdding(true);
    try {
      const response = await fetch('/api/organization/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Member added successfully!' });
        setShowAddForm(false);
        setFormData({ email: '', role: 'member' });
        await fetchMembers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to add member' });
      }
    } catch (error) {
      console.error('Error adding member:', error);
      setMessage({ type: 'error', text: 'Failed to add member. Please try again.' });
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
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
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-500/50';
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
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Add New Member</h2>
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

            {showAddForm && (
              <div className="space-y-4">
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
                  
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Role *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ email: '', role: 'member' });
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
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Add Member</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
              {members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      {member.profilePicture ? (
                        <img 
                          src={member.profilePicture} 
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{member.name}</h3>
                      <p className="text-blue-200 text-sm">{member.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className={`px-3 py-1 rounded-full border text-sm flex items-center space-x-1 ${getRoleBadgeColor(member.role)}`}>
                      {getRoleIcon(member.role)}
                      <span className="capitalize">{member.role}</span>
                    </div>
                    
                    {isAdmin && member.role !== 'owner' && (
                      <div className="flex space-x-2">
                        {editingMember?.userId === member.userId ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={editingMember.role}
                              onChange={(e) => setEditingMember(prev => prev ? { ...prev, role: e.target.value } : null)}
                              className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleUpdateMemberRole(member.userId, editingMember.role)}
                              disabled={updating}
                              className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMember(null)}
                              className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingMember(member)}
                              className="p-1 text-blue-300 hover:text-white transition-colors"
                              title="Edit role"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              className="p-1 text-red-300 hover:text-red-400 transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DashboardFloatingButton />
    </div>
  );
} 