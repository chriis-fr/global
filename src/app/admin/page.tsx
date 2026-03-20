'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Users,
  FileText,
  DollarSign,
  Loader2,
  ArrowUp,
  CheckCircle,
  XCircle,
  Search,
  ArrowUpDown,
  Sparkles,
  Mail,
  ExternalLink,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import { BILLING_PLANS } from '@/data/billingPlans';
import { getPlanPriceLabel } from '@/lib/pricingEngine';
import { getAdminStats, type AdminStats } from '@/lib/actions/admin-stats';
import { getExplorerUrl } from '@/lib/utils/blockchain';
import { formatDateReadable } from '@/lib/utils/dateFormat';

// AdminStats type is now imported from admin-stats.ts

interface User {
  id: string;
  email: string;
  name: string;
  adminTag: boolean;
  role: string;
  userType: string;
  createdAt: string;
  lastLogin?: string;
  isEmailVerified: boolean;
  planId: string;
  subscriptionStatus: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  organizationId?: string;
  services: {
    smartInvoicing: boolean;
    accountsReceivable: boolean;
    accountsPayable: boolean;
  };
}

interface UserInvoiceDebug {
  canCreateInvoice: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
  orgReadOnlyDueToTrialEnd?: boolean;
  orgReadOnlyDueToOverdue?: boolean;
  limits?: {
    invoicesPerMonth: number;
    monthlyVolume: number;
  };
  usage?: {
    invoicesThisMonth: number;
    monthlyVolume: number;
  };
  draftsThisMonth?: number;
  totalDrafts?: number;
  planId?: string;
  status?: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // User search and plan management
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<{
    _id: string;
    email: string;
    name: string;
    invoiceCount?: number;
    invoicesThisMonth?: number;
    invoicesRemainingThisMonth?: number | null;
    invoiceLimitPerMonth?: number;
    subscription: {
      planId: string;
      status: string;
      billingPeriod: string;
    };
    services: Record<string, boolean>;
    organizationId?: string;
  } | null>(null);
  const [addToOrgQuery, setAddToOrgQuery] = useState('');
  const [addToOrgResults, setAddToOrgResults] = useState<Array<{ organizationId: string; organizationName?: string }>>([]);
  const [addToOrgSelected, setAddToOrgSelected] = useState<{ organizationId: string; organizationName?: string } | null>(null);
  const [addToOrgRole, setAddToOrgRole] = useState<'accountant' | 'approver' | 'financeManager' | 'admin'>('accountant');
  const [addingToOrg, setAddingToOrg] = useState(false);
  const [addToOrgSearching, setAddToOrgSearching] = useState(false);
  const addToOrgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searching, setSearching] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [invoiceDebug, setInvoiceDebug] = useState<UserInvoiceDebug | null>(null);
  
  // Bulk update unknown plans
  const [unknownPlansCount, setUnknownPlansCount] = useState<number | null>(null);
  const [loadingUnknownCount, setLoadingUnknownCount] = useState(false);
  const [bulkUpdatePlan, setBulkUpdatePlan] = useState<string>('receivables-free');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Org-level M-Pesa control
  const [mpesaOrgQuery, setMpesaOrgQuery] = useState('');
  const [mpesaOrgResults, setMpesaOrgResults] = useState<Array<{ organizationId: string; organizationName?: string }>>([]);
  const [mpesaOrgSelected, setMpesaOrgSelected] = useState<{ organizationId: string; organizationName?: string } | null>(null);
  const [mpesaOrgSearching, setMpesaOrgSearching] = useState(false);
  const [mpesaOrgDetail, setMpesaOrgDetail] = useState<{
    mpesaEnabled: boolean;
    credentialsConfigured?: boolean;
    businessShortCode?: string;
    accountReference?: string;
    transactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  } | null>(null);
  const mpesaOrgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mpesaToggling, setMpesaToggling] = useState(false);
  const [mpesaCredentialsSaving, setMpesaCredentialsSaving] = useState(false);
  const [mpesaCredentialsShowForm, setMpesaCredentialsShowForm] = useState(false);
  const [mpesaCredentialsForm, setMpesaCredentialsForm] = useState({
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    callbackUrl: '',
    environment: 'sandbox' as 'sandbox' | 'production',
    partyBShortCode: '',
  });
  const [mpesaBusinessForm, setMpesaBusinessForm] = useState({
    businessShortCode: '',
    accountReference: '',
    transactionType: 'CustomerPayBillOnline' as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline',
  });
  const [mpesaBusinessSaving, setMpesaBusinessSaving] = useState(false);

  // Org search for "Add to organization"
  useEffect(() => {
    if (addToOrgDebounceRef.current) clearTimeout(addToOrgDebounceRef.current);
    const q = addToOrgQuery.trim();
    if (q.length < 1) {
      setAddToOrgResults([]);
      return;
    }
    addToOrgDebounceRef.current = setTimeout(async () => {
      setAddToOrgSearching(true);
      try {
        const { searchOrganizationsForAdmin } = await import('@/lib/actions/pdf-invoice');
        const result = await searchOrganizationsForAdmin(q);
        if (result.success && result.data) {
          setAddToOrgResults(result.data.map((r) => ({ organizationId: r.organizationId, organizationName: r.organizationName })));
        } else {
          setAddToOrgResults([]);
        }
      } catch {
        setAddToOrgResults([]);
      } finally {
        setAddToOrgSearching(false);
        addToOrgDebounceRef.current = null;
      }
    }, 300);
    return () => {
      if (addToOrgDebounceRef.current) clearTimeout(addToOrgDebounceRef.current);
    };
  }, [addToOrgQuery]);

  // Org search for "M-Pesa control"
  useEffect(() => {
    if (mpesaOrgDebounceRef.current) clearTimeout(mpesaOrgDebounceRef.current);
    const q = mpesaOrgQuery.trim();
    if (q.length < 1) {
      setMpesaOrgResults([]);
      setMpesaOrgSelected(null);
      setMpesaOrgDetail(null);
      return;
    }
    mpesaOrgDebounceRef.current = setTimeout(async () => {
      setMpesaOrgSearching(true);
      try {
        const { searchOrganizationsForAdmin } = await import('@/lib/actions/pdf-invoice');
        const result = await searchOrganizationsForAdmin(q);
        if (result.success && result.data) {
          setMpesaOrgResults(
            result.data.map((r) => ({
              organizationId: r.organizationId,
              organizationName: r.organizationName,
            }))
          );
        } else {
          setMpesaOrgResults([]);
        }
      } catch {
        setMpesaOrgResults([]);
      } finally {
        setMpesaOrgSearching(false);
        mpesaOrgDebounceRef.current = null;
      }
    }, 300);
    return () => {
      if (mpesaOrgDebounceRef.current) clearTimeout(mpesaOrgDebounceRef.current);
    };
  }, [mpesaOrgQuery]);

  // Load unknown plans count function
  const loadUnknownPlansCount = async () => {
    setLoadingUnknownCount(true);
    try {
      const { getUnknownPlanUsersCount } = await import('@/lib/actions/admin');
      const result = await getUnknownPlanUsersCount();
      
      if (result.success && result.count !== undefined) {
        setUnknownPlansCount(result.count);
      } else {
        console.error('Failed to load unknown plans count:', result.error);
      }
    } catch (error) {
      console.error('Failed to load unknown plans count:', error);
    } finally {
      setLoadingUnknownCount(false);
    }
  };

  // Check authentication and admin access
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

    loadStats();
    loadUsers(1);
    loadUnknownPlansCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loadStats = async () => {
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });

      const statsPromise = getAdminStats();
      const result = await Promise.race([statsPromise, timeoutPromise]) as Awaited<ReturnType<typeof getAdminStats>>;
      
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        console.error('Failed to load stats:', result.error);
        toast.error(result.error || 'Failed to load admin statistics');
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      const errorMessage = error instanceof Error && error.message === 'Request timeout' 
        ? 'Request timed out. Please try again.' 
        : 'Failed to load admin statistics';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (page: number) => {
    setUsersLoading(true);
    try {
      const { getAdminUsers } = await import('@/lib/actions/admin-users');
      const result = await getAdminUsers(page, 10);
      if (result.success && result.data) {
        setUsers(result.data.users as User[]);
        setUsersTotal(result.data.pagination.total);
        setUsersPage(page);
      } else {
        console.error('Failed to load users:', result.error);
        toast.error(result.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session?.user?.adminTag) {
    return null; // Will redirect
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-gray-600">Failed to load admin statistics</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Use consistent date formatting utility to avoid hydration mismatches
  const formatDate = formatDateReadable;

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSearching(true);
    try {
      const { searchUserByEmail, getUserInvoicePermissionsDebug } = await import('@/lib/actions/admin');
      const result = await searchUserByEmail(searchEmail.trim());
      
      if (result.success && result.data) {
        setSearchedUser({
          _id: result.data._id,
          email: result.data.email,
          name: result.data.name,
          invoiceCount: result.data.invoiceCount,
          invoicesThisMonth: result.data.invoicesThisMonth,
          invoicesRemainingThisMonth: result.data.invoicesRemainingThisMonth,
          invoiceLimitPerMonth: result.data.invoiceLimitPerMonth,
          subscription: result.data.subscription,
          services: result.data.services,
          organizationId: result.data.organizationId,
        });
        setSelectedPlan(result.data.subscription.planId);
        setAddToOrgSelected(null);
        setAddToOrgQuery('');
        setAddToOrgResults([]);

        // Load invoice permission/limit debug info for this user
        try {
          const invoiceDebugResult = await getUserInvoicePermissionsDebug(result.data.email);
          if (invoiceDebugResult.success && invoiceDebugResult.data) {
            setInvoiceDebug(invoiceDebugResult.data as UserInvoiceDebug);
          } else {
            setInvoiceDebug(null);
          }
        } catch {
          setInvoiceDebug(null);
        }

        toast.success('User found');
      } else {
        toast.error(result.error || 'User not found');
        setSearchedUser(null);
        setInvoiceDebug(null);
      }
    } catch (error) {
      console.error('Failed to search user:', error);
      toast.error('Failed to search user');
      setInvoiceDebug(null);
    } finally {
      setSearching(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!searchedUser || !selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    if (selectedPlan === searchedUser.subscription.planId) {
      toast.error('User is already on this plan');
      return;
    }

    if (!confirm(`Are you sure you want to update ${searchedUser.name}'s plan to ${selectedPlan}?`)) {
      return;
    }

    setUpdatingPlan(true);
    try {
      const { updateUserPlanAdmin } = await import('@/lib/actions/admin');
      const result = await updateUserPlanAdmin(
        searchedUser.email,
        selectedPlan,
        'monthly'
      );
      
      if (result.success) {
        toast.success('Plan updated successfully! The changes will take effect immediately.');
        // Refresh user data
        await handleSearchUser();
        // Refresh stats
        loadStats();
      } else {
        toast.error(result.error || 'Failed to update plan');
      }
    } catch (error) {
      console.error('Failed to update plan:', error);
      toast.error('Failed to update plan');
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleAddToOrg = async () => {
    if (!searchedUser || !addToOrgSelected) {
      toast.error('Select an organization');
      return;
    }
    setAddingToOrg(true);
    try {
      const { addUserToOrganization } = await import('@/lib/actions/admin-users');
      const result = await addUserToOrganization(searchedUser.email, addToOrgSelected.organizationId, addToOrgRole);
      if (result.success) {
        toast.success(`Added ${searchedUser.name} to ${addToOrgSelected.organizationName || 'organization'}`);
        await handleSearchUser();
      } else {
        toast.error(result.error || 'Failed to add user to organization');
      }
    } catch (error) {
      console.error('Add to org:', error);
      toast.error('Failed to add user to organization');
    } finally {
      setAddingToOrg(false);
    }
  };

  const loadMpesaOrgDetail = async (orgId: string) => {
    setMpesaOrgDetail(null);
    try {
      const { getOrganizationMpesaStatus, getOrganizationMpesaCredentialsStatus } = await import('@/app/actions/mpesa-org-actions');
      const [statusRes, credRes] = await Promise.all([
        getOrganizationMpesaStatus(orgId),
        getOrganizationMpesaCredentialsStatus(orgId),
      ]);
      if (statusRes.success && statusRes.data) {
        setMpesaOrgDetail({
          mpesaEnabled: statusRes.data.mpesaEnabled,
          credentialsConfigured: credRes.success && credRes.configured === true,
          businessShortCode: statusRes.data.businessShortCode,
          accountReference: statusRes.data.accountReference,
          transactionType: statusRes.data.transactionType,
        });
        setMpesaBusinessForm({
          businessShortCode: statusRes.data.businessShortCode ?? '',
          accountReference: statusRes.data.accountReference ?? '',
          transactionType: statusRes.data.transactionType ?? 'CustomerPayBillOnline',
        });
      } else if (statusRes.error) {
        toast.error(statusRes.error);
      }
    } catch (error) {
      console.error('Failed to load org M-Pesa status:', error);
      toast.error('Failed to load organization M-Pesa status');
    }
  };

  const handleToggleOrgMpesa = async () => {
    if (!mpesaOrgSelected || !mpesaOrgDetail) return;
    setMpesaToggling(true);
    try {
      const { setOrganizationMpesaEnabled } = await import('@/app/actions/mpesa-org-actions');
      const next = !mpesaOrgDetail.mpesaEnabled;
      const result = await setOrganizationMpesaEnabled(mpesaOrgSelected.organizationId, next);
      if (result.success) {
        setMpesaOrgDetail((prev) => (prev ? { ...prev, mpesaEnabled: next } : { mpesaEnabled: next, credentialsConfigured: false }));
        toast.success(`M-Pesa ${next ? 'enabled' : 'disabled'} for this organization`);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to toggle org M-Pesa:', error);
      toast.error('Failed to update M-Pesa setting');
    } finally {
      setMpesaToggling(false);
    }
  };

  const handleSaveMpesaCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpesaOrgSelected) return;
    setMpesaCredentialsSaving(true);
    try {
      const { setOrganizationMpesaCredentials } = await import('@/app/actions/mpesa-org-actions');
      const result = await setOrganizationMpesaCredentials(mpesaOrgSelected.organizationId, {
        consumerKey: mpesaCredentialsForm.consumerKey,
        consumerSecret: mpesaCredentialsForm.consumerSecret,
        passkey: mpesaCredentialsForm.passkey,
        callbackUrl: mpesaCredentialsForm.callbackUrl,
        environment: mpesaCredentialsForm.environment,
        partyBShortCode: mpesaCredentialsForm.partyBShortCode,
      });
      if (result.success) {
        await loadMpesaOrgDetail(mpesaOrgSelected.organizationId);
        setMpesaCredentialsForm({ consumerKey: '', consumerSecret: '', passkey: '', callbackUrl: '', environment: 'sandbox', partyBShortCode: '' });
        setMpesaCredentialsShowForm(false);
        toast.success('Daraja credentials saved (stored encrypted). They are never shown in the UI.');
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to save M-Pesa credentials:', error);
      toast.error('Failed to save credentials');
    } finally {
      setMpesaCredentialsSaving(false);
    }
  };

  const handleSaveMpesaBusinessConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpesaOrgSelected) return;
    setMpesaBusinessSaving(true);
    try {
      const { setOrganizationMpesaBusinessConfig } = await import('@/app/actions/mpesa-org-actions');
      const result = await setOrganizationMpesaBusinessConfig(mpesaOrgSelected.organizationId, {
        businessShortCode: mpesaBusinessForm.businessShortCode.trim() || undefined,
        accountReference: mpesaBusinessForm.accountReference.trim() || undefined,
        transactionType: mpesaBusinessForm.transactionType,
      });
      if (result.success) {
        await loadMpesaOrgDetail(mpesaOrgSelected.organizationId);
        toast.success('M-Pesa business config saved. Sandbox: use 174379; live: use your Paybill/Till.');
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to save M-Pesa business config:', error);
      toast.error('Failed to save business config');
    } finally {
      setMpesaBusinessSaving(false);
    }
  };

  const getPlanName = (planId: string) => {
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    return plan ? plan.name : planId;
  };

  const handleBulkUpdateUnknownPlans = async () => {
    if (!bulkUpdatePlan) {
      toast.error('Please select a plan');
      return;
    }

    if (unknownPlansCount === null || unknownPlansCount === 0) {
      toast.error('No users with unknown plans found');
      return;
    }

    if (!confirm(`Are you sure you want to update ${unknownPlansCount} user(s) with unknown plans to ${getPlanName(bulkUpdatePlan)}? This action cannot be undone.`)) {
      return;
    }

    setBulkUpdating(true);
    try {
      const { bulkUpdateUnknownPlans } = await import('@/lib/actions/admin');
      const result = await bulkUpdateUnknownPlans(bulkUpdatePlan, 'monthly');
      
      if (result.success) {
        toast.success(`Successfully updated ${result.updatedCount || 0} user(s) to ${getPlanName(bulkUpdatePlan)}!`);
        // Refresh counts
        await loadUnknownPlansCount();
        // Refresh stats
        loadStats();
        // Refresh users list
        loadUsers(usersPage);
      } else {
        toast.error(result.error || 'Failed to update plans');
      }
    } catch (error) {
      console.error('Failed to bulk update plans:', error);
      toast.error('Failed to bulk update plans');
    } finally {
      setBulkUpdating(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">System overview and user management</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  loadStats();
                  loadUsers(usersPage);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                title="Refresh data"
              >
                <ArrowUp className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={() => router.push('/admin/pdf-formats')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF Formats
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bulk Update Unknown Plans */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <ArrowUpDown className="h-5 w-5 text-yellow-600" />
                <span>Bulk Update Unknown Plans</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Update all users with unknown or invalid plans to a selected plan
              </p>
            </div>
            <button
              onClick={loadUnknownPlansCount}
              disabled={loadingUnknownCount}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {loadingUnknownCount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <ArrowUp className="h-4 w-4" />
                  <span>Refresh Count</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Users with Unknown Plans
              </label>
              <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                {loadingUnknownCount ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                    <span className="text-gray-600">Loading...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-yellow-700">
                      {unknownPlansCount !== null ? unknownPlansCount : '--'}
                    </span>
                    <span className="text-sm text-gray-600">user(s)</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="bulk-plan-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Plan to Assign
              </label>
              <select
                id="bulk-plan-select"
                value={bulkUpdatePlan}
                onChange={(e) => setBulkUpdatePlan(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {BILLING_PLANS.map((plan) => (
                  <option key={plan.planId} value={plan.planId}>
                    {plan.name} ({plan.type} - {plan.tier}) - {getPlanPriceLabel(plan)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={handleBulkUpdateUnknownPlans}
                disabled={bulkUpdating || unknownPlansCount === null || unknownPlansCount === 0}
                className="w-full px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {bulkUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Update All Unknown Plans</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {unknownPlansCount !== null && unknownPlansCount > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This will update {unknownPlansCount} user(s) with unknown or invalid plans 
                to <strong>{getPlanName(bulkUpdatePlan)}</strong>. All subscription caches will be cleared 
                and changes will take effect immediately.
              </p>
            </div>
          )}

          {unknownPlansCount === 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>✓ All users have valid plans.</strong> No action needed.
              </p>
            </div>
          )}
        </div>

        {/* User Search and Plan Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">User Search & Plan Management</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="search-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Email
                </label>
                <div className="flex gap-2">
                  <input
                    id="search-email"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                    placeholder="Enter user email address"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearchUser}
                    disabled={searching || !searchEmail.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>Search</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {searchedUser && (
              <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{searchedUser.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{searchedUser.email}</span>
                      {searchedUser.organizationId && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          In organization
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Current Plan</p>
                    <p className="text-lg font-semibold text-gray-900">{getPlanName(searchedUser.subscription.planId)}</p>
                    <p className="text-xs text-gray-500 mt-1">{searchedUser.subscription.planId}</p>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      {typeof searchedUser.invoiceCount === 'number' && (
                        <p>
                          Total invoices (all time):{' '}
                          <span className="font-semibold">{searchedUser.invoiceCount}</span>
                        </p>
                      )}
                      {typeof searchedUser.invoicesThisMonth === 'number' && (
                        <p>
                          This month:{' '}
                          <span className="font-semibold">
                            {searchedUser.invoicesThisMonth}
                            {searchedUser.invoiceLimitPerMonth !== undefined && searchedUser.invoiceLimitPerMonth !== -1 && (
                              <> / {searchedUser.invoiceLimitPerMonth}</>
                            )}
                          </span>
                        </p>
                      )}
                      {searchedUser.invoiceLimitPerMonth !== undefined && searchedUser.invoiceLimitPerMonth === -1 && (
                        <p>
                          Monthly invoice limit:{' '}
                          <span className="font-semibold">Unlimited</span>
                        </p>
                      )}
                      {searchedUser.invoicesRemainingThisMonth !== null && searchedUser.invoicesRemainingThisMonth !== undefined && searchedUser.invoiceLimitPerMonth !== -1 && (
                        <p>
                          Invoices left this month:{' '}
                          <span className="font-semibold">{searchedUser.invoicesRemainingThisMonth}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label htmlFor="plan-select" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <ArrowUpDown className="h-4 w-4" />
                        <span>Select New Plan</span>
                      </div>
                    </label>
                    <select
                      id="plan-select"
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {BILLING_PLANS.map((plan) => (
                        <option key={plan.planId} value={plan.planId}>
                          {plan.name} ({plan.type} - {plan.tier}) - {getPlanPriceLabel(plan)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enabled Services
                    </label>
                    <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {Object.entries(searchedUser.services)
                        .filter(([, enabled]) => enabled)
                        .length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(searchedUser.services)
                            .filter(([, enabled]) => enabled)
                            .map(([serviceKey]) => (
                              <div key={serviceKey} className="flex items-center space-x-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-gray-700">{serviceKey}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No services enabled</p>
                      )}
                    </div>
                  </div>
                </div>

                {invoiceDebug && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span>Invoice Permissions & Limits (what causes 403s)</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p>
                          <span className="font-medium text-gray-700">Can create invoices:</span>{' '}
                          <span className={invoiceDebug.canCreateInvoice ? 'text-green-700' : 'text-red-700'}>
                            {invoiceDebug.canCreateInvoice ? 'Yes' : 'No'}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">403 reason:</span>{' '}
                          <span className="text-gray-800">
                            {invoiceDebug.reason || '—'}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Requires upgrade:</span>{' '}
                          <span className={invoiceDebug.requiresUpgrade ? 'text-red-700' : 'text-gray-700'}>
                            {invoiceDebug.requiresUpgrade ? 'Yes' : 'No'}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p>
                          <span className="font-medium text-gray-700">Org read-only (trial end):</span>{' '}
                          <span className={invoiceDebug.orgReadOnlyDueToTrialEnd ? 'text-red-700' : 'text-gray-700'}>
                            {invoiceDebug.orgReadOnlyDueToTrialEnd ? 'Yes' : 'No'}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Org read-only (overdue):</span>{' '}
                          <span className={invoiceDebug.orgReadOnlyDueToOverdue ? 'text-red-700' : 'text-gray-700'}>
                            {invoiceDebug.orgReadOnlyDueToOverdue ? 'Yes' : 'No'}
                          </span>
                        </p>
                        {invoiceDebug.limits && invoiceDebug.usage && (
                          <>
                            <p>
                              <span className="font-medium text-gray-700">Invoices this month:</span>{' '}
                              <span className="text-gray-800">
                                {invoiceDebug.usage.invoicesThisMonth} / {invoiceDebug.limits.invoicesPerMonth}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium text-gray-700">Monthly volume:</span>{' '}
                              <span className="text-gray-800">
                                {invoiceDebug.usage.monthlyVolume} / {invoiceDebug.limits.monthlyVolume}
                              </span>
                            </p>
                          </>
                        )}
                        {typeof invoiceDebug.draftsThisMonth === 'number' && typeof invoiceDebug.totalDrafts === 'number' && (
                          <>
                            <p>
                              <span className="font-medium text-gray-700">Drafts this month:</span>{' '}
                              <span className="text-gray-800">
                                {invoiceDebug.draftsThisMonth}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium text-gray-700">Total drafts:</span>{' '}
                              <span className="text-gray-800">
                                {invoiceDebug.totalDrafts}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <p>Status: <span className="font-medium">{searchedUser.subscription.status}</span></p>
                    <p className="mt-1">Billing: <span className="font-medium">{searchedUser.subscription.billingPeriod}</span></p>
                  </div>
                  <button
                    onClick={handleUpdatePlan}
                    disabled={updatingPlan || selectedPlan === searchedUser.subscription.planId}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {updatingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Update Plan</span>
                      </>
                    )}
                  </button>
                </div>

                {selectedPlan !== searchedUser.subscription.planId && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> The plan will be updated immediately in the database. 
                      The user&apos;s subscription cache will be cleared and changes will take effect on their next page refresh.
                    </p>
                  </div>
                )}

                {!searchedUser.organizationId && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-600" />
                      Add to organization
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      User created an individual account. Search for an organization and select from the list below.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Search organization</label>
                        <input
                          type="text"
                          value={addToOrgQuery}
                          onChange={(e) => setAddToOrgQuery(e.target.value)}
                          placeholder="Type org name or member email to see list"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {addToOrgSearching && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                          </p>
                        )}
                      </div>
                      {addToOrgResults.length > 0 && !addToOrgSelected && (
                        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
                          <p className="px-3 py-2 text-xs font-medium text-gray-600 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                            Select an organization from the list:
                          </p>
                          <ul className="max-h-48 overflow-y-auto">
                            {addToOrgResults.map((r) => (
                              <li
                                key={r.organizationId}
                                className="px-3 py-3 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center justify-between group"
                                onClick={() => {
                                  setAddToOrgSelected(r);
                                  setAddToOrgQuery(r.organizationName || r.organizationId);
                                }}
                              >
                                <span className="font-medium text-gray-900">{r.organizationName || r.organizationId}</span>
                                <span className="text-xs text-gray-500 group-hover:text-blue-600">Click to select</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {addToOrgQuery.trim().length >= 1 && addToOrgResults.length === 0 && !addToOrgSearching && (
                        <p className="text-sm text-gray-500 italic">No organizations found. Try a different search term.</p>
                      )}
                      {addToOrgSelected && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <span className="text-sm text-blue-900 font-medium">
                            {addToOrgSelected.organizationName || addToOrgSelected.organizationId}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAddToOrgSelected(null);
                              setAddToOrgQuery('');
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={addToOrgRole}
                          onChange={(e) => setAddToOrgRole(e.target.value as typeof addToOrgRole)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="accountant">Accountant</option>
                          <option value="approver">Approver</option>
                          <option value="financeManager">Finance Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddToOrg}
                        disabled={!addToOrgSelected || addingToOrg}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                      >
                        {addingToOrg ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4" />
                            Add to organization
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Organization M-Pesa Control (admin-only, per-organization toggle) */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Organization M-Pesa Control</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search organization (name or member email)
              </label>
              <input
                type="text"
                value={mpesaOrgQuery}
                onChange={(e) => setMpesaOrgQuery(e.target.value)}
                placeholder="Type to find organization..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {mpesaOrgSearching && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                </p>
              )}
            </div>

            {mpesaOrgResults.length > 0 && !mpesaOrgSelected && (
              <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-56 overflow-y-auto">
                {mpesaOrgResults.map((org) => (
                  <button
                    key={org.organizationId}
                    type="button"
                    onClick={() => {
                      setMpesaOrgSelected(org);
                      setMpesaOrgResults([]);
                      loadMpesaOrgDetail(org.organizationId);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-900">
                      {org.organizationName || org.organizationId}
                    </span>
                    <span className="text-xs text-gray-500">Select</span>
                  </button>
                ))}
              </div>
            )}

            {mpesaOrgSelected && (
              <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {mpesaOrgSelected.organizationName || mpesaOrgSelected.organizationId}
                    </p>
                    <p className="text-xs text-gray-500">ID: {mpesaOrgSelected.organizationId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMpesaOrgSelected(null);
                      setMpesaOrgDetail(null);
                      setMpesaOrgQuery('');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">M-Pesa Enabled</p>
                    <p className="text-xs text-gray-500">
                      Controls whether this organization can use the waiter STK prompts and M-Pesa flows.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleOrgMpesa}
                    disabled={!mpesaOrgDetail || mpesaToggling}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                      mpesaOrgDetail?.mpesaEnabled
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {mpesaToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mpesaOrgDetail?.mpesaEnabled ? (
                      'Disable'
                    ) : (
                      'Enable'
                    )}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">M-Pesa business config (shortcode &amp; account)</p>
                  <p className="text-xs text-gray-500 mb-2">
                    When set, STK uses these instead of the org&apos;s Payment Method. Sandbox: shortcode <strong>174379</strong>, account e.g. &quot;Test&quot;. Live: your Paybill or Till number.
                  </p>
                  <form onSubmit={handleSaveMpesaBusinessConfig} className="space-y-2 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Business Shortcode</label>
                        <input
                          type="text"
                          value={mpesaBusinessForm.businessShortCode}
                          onChange={(e) => setMpesaBusinessForm((p) => ({ ...p, businessShortCode: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="e.g. 174379 (sandbox)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Account Reference (max 12)</label>
                        <input
                          type="text"
                          maxLength={12}
                          value={mpesaBusinessForm.accountReference}
                          onChange={(e) => setMpesaBusinessForm((p) => ({ ...p, accountReference: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="e.g. Test, Sandbox"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Type</label>
                        <select
                          value={mpesaBusinessForm.transactionType}
                          onChange={(e) => setMpesaBusinessForm((p) => ({ ...p, transactionType: e.target.value as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="CustomerPayBillOnline">Paybill</option>
                          <option value="CustomerBuyGoodsOnline">Till</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={mpesaBusinessSaving}
                      className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      {mpesaBusinessSaving ? 'Saving...' : 'Save business config'}
                    </button>
                  </form>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Daraja credentials (sandbox/production)</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Stored encrypted per organization. Fill only the fields you want to set; save stores those and keeps the rest as-is. Never exposed in the UI.
                  </p>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
                    Sandbox: Passkey from Daraja sandbox (e.g. bfb279f9...). Callback = <strong>https://your-public-host/api/mpesa/callback</strong> (HTTPS; use ngrok for local).
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Status: <span className={mpesaOrgDetail?.credentialsConfigured ? 'text-green-600 font-medium' : 'text-amber-600'}>{mpesaOrgDetail?.credentialsConfigured ? 'Configured' : 'Not set'}</span>
                  </p>
                  {!mpesaCredentialsShowForm ? (
                    <button
                      type="button"
                      onClick={() => setMpesaCredentialsShowForm(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {mpesaOrgDetail?.credentialsConfigured ? 'Update credentials' : 'Set credentials'}
                    </button>
                  ) : (
                    <form onSubmit={handleSaveMpesaCredentials} className="space-y-3 mt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Consumer Key</label>
                        <input
                          type="text"
                          value={mpesaCredentialsForm.consumerKey}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, consumerKey: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="Daraja consumer key"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Consumer Secret</label>
                        <input
                          type="password"
                          value={mpesaCredentialsForm.consumerSecret}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, consumerSecret: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="Daraja consumer secret"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Lipa Na M-Pesa Online Passkey</label>
                        <input
                          type="password"
                          value={mpesaCredentialsForm.passkey}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, passkey: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="Passkey"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Callback URL</label>
                        <input
                          type="url"
                          value={mpesaCredentialsForm.callbackUrl}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, callbackUrl: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="https://your-domain.com/api/mpesa/callback (must be HTTPS; this app receives at /api/mpesa/callback)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Environment</label>
                        <select
                          value={mpesaCredentialsForm.environment}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, environment: e.target.value as 'sandbox' | 'production' }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="sandbox">Sandbox</option>
                          <option value="production">Production</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">PartyB Shortcode (optional)</label>
                        <input
                          type="text"
                          value={mpesaCredentialsForm.partyBShortCode}
                          onChange={(e) => setMpesaCredentialsForm((p) => ({ ...p, partyBShortCode: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="Override for PartyB (till/store/agent). If empty, Business Shortcode is used."
                          autoComplete="off"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={mpesaCredentialsSaving}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {mpesaCredentialsSaving ? 'Saving...' : 'Save credentials'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMpesaCredentialsShowForm(false); setMpesaCredentialsForm({ consumerKey: '', consumerSecret: '', passkey: '', callbackUrl: '', environment: 'sandbox', partyBShortCode: '' }); }}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.users.total.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">{stats.users.thisMonth} this month</span>
                </div>
              </div>
              <Users className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          {/* Total Organizations */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Organizations</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.organizations.total.toLocaleString()}
                </p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">
                    {stats.organizations.thisMonth} created this month
                  </span>
                </div>
              </div>
              <Users className="h-12 w-12 text-indigo-500" />
            </div>
          </div>

          {/* Total Invoices */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.invoices.total.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-gray-600">{stats.invoices.thisMonth} this month</span>
                </div>
              </div>
              <FileText className="h-12 w-12 text-purple-500" />
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.revenue.total)}</p>
                <div className="flex items-center mt-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-gray-600">{stats.revenue.transactions} transactions</span>
                </div>
              </div>
              <DollarSign className="h-12 w-12 text-green-500" />
            </div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* User Growth */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Growth</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Today</span>
                <span className="font-semibold">{stats.users.today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Week</span>
                <span className="font-semibold">{stats.users.thisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month</span>
                <span className="font-semibold">{stats.users.thisMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Year</span>
                <span className="font-semibold">{stats.users.thisYear}</span>
              </div>
            </div>
          </div>

          {/* Onboarding Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Onboarding Status</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-gray-600">Completed</span>
                </div>
                <span className="font-semibold">{stats.users.onboarding.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-gray-600">Pending</span>
                </div>
                <span className="font-semibold">{stats.users.onboarding.pending}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(stats.users.onboarding.completed / stats.users.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {((stats.users.onboarding.completed / stats.users.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Users by Plan */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Users by Plan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.users.byPlan.map((plan) => (
              <div key={plan.planId} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{plan.planId || 'Unknown'}</p>
                <p className="text-2xl font-bold text-gray-900">{plan.count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chain/Blockchain Transactions */}
        {stats.chainTransactions && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                  <Link2 className="h-5 w-5 text-blue-600" />
                  <span>Blockchain Transactions</span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Transactions made on Celo and other supported chains
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.chainTransactions.total}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {stats.chainTransactions.celo} on Celo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-blue-600">{stats.chainTransactions.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Celo Transactions</p>
                <p className="text-2xl font-bold text-green-600">{stats.chainTransactions.celo}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.chainTransactions.totalAmount)}</p>
              </div>
            </div>

            {stats.chainTransactions.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Hash</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chain</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.chainTransactions.transactions.map((tx) => {
                      const explorerUrl = getExplorerUrl(tx.txHash, tx.chainId);
                      return (
                        <tr key={tx._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {explorerUrl ? (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors group"
                              >
                                <code className="text-sm font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded group-hover:bg-gray-200">
                                  {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                                </code>
                                <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <code className="text-sm font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                              </code>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {tx.chainName || (tx.chainId ? `Chain ${tx.chainId}` : 'Unknown')}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              tx.type === 'invoice' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {tx.type === 'invoice' ? 'Invoice' : 'Payable'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {tx.amountUsd !== undefined 
                              ? `${formatCurrency(tx.amountUsd)} (${tx.amount} ${tx.currency})`
                              : `${formatCurrency(tx.amount)} ${tx.currency}`
                            }
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(
                              tx.createdAt instanceof Date 
                                ? tx.createdAt.toISOString() 
                                : typeof tx.createdAt === 'string' 
                                  ? tx.createdAt 
                                  : new Date(tx.createdAt).toISOString()
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Link2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No blockchain transactions found</p>
              </div>
            )}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">All Users</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadUsers(usersPage - 1)}
                  disabled={usersPage === 1 || usersLoading}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {usersPage} of {Math.ceil(usersTotal / 10)}
                </span>
                <button
                  onClick={() => loadUsers(usersPage + 1)}
                  disabled={usersPage >= Math.ceil(usersTotal / 10) || usersLoading}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          {usersLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            {user.adminTag && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {user.organizationId ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Org member
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Individual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{user.planId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.onboardingCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Step {user.onboardingStep}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscriptionStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

