'use client';
import { useState, useEffect } from 'react';
import { Building2, Users, Edit, User } from 'lucide-react';

interface OrganizationAddress {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface Organization {
  name: string;
  industry: string;
  companySize: string;
  businessType: string;
  phone: string;
  address: OrganizationAddress;
}

interface OrganizationInfo {
  userType: 'individual' | 'business';
  hasOrganization: boolean;
  organization: Organization | null;
  userRole: string | null;
}

export default function OrganizationSettingsPage() {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    try {
      const response = await fetch('/api/organization');
      const data = await response.json();
      
      if (data.success) {
        setOrgInfo(data.data);
      } else {
        setMessage({ type: 'error', text: 'Failed to load organization data' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-blue-200">Manage your organization information and business details.</p>
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

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
        <p className="text-blue-200">
          {orgInfo?.hasOrganization 
            ? 'Manage your organization information and team members.'
            : 'Create an organization or manage your personal business information.'
          }
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

      {/* Personal Account View */}
      {!orgInfo?.hasOrganization && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Personal Account</h2>
            </div>
            <button
              onClick={() => {
                // TODO: Implement organization creation
                setMessage({ type: 'success', text: 'Organization creation coming soon!' });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Create Organization</span>
            </button>
          </div>
                     <p className="text-blue-200">
             You&apos;re currently using a personal account. Create an organization to collaborate with team members and manage business operations together.
           </p>
        </div>
      )}

      {/* Organization View */}
      {orgInfo?.hasOrganization && orgInfo.organization && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">{orgInfo.organization.name}</h2>
                <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full">
                  {orgInfo.userRole}
                </span>
              </div>
              <div className="flex space-x-2">
                {(orgInfo.userRole === 'owner' || orgInfo.userRole === 'admin') && (
                  <button
                    onClick={() => {
                      setMessage({ type: 'success', text: 'Organization editing coming soon!' });
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setMessage({ type: 'success', text: 'Member management coming soon!' });
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-1"
                >
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm w-full">
              <div>
                <span className="text-blue-300">Industry:</span>
                <span className="text-white ml-2">{orgInfo.organization.industry}</span>
              </div>
              <div>
                <span className="text-blue-300">Company Size:</span>
                <span className="text-white ml-2">{orgInfo.organization.companySize}</span>
              </div>
              <div>
                <span className="text-blue-300">Business Type:</span>
                <span className="text-white ml-2">{orgInfo.organization.businessType}</span>
              </div>
              <div>
                <span className="text-blue-300">Phone:</span>
                <span className="text-white ml-2">{orgInfo.organization.phone}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-blue-300">Address:</span>
                <span className="text-white ml-2 break-words">
                  {orgInfo.organization.address.street}, {orgInfo.organization.address.city}, {orgInfo.organization.address.country} {orgInfo.organization.address.postalCode}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 