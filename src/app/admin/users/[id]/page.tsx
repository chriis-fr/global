'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Loader2,
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Key,
  Save,
  X
} from 'lucide-react';
import { formatDateReadable } from '@/lib/utils/dateFormat';
import { BILLING_PLANS } from '@/data/billingPlans';
import { 
  getAdminUserDetail, 
  updateAdminUser, 
  deleteAdminUser, 
  sendPasswordResetEmail,
  type AdminUserDetail 
} from '@/lib/actions/admin-users';

export default function AdminUserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user' as 'user' | 'admin',
    adminTag: false,
    planId: '',
    subscriptionStatus: 'active' as string,
    isEmailVerified: false
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth');
      return;
    }

    if (!session?.user?.adminTag) {
      router.push('/dashboard');
      return;
    }

    loadUser();
  }, [status, session, userId]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const result = await getAdminUserDetail(userId);
      if (result.success && result.data) {
        setUser(result.data);
        setFormData({
          name: result.data.name,
          email: result.data.email,
          role: result.data.role as 'user' | 'admin',
          adminTag: result.data.adminTag,
          planId: result.data.subscription.planId,
          subscriptionStatus: result.data.subscription.status,
          isEmailVerified: result.data.isEmailVerified
        });
      } else {
        toast.error(result.error || 'Failed to load user');
        router.push('/admin');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      toast.error('Failed to load user');
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateAdminUser(userId, formData);
      if (result.success) {
        toast.success('User updated successfully');
        setIsEditing(false);
        await loadUser();
      } else {
        toast.error(result.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${user?.name}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAdminUser(userId);
      if (result.success) {
        toast.success('User deleted successfully');
        router.push('/admin');
      } else {
        toast.error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setSendingReset(true);
    try {
      const result = await sendPasswordResetEmail(userId);
      if (result.success) {
        toast.success('Password reset email sent successfully');
      } else {
        toast.error(result.error || 'Failed to send password reset email');
      }
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast.error('Failed to send password reset email');
    } finally {
      setSendingReset(false);
    }
  };

  const getPlanName = (planId: string) => {
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    return plan ? plan.name : planId;
  };

  // Use consistent date formatting utility to avoid hydration mismatches
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return formatDateReadable(dateString);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session?.user?.adminTag) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-gray-600">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
                <p className="text-gray-600 mt-1">Manage user information and settings</p>
              </div>
            </div>
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        name: user.name,
                        email: user.email,
                        role: user.role as 'user' | 'admin',
                        adminTag: user.adminTag,
                        planId: user.subscription.planId,
                        subscriptionStatus: user.subscription.status,
                        isEmailVerified: user.isEmailVerified
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSendPasswordReset}
                    disabled={sendingReset}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {sendingReset ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4" />
                        Send Password Reset
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Edit User
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete User
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{user.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-900">{user.email}</p>
                      {user.isEmailVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" title="Email verified" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" title="Email not verified" />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  {isEditing ? (
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'admin' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-900 capitalize">{user.role}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Tag</label>
                  {isEditing ? (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.adminTag}
                        onChange={(e) => setFormData({ ...formData, adminTag: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Grant admin access</span>
                    </label>
                  ) : (
                    <p className="text-gray-900">{user.adminTag ? 'Yes' : 'No'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Verified</label>
                  {isEditing ? (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.isEmailVerified}
                        onChange={(e) => setFormData({ ...formData, isEmailVerified: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Email is verified</span>
                    </label>
                  ) : (
                    <p className="text-gray-900">{user.isEmailVerified ? 'Yes' : 'No'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
                  {isEditing ? (
                    <select
                      value={formData.planId}
                      onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {BILLING_PLANS.map((plan) => (
                        <option key={plan.planId} value={plan.planId}>
                          {plan.name} ({plan.type} - {plan.tier})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">{getPlanName(user.subscription.planId)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  {isEditing ? (
                    <select
                      value={formData.subscriptionStatus}
                      onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="expired">Expired</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.subscription.status === 'active' || user.subscription.status === 'trial'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.subscription.status}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Billing Period</label>
                  <p className="text-gray-900 capitalize">{user.subscription.billingPeriod}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Status</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="text-gray-900">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Login</span>
                  <span className="text-gray-900">{formatDate(user.lastLogin)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Onboarding</span>
                  <span className={user.onboardingCompleted ? 'text-green-600' : 'text-yellow-600'}>
                    {user.onboardingCompleted ? 'Completed' : `Step ${user.onboardingStep}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoices This Month</span>
                  <span className="text-gray-900">{user.usage.invoicesThisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Volume</span>
                  <span className="text-gray-900">${user.usage.monthlyVolume.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Enabled Services</h2>
              <div className="space-y-2">
                {Object.entries(user.services)
                  .filter(([, enabled]) => enabled)
                  .map(([serviceKey]) => (
                    <div key={serviceKey} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-700">{serviceKey}</span>
                    </div>
                  ))}
                {Object.values(user.services).every(enabled => !enabled) && (
                  <p className="text-sm text-gray-500 italic">No services enabled</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

