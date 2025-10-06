'use client';
import { useState, useEffect } from 'react';
import { Building2, Users, Edit, User, Plus, Image, Crown } from 'lucide-react';
import { LogoManager } from '@/components/LogoManager';
import DashboardFloatingButton from '@/components/DashboardFloatingButton';
import { LogoDisplay } from '@/components/LogoDisplay';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { useRouter } from 'next/navigation';

interface OrganizationAddress {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface Organization {
  _id: string;
  name: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  memberCount?: number;
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone: string;
  billingEmail: string;
  address: OrganizationAddress;
  status: 'pending' | 'active' | 'suspended';
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationInfo {
  userType: 'individual' | 'business';
  hasOrganization: boolean;
  organization: Organization | null;
  userRole: string | null;
}

interface CreateOrganizationForm {
  name: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '200+';
  businessType: 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship';
  phone: string;
  billingEmail: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
}

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

export default function OrganizationSettingsPage() {
  const { subscription } = useSubscription();
  const router = useRouter();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [formData, setFormData] = useState<CreateOrganizationForm>({
    name: '',
    industry: '',
    companySize: '1-10',
    businessType: 'LLC',
    phone: '',
    billingEmail: '',
    address: {
      street: '',
      city: '',
      country: '',
      postalCode: ''
    }
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

  const handleCreateOrganization = async () => {
    if (!formData.name || !formData.industry || !formData.billingEmail) {
      setMessage({ type: 'error', text: 'Please fill in all required fields (Name, Industry, and Billing Email)' });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Organization created successfully! You can now collaborate with team members.' });
        setShowCreateForm(false);
        // Refresh organization data
        await fetchOrganizationData();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create organization' });
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setMessage({ type: 'error', text: 'Failed to create organization. Please try again.' });
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CreateOrganizationForm] as Record<string, string>),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleUpgradeToPro = () => {
    router.push('/pricing');
  };

  // Check if user has organization access (Pro plans for individuals, or organization membership)
  const hasOrganizationAccess = subscription?.canCreateOrganization || (orgInfo?.hasOrganization && orgInfo?.organization);

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
        <DashboardFloatingButton />
      </div>
    );
  }

  // Show upgrade prompt for free plan users
  if (!hasOrganizationAccess) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-blue-200">Manage your organization information and business details.</p>
        </div>

        {/* Upgrade Required Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-yellow-500/20 rounded-full">
              <Crown className="h-12 w-12 text-yellow-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">Upgrade to Pro for Organization Access</h2>
          <p className="text-blue-200 mb-6 max-w-2xl mx-auto">
            Organization management and team collaboration features are available with our Pro plans. 
            Upgrade your account to create organizations, manage team members, and collaborate with your business partners.
          </p>

          <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
            <h3 className="text-blue-300 font-medium mb-4">Pro Plan Benefits:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Create and manage organizations</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Add team members and assign roles</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Role-based access control</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Shared client management</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Team analytics and reporting</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-200 text-sm">Advanced invoice management</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpgradeToPro}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Crown className="h-5 w-5" />
            <span>Upgrade to Pro</span>
          </button>
        </div>

        <DashboardFloatingButton />
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

      {/* Individual User - No Organization */}
      {orgInfo?.userType === 'individual' && !orgInfo?.hasOrganization && (
        <div className="space-y-6">
          {/* Personal Account Info */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <User className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Personal Account</h2>
              </div>
            </div>
                         <p className="text-blue-200 mb-4">
               You&apos;re currently using a personal account. Create an organization to collaborate with team members and manage business operations together.
             </p>
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-blue-300 font-medium mb-2">Benefits of creating an organization:</h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Collaborate with team members</li>
                <li>• Manage invoices and payments together</li>
                <li>• Role-based access control</li>
                <li>• Shared client management</li>
                <li>• Team analytics and reporting</li>
              </ul>
            </div>
          </div>

          {/* Create Organization Section */}
          {!showCreateForm ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-center">
                <Building2 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ready to scale your business?</h3>
                <p className="text-blue-200 mb-6">
                  Create an organization to unlock team collaboration features and manage your business operations more effectively.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Organization</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Create Organization</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-blue-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter organization name"
                  />
                </div>
                
                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Industry *
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Industry</option>
                    <option value="technology">Technology</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="education">Education</option>
                    <option value="retail">Retail</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="consulting">Consulting</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Company Size
                  </label>
                                     <select
                     value={formData.companySize}
                     onChange={(e) => handleInputChange('companySize', e.target.value as '1-10' | '11-50' | '51-200' | '200+')}
                     className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value="1-10">1-10 employees</option>
                     <option value="11-50">11-50 employees</option>
                     <option value="51-200">51-200 employees</option>
                     <option value="200+">200+ employees</option>
                   </select>
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Business Type
                  </label>
                                     <select
                     value={formData.businessType}
                     onChange={(e) => handleInputChange('businessType', e.target.value as 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship')}
                     className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value="LLC">LLC</option>
                     <option value="Corporation">Corporation</option>
                     <option value="Partnership">Partnership</option>
                     <option value="Sole Proprietorship">Sole Proprietorship</option>
                   </select>
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 text-sm font-medium mb-2">
                    Billing Email *
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter billing email"
                  />
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-blue-300 font-medium mb-3">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => handleInputChange('address.street', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter street address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => handleInputChange('address.city', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter city"
                    />
                  </div>

                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={(e) => handleInputChange('address.country', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter country"
                    />
                  </div>

                  <div>
                    <label className="block text-blue-300 text-sm font-medium mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.address.postalCode}
                      onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter postal code"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-blue-300 hover:text-white transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOrganization}
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4" />
                      <span>Create Organization</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
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
                <span className={`px-2 py-1 text-xs rounded-full ${
                  orgInfo.userRole === 'owner' 
                    ? 'bg-yellow-600/20 text-yellow-300' 
                    : orgInfo.userRole === 'admin'
                    ? 'bg-purple-600/20 text-purple-300'
                    : 'bg-blue-600/20 text-blue-300'
                }`}>
                  {orgInfo.userRole === 'owner' ? 'Owner' : 
                   orgInfo.userRole === 'admin' ? 'Admin' : 
                   orgInfo.userRole === 'member' ? 'Member' : 
                   orgInfo.userRole || 'Unknown'}
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
                <a
                  href="/dashboard/settings/organization/members"
                  className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-1"
                >
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                </a>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm w-full">
              <div>
                <span className="text-blue-300">Industry:</span>
                <span className="text-white ml-2">{orgInfo.organization.industry}</span>
              </div>
              <div>
                <span className="text-blue-300">Company Size:</span>
                <span className="text-white ml-2">
                  {orgInfo.organization.companySize}
                  {orgInfo.organization.memberCount && (
                    <span className="text-blue-200 text-xs ml-1">
                      ({orgInfo.organization.memberCount} members)
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-blue-300">Business Type:</span>
                <span className="text-white ml-2">{orgInfo.organization.businessType}</span>
              </div>
              <div>
                <span className="text-blue-300">Phone:</span>
                <span className="text-white ml-2">{orgInfo.organization.phone}</span>
              </div>
              <div>
                <span className="text-blue-300">Billing Email:</span>
                <span className="text-white ml-2">{orgInfo.organization.billingEmail}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-blue-300">Address:</span>
                <span className="text-white ml-2 break-words">
                  {orgInfo.organization.address.street}, {orgInfo.organization.address.city}, {orgInfo.organization.address.country} {orgInfo.organization.address.postalCode}
                </span>
              </div>
            </div>
          </div>

          {/* Logo Management Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Image className="h-6 w-6 text-blue-400" aria-label="Logo management icon" />
                <h3 className="text-lg font-semibold text-white">Logo Management</h3>
              </div>
            </div>
            <p className="text-blue-200 text-sm mb-6">
              Upload and manage your organization logos for use in invoices and other business documents. 
              You can have multiple logos for different occasions and set one as your default.
            </p>
            <LogoManager 
              onLogoSelectAction={setSelectedLogo}
              selectedLogoId={selectedLogo?.id}
            />

            {selectedLogo && (
              <div className="mt-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-blue-300 font-medium mb-2">Selected Logo:</h3>
                                              <div className="flex items-center space-x-3">
                  <LogoDisplay
                    logoUrl={selectedLogo.url}
                    alt={selectedLogo.name}
                    size={48}
                  />
                  <div>
                    <p className="text-white font-medium">{selectedLogo.name}</p>
                    <p className="text-blue-200 text-sm">
                      {selectedLogo.isDefault ? 'Default Logo' : 'Custom Logo'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <DashboardFloatingButton />
    </div>
  );
} 