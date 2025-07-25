'use client';
import { useState, useEffect } from 'react';

interface NotificationSettings {
  email: boolean;
  sms: boolean;
  payments: boolean;
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    sms: false,
    payments: true,
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
        // Use default settings if none exist in database
        const userSettings = data.data.settings?.notifications || {};
        setSettings({
          email: userSettings.email ?? true,
          sms: userSettings.sms ?? false,
          payments: userSettings.payments ?? true,
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to load notification settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load notification settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = (key: keyof NotificationSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
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
          type: 'notifications',
          data: {
            notifications: settings
          }
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Notification preferences updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update notification preferences' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update notification preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Notification Settings</h1>
          <p className="text-blue-200">Manage your notification preferences and communication settings.</p>
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
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Notification Settings</h1>
        <p className="text-blue-200">Manage your notification preferences and communication settings.</p>
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
        <h2 className="text-xl font-semibold text-white mb-6">Notification Preferences</h2>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Email Notifications</h3>
                <p className="text-blue-200 text-sm">Receive notifications via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.email}
                  onChange={() => handleToggleChange('email')}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">SMS Notifications</h3>
                <p className="text-blue-200 text-sm">Receive notifications via SMS</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.sms}
                  onChange={() => handleToggleChange('sms')}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Payment Notifications</h3>
                <p className="text-blue-200 text-sm">Get notified about payment activities</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.payments}
                  onChange={() => handleToggleChange('payments')}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          
          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 