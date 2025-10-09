'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Toggle, DollarSign, Users, Mail, Save, AlertCircle, ChevronDown, X } from 'lucide-react';
import { ApprovalSettings } from '@/types/approval';
import { SettingsGuard } from '@/components/PermissionGuard';
import { OrganizationMember } from '@/types/organization';

interface ApprovalSettingsProps {
  onSave?: (settings: ApprovalSettings) => void;
}

export function ApprovalSettingsComponent({ onSave }: ApprovalSettingsProps) {
  const [settings, setSettings] = useState<ApprovalSettings>({
    requireApproval: true,
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
  const [organizationData, setOrganizationData] = useState<any>(null);

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
      } else {
        setError(data.message || 'Failed to save approval settings');
      }
    } catch (err) {
      console.error('Error saving approval settings:', err);
      setError('Failed to save approval settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
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

  const addVendorToWhitelist = () => {
    const vendor = prompt('Enter vendor name:');
    if (vendor && !settings.approvalRules.autoApprove.conditions.vendorWhitelist.includes(vendor)) {
      handleInputChange('approvalRules.autoApprove.conditions.vendorWhitelist', [
        ...settings.approvalRules.autoApprove.conditions.vendorWhitelist,
        vendor
      ]);
    }
  };

  const removeVendorFromWhitelist = (vendor: string) => {
    handleInputChange('approvalRules.autoApprove.conditions.vendorWhitelist',
      settings.approvalRules.autoApprove.conditions.vendorWhitelist.filter(v => v !== vendor)
    );
  };

  const addCategoryToWhitelist = () => {
    const category = prompt('Enter category:');
    if (category && !settings.approvalRules.autoApprove.conditions.categoryWhitelist.includes(category)) {
      handleInputChange('approvalRules.autoApprove.conditions.categoryWhitelist', [
        ...settings.approvalRules.autoApprove.conditions.categoryWhitelist,
        category
      ]);
    }
  };

  const removeCategoryFromWhitelist = (category: string) => {
    handleInputChange('approvalRules.autoApprove.conditions.categoryWhitelist',
      settings.approvalRules.autoApprove.conditions.categoryWhitelist.filter(c => c !== category)
    );
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
          primaryEmail: organizationData.billingEmail
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
        
               <div className="p-4 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                 <div className="flex items-start space-x-2">
                   <AlertCircle className="h-5 w-5 text-blue-300 mt-0.5 flex-shrink-0" />
                   <div>
                     <p className="text-blue-100 text-sm font-medium mb-1">Important: When approval is enabled</p>
                     <p className="text-blue-200 text-xs">
                       ALL invoices (including those created by owners) will require approval before being sent to recipients. 
                       <strong>Owners cannot approve their own invoices</strong> unless there are insufficient approvers in the organization.
                       If you have fewer admins/approvers than required approvals, owners can approve their own invoices to prevent deadlocks.
                       <strong>Once all required approvals are received, the invoice will be automatically sent to the recipient.</strong>
                       Approvers will receive email notifications when invoices need their approval.
                     </p>
                   </div>
                 </div>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-white">Require Approval</h3>
              <p className="text-blue-200 text-sm">
                Enable approval workflow for bills and payments
              </p>
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
            {/* Amount Thresholds */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <DollarSign className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-medium text-white">Amount Thresholds</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Low Threshold
                  </label>
                  <input
                    type="number"
                    value={settings.approvalRules.amountThresholds.low}
                    onChange={(e) => handleInputChange('approvalRules.amountThresholds.low', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="1000"
                  />
                  <p className="text-blue-200 text-xs mt-1">Auto-approve below this amount (when approval is disabled)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Medium Threshold
                  </label>
                  <input
                    type="number"
                    value={settings.approvalRules.amountThresholds.medium}
                    onChange={(e) => handleInputChange('approvalRules.amountThresholds.medium', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="10000"
                  />
                  <p className="text-blue-200 text-xs mt-1">Single approval required</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    High Threshold
                  </label>
                  <input
                    type="number"
                    value={settings.approvalRules.amountThresholds.high}
                    onChange={(e) => handleInputChange('approvalRules.amountThresholds.high', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="50000"
                  />
                  <p className="text-blue-200 text-xs mt-1">Dual approval required</p>
                </div>
              </div>
            </div>

            {/* Required Approvers */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Users className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-medium text-white">Required Approvers</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Low Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.approvalRules.requiredApprovers.low}
                    onChange={(e) => handleInputChange('approvalRules.requiredApprovers.low', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Medium Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.approvalRules.requiredApprovers.medium}
                    onChange={(e) => handleInputChange('approvalRules.requiredApprovers.medium', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    High Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.approvalRules.requiredApprovers.high}
                    onChange={(e) => handleInputChange('approvalRules.requiredApprovers.high', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Fallback Approvers */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
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
                    <option value="">Add Approver</option>
                    {getAvailableFallbackApprovers().map((member) => (
                      <option key={member.email} value={member.email}>
                        {member.name || member.email} ({member.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
                 {getAvailableFallbackApprovers().length === 0 && (
                   <div className="text-sm text-yellow-400 mt-2">
                     No available admins or owners found.
                   </div>
                 )}
              </div>
               <p className="text-blue-200 text-sm mb-4">
                 Admins and Owners who can approve when no dedicated approvers are available
               </p>
              
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
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No fallback approvers configured</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Add Admins or Owners from your organization
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-Approval Rules */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Auto-Approval Rules</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.approvalRules.autoApprove.enabled}
                    onChange={(e) => handleInputChange('approvalRules.autoApprove.enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {settings.approvalRules.autoApprove.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Amount Limit
                    </label>
                    <input
                      type="number"
                      value={settings.approvalRules.autoApprove.conditions.amountLimit}
                      onChange={(e) => handleInputChange('approvalRules.autoApprove.conditions.amountLimit', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="100"
                    />
                    <p className="text-blue-200 text-xs mt-1">Auto-approve bills under this amount</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-white">Vendor Whitelist</label>
                      <button
                        onClick={addVendorToWhitelist}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        Add Vendor
                      </button>
                    </div>
                    <div className="space-y-1">
                      {settings.approvalRules.autoApprove.conditions.vendorWhitelist.map((vendor, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                          <span className="text-white text-sm">{vendor}</span>
                          <button
                            onClick={() => removeVendorFromWhitelist(vendor)}
                            className="text-red-400 hover:text-red-300 transition-colors text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-white">Category Whitelist</label>
                      <button
                        onClick={addCategoryToWhitelist}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        Add Category
                      </button>
                    </div>
                    <div className="space-y-1">
                      {settings.approvalRules.autoApprove.conditions.categoryWhitelist.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                          <span className="text-white text-sm">{category}</span>
                          <button
                            onClick={() => removeCategoryFromWhitelist(category)}
                            className="text-red-400 hover:text-red-300 transition-colors text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email Settings */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Mail className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-medium text-white">Email Settings</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Primary Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={settings.emailSettings.primaryEmail || organizationData?.billingEmail || ''}
                      readOnly
                      className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white cursor-not-allowed"
                      placeholder={organizationData?.billingEmail || "Loading organization email..."}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <span className="text-blue-400 text-xs bg-blue-600/20 px-2 py-1 rounded">
                        Organization Email
                      </span>
                    </div>
                  </div>
                  <p className="text-blue-200 text-xs mt-1">
                    This email is set from your organization&apos;s billing email and cannot be changed here
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-white">Approval Notifications</label>
                    <p className="text-blue-200 text-xs">Send email notifications for approval requests</p>
                  </div>
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
                  <div>
                    <label className="text-sm font-medium text-white">Payment Notifications</label>
                    <p className="text-blue-200 text-xs">Send email notifications for payment confirmations</p>
                  </div>
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
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </SettingsGuard>
  );
}
