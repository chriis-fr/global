'use client';
import { useState, useEffect } from 'react';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
}

export default function ProfileSettingsPage() {
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/settings');
      const data = await response.json();
      
      if (data.success) {
        setFormData(data.data.profile);
      } else {
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'profile',
          data: formData
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-blue-200">Manage your personal information and account settings.</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded mb-4"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
            <div className="h-10 bg-white/20 rounded mb-6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Profile Settings</h1>
        <p className="text-blue-200">Manage your personal information and account settings.</p>
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
      
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Personal Information</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter your email"
                required
                disabled
              />
              <p className="text-xs text-blue-200 mt-1">Email cannot be changed</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter your phone number"
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 