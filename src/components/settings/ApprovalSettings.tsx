'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, ChevronDown, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApprovalSettings } from '@/types/approval';
import { SettingsGuard } from '@/components/PermissionGuard';
import { OrganizationMember } from '@/models/Organization';
interface ApprovalSettingsProps {
  onSave?: (settings: ApprovalSettings) => void;
}

export function ApprovalSettingsComponent({ onSave }: ApprovalSettingsProps) {
  const [settings, setSettings] = useState<ApprovalSettings>({
    requireApproval: false,
    approvalRules: {
      amountThresholds: {
        low: 100,      // Under $100 - auto approve
        medium: 1000,  // $100-$1000 - single approval
        high: 1000     // Over $1000 - requires approval even for owners
      },
      currency: 'USD',
      requiredApprovers: {
        low: 1,
        medium: 1,
        high: 2
      },
      fallbackApprovers: [],
      autoApprove: {
        enabled: false,
        conditions: {
          vendorWhitelist: [],
          categoryWhitelist: [],
          amountLimit: 100
        }
      }
    },
    emailSettings: {
      primaryEmail: '',
      notificationEmails: [],
      approvalNotifications: true,
      paymentNotifications: true
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [organizationData, setOrganizationData] = useState<Record<string, unknown> | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch approval settings, organization data, and members in parallel
      const [settingsResponse, orgResponse, membersResponse] = await Promise.all([
        fetch('/api/organization/approval-settings'),
        fetch('/api/organization'),
        fetch('/api/organization/members')
      ]);

      const [settingsData, orgData, membersData] = await Promise.all([
        settingsResponse.json(),
        orgResponse.json(),
        membersResponse.json()
      ]);

      if (settingsData.success) {
        setSettings(settingsData.data);
      } else {
        setError(settingsData.message || 'Failed to fetch approval settings');
      }

      if (orgData.success) {
        setOrganizationData(orgData.data);
        
        // Always set primary email from organization data
        if (orgData.data.billingEmail) {
          setSettings(prev => ({
            ...prev,
            emailSettings: {
              ...prev.emailSettings,
              primaryEmail: orgData.data.billingEmail
            }
          }));
        }
      } else {
        console.error('Failed to fetch organization data:', orgData.message);
      }

      if (membersData.success) {
        setOrganizationMembers(membersData.data.members || []);
      } else {
        console.error('Failed to fetch members data:', membersData.message);
        // Fallback to organization data members if members API fails
        if (orgData.success && orgData.data.members) {
          setOrganizationMembers(orgData.data.members);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    const toastId = toast.loading('Saving settings...');
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/organization/approval-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Approval settings saved successfully');
        if (onSave) {
          onSave(settings);
        }
        toast.success('Settings saved.', { id: toastId });
      } else {
        setError(data.message || 'Failed to save approval settings');
        toast.error(data.message || 'Failed to save approval settings', { id: toastId });
      }
    } catch (err) {
      console.error('Error saving approval settings:', err);
      setError('Failed to save approval settings');
      toast.error('Failed to save approval settings', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path: string, value: unknown) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings as unknown as Record<string, unknown>;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      
      (current as Record<string, unknown>)[keys[keys.length - 1]] = value as unknown;
      return newSettings;
    });
  };

  const addFallbackApprover = (memberEmail: string) => {
    if (!settings.approvalRules.fallbackApprovers.includes(memberEmail)) {
      handleInputChange('approvalRules.fallbackApprovers', [
        ...settings.approvalRules.fallbackApprovers,
        memberEmail
      ]);
    }
  };

  const removeFallbackApprover = (email: string) => {
    handleInputChange('approvalRules.fallbackApprovers', 
      settings.approvalRules.fallbackApprovers.filter(e => e !== email)
    );
  };

  // Get available members for fallback approvers (admins and owners)
  const getAvailableFallbackApprovers = () => {
    return organizationMembers.filter(member => 
      (member.role === 'admin' || member.role === 'owner') && 
      member.status === 'active' &&
      !settings.approvalRules.fallbackApprovers.includes(member.email)
    );
  };

  // Get member details by email
  const getMemberByEmail = (email: string) => {
    return organizationMembers.find(member => member.email === email);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update primary email when organization data changes
  useEffect(() => {
    if (organizationData?.billingEmail && !settings.emailSettings.primaryEmail) {
      setSettings(prev => ({
        ...prev,
        emailSettings: {
          ...prev.emailSettings,
          primaryEmail: String(organizationData.billingEmail)
        }
      }));
    }
  }, [organizationData, settings.emailSettings.primaryEmail]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/20 rounded w-1/4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
          <div className="h-4 bg-white/20 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <SettingsGuard>
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Approval Settings</h2>
        </div>
        
               <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                 <p className="text-blue-200 text-xs">
                   When on: invoices/bills need approval before send. After all required approvals, they send automatically. Approvers get email alerts.
                 </p>
               </div>

        {error && (
          <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Save className="h-5 w-5 text-green-400" />
              <p className="text-green-200">{success}</p>
            </div>
          </div>
        )}

        {/* Main Approval Toggle */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Require Approval</h3>
              <p className="text-blue-200 text-xs mt-0.5">Invoices and bills need approval before they can be sent or paid.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireApproval}
                onChange={(e) => handleInputChange('requireApproval', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {settings.requireApproval && (
          <>
            {/* Fallback Approvers */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-medium text-white">Fallback Approvers</h3>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addFallbackApprover(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm appearance-none pr-8"
                  >
                    <option value="">Add</option>
                    {getAvailableFallbackApprovers().map((member) => (
                      <option key={member.email} value={member.email}>
                        {member.name || member.email} ({member.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
                 {getAvailableFallbackApprovers().length === 0 && (
                   <div className="text-sm text-blue-200 mt-1">
                     {settings.approvalRules.fallbackApprovers.length > 0
                       ? "You've already added all admins and owners."
                       : "No admins or owners in your organization yet."}
                   </div>
                 )}
              </div>
              <p className="text-blue-200 text-xs mb-3">Admins/owners who can approve when there aren’t enough approvers.</p>
              
              <div className="space-y-2">
                {settings.approvalRules.fallbackApprovers.map((email, index) => {
                  const member = getMemberByEmail(email);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {(member?.name || email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {member?.name || email}
                          </div>
                          <div className="text-blue-200 text-sm">
                            {member?.role || 'Unknown Role'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFallbackApprover(email)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {settings.approvalRules.fallbackApprovers.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm">None. Add admins/owners above if needed.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Email Settings */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-lg font-medium text-white mb-3">Email</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">From (org billing)</label>
                  <input
                    type="email"
                    value={settings.emailSettings.primaryEmail || String(organizationData?.billingEmail || '')}
                    readOnly
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white cursor-not-allowed text-sm"
                    placeholder={String(organizationData?.billingEmail || "Loading...")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Email approvers when something needs approval</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailSettings.approvalNotifications}
                      onChange={(e) => handleInputChange('emailSettings.approvalNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Email when payment is confirmed</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailSettings.paymentNotifications}
                      onChange={(e) => handleInputChange('emailSettings.paymentNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </SettingsGuard>
  );
}
