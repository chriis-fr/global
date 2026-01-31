'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Edit, 
  Trash2, 
  UserPlus,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  ChevronDown,
  Lock
} from 'lucide-react';
import { countries } from '@/data/countries';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';

interface Client {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Loading Skeleton Component
function ClientsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header Skeleton */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
              <div className="w-16 h-10 bg-white/20 rounded-lg animate-pulse"></div>
              <div className="flex-1 sm:flex-none">
                <div className="w-48 h-8 bg-white/20 rounded-lg animate-pulse mb-2"></div>
                <div className="w-64 h-4 bg-white/20 rounded-lg animate-pulse"></div>
              </div>
            </div>
            <div className="w-full sm:w-40 h-12 bg-white/20 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Search Skeleton */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="w-full h-12 bg-white/20 rounded-lg animate-pulse"></div>
        </div>

        {/* Clients Grid Skeleton */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="w-32 h-6 bg-white/20 rounded-lg animate-pulse"></div>
            <div className="w-48 h-4 bg-white/20 rounded-lg animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-white/20 rounded-full animate-pulse flex-shrink-0"></div>
                    <div className="min-w-0 flex-1">
                      <div className="w-24 h-5 bg-white/20 rounded-lg animate-pulse mb-2"></div>
                      <div className="w-32 h-4 bg-white/20 rounded-lg animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg animate-pulse"></div>
                    <div className="w-8 h-8 bg-white/20 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-white/20 rounded animate-pulse"></div>
                    <div className="w-40 h-4 bg-white/20 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-white/20 rounded animate-pulse"></div>
                    <div className="w-32 h-4 bg-white/20 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-4 h-4 bg-white/20 rounded animate-pulse mt-0.5"></div>
                    <div className="w-48 h-4 bg-white/20 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { subscription } = useSubscription();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    taxId: '',
    notes: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Check if user can add more clients (3 client limit for free plan)
  const canAddClient = subscription?.plan?.planId === 'receivables-free' 
    ? clients.length < 3 
    : true;

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clients');
      const result = await response.json();
      
      if (result.success) {
        setClients(result.data || []);
      } else {
        console.error('❌ [Clients] Failed to fetch clients:', result.message);
      }
    } catch (error) {
      console.error('❌ [Clients] Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchClients();
    }
  }, [session?.user?.email, fetchClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check client limit before submitting
    if (!canAddClient && !editingClient) {
      alert('You have reached your client limit of 3 on the free plan. Please upgrade to add more clients.');
      return;
    }
    
    try {
      const url = editingClient ? `/api/clients/${editingClient._id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      
      // Convert structured address to string format for API
      const clientData = {
        ...formData,
        address: `${formData.address.street}, ${formData.address.city}, ${formData.address.state} ${formData.address.zipCode}, ${formData.address.country}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '')
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      const result = await response.json();
      
      if (result.success) {
        setShowAddModal(false);
        setEditingClient(null);
        resetForm();
        fetchClients();
      } else {
        console.error('❌ [Clients] Failed to save client:', result.message);
        alert(result.message || 'Failed to save client');
      }
    } catch (error) {
      console.error('❌ [Clients] Error saving client:', error);
      alert('Failed to save client');
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client?')) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        fetchClients();
      } else {
        console.error('❌ [Clients] Failed to delete client:', result.message);
        alert(result.message || 'Failed to delete client');
      }
    } catch (error) {
      console.error('❌ [Clients] Error deleting client:', error);
      alert('Failed to delete client');
    }
  };

  const handleEdit = (client: Client) => {
    // Parse the address string to extract components
    let street = client.address || '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = '';

    if (client.address) {
      const addressParts = client.address.split(',').map(part => part.trim());
      if (addressParts.length >= 4) {
        street = addressParts[0];
        city = addressParts[1];
        const stateZip = addressParts[2].split(' ');
        if (stateZip.length >= 2) {
          state = stateZip.slice(0, -1).join(' ');
          zipCode = stateZip[stateZip.length - 1];
        } else {
          state = addressParts[2];
        }
        country = addressParts[3];
      } else if (addressParts.length === 3) {
        street = addressParts[0];
        city = addressParts[1];
        const stateZip = addressParts[2].split(' ');
        if (stateZip.length >= 2) {
          state = stateZip.slice(0, -1).join(' ');
          zipCode = stateZip[stateZip.length - 1];
        } else {
          state = addressParts[2];
        }
      } else if (addressParts.length === 2) {
        street = addressParts[0];
        city = addressParts[1];
      }
    }

    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      address: {
        street,
        city,
        state,
        zipCode,
        country
      },
      company: client.company || '',
      taxId: client.taxId || '',
      notes: client.notes || ''
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      company: '',
      taxId: '',
      notes: ''
    });
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.company && client.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Show loading skeleton
  if (loading) {
    return <ClientsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br ">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="flex-1 sm:flex-none">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Client Management</h1>
                <p className="text-blue-200 mt-1 text-sm sm:text-base">Add, edit, and organize your client information</p>
                {subscription?.plan?.planId === 'receivables-free' && (
                  <p className="text-blue-300 text-xs mt-1">
                    {clients.length}/3 clients used
                  </p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                if (!canAddClient) {
                  alert('You have reached your client limit of 3 on the free plan. Please upgrade to add more clients.');
                  return;
                }
                setEditingClient(null);
                resetForm();
                setShowAddModal(true);
              }}
              disabled={!canAddClient}
              className={`flex items-center space-x-2 px-4 py-2 sm:px-6 sm:py-3 rounded-lg transition-colors shadow-sm font-medium w-full sm:w-auto justify-center ${
                canAddClient
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              {canAddClient ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Add New Client</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Limit Reached</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-blue-300" />
            <input
              type="text"
              placeholder="Search clients by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-white placeholder-blue-200 text-sm sm:text-base font-medium"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
            <h2 className="text-lg sm:text-xl font-semibold text-white">
              {filteredClients.length > 0 
                ? `${filteredClients.length} client${filteredClients.length === 1 ? '' : 's'}`
                : 'No clients'
              }
            </h2>
            {filteredClients.length > 0 && (
              <div className="text-xs sm:text-sm text-blue-300">
                Click edit or delete icons to manage clients
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <div key={client._id} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 sm:p-6 hover:bg-white/10 transition-all">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                        <span className="text-base sm:text-lg font-bold text-white">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white text-base sm:text-lg truncate">{client.name}</h3>
                        {client.company && (
                          <p className="text-xs sm:text-sm text-blue-200 font-medium truncate">{client.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="p-1.5 sm:p-2 text-blue-300 hover:text-blue-200 hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit client"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client._id)}
                        className="p-1.5 sm:p-2 text-blue-300 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300 flex-shrink-0" />
                      <span className="text-white font-medium truncate">{client.email}</span>
                    </div>
                    
                    {client.phone && (
                      <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300 flex-shrink-0" />
                        <span className="text-white font-medium truncate">{client.phone}</span>
                      </div>
                    )}
                    
                    {client.address && (
                      <div className="flex items-start space-x-2 sm:space-x-3 text-xs sm:text-sm">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300 flex-shrink-0 mt-0.5" />
                        <span className="text-white font-medium line-clamp-2">{client.address}</span>
                      </div>
                    )}
                    
                    {client.notes && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                        <p className="text-xs sm:text-sm text-blue-200 italic line-clamp-2">&quot;{client.notes}&quot;</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 sm:py-16">
                <div className="bg-white/10 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <UserPlus className="h-8 w-8 sm:h-10 sm:w-10 text-blue-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-3">
                  {searchTerm ? 'No clients found' : 'No clients yet'}
                </h3>
                <p className="text-blue-200 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base px-4">
                  {searchTerm 
                    ? "Try adjusting your search terms or add a new client"
                    : "Start by adding your first client to manage their information and create invoices"
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => {
                      if (!canAddClient) {
                        alert('You have reached your client limit of 3 on the free plan. Please upgrade to add more clients.');
                        return;
                      }
                      setEditingClient(null);
                      resetForm();
                      setShowAddModal(true);
                    }}
                    disabled={!canAddClient}
                    className={`py-2 px-6 sm:py-3 sm:px-8 rounded-lg font-medium transition-colors shadow-sm text-sm sm:text-base ${
                      canAddClient
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {canAddClient ? 'Add Your First Client' : 'Limit Reached'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
              <div className="p-4 sm:p-8">
                <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      {editingClient ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <p className="text-gray-600 text-sm sm:text-base">
                      {editingClient ? 'Update client information' : 'Add a new client to your database'}
                    </p>
                  </div>
                </div>
              
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Enter client name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="client@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Company name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address.street}
                      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                      placeholder="Enter street address"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.address.state}
                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Enter state"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={formData.address.zipCode}
                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, zipCode: e.target.value } })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Enter ZIP code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Country
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between bg-white"
                        >
                          <span className={formData.address.country ? 'text-gray-900' : 'text-gray-500'}>
                            {formData.address.country 
                              ? countries.find(c => c.code === formData.address.country)?.name 
                              : 'Select Country'}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg max-h-60 overflow-y-auto z-20 shadow-lg">
                            <div className="p-2 border-b border-gray-200 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  placeholder="Search countries..."
                                  className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded text-black placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                              </div>
                            </div>
                            
                            <div className="max-h-48 overflow-y-auto">
                              {countries
                                .filter(country => 
                                  country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                  country.phoneCode.includes(countrySearch) ||
                                  country.code.toLowerCase().includes(countrySearch.toLowerCase())
                                )
                                .map(country => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, address: { ...formData.address, country: country.code } });
                                    setShowCountryDropdown(false);
                                    setCountrySearch('');
                                  }}
                                  className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="text-sm">{country.name}</span>
                                  <span className="text-blue-600 text-xs font-medium">{country.phoneCode}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tax ID
                      </label>
                      <input
                        type="text"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Tax identification number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-600 text-sm sm:text-base font-medium"
                        placeholder="Additional notes about the client"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-4 pt-4 sm:pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingClient(null);
                        resetForm();
                      }}
                      className="px-4 py-2 sm:px-6 sm:py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm text-sm sm:text-base"
                    >
                      {editingClient ? 'Update Client' : 'Add Client'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 