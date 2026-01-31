'use client'

import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { ProfileAvatar } from './ProfileAvatar'
import { Mail, Phone, MapPin, Building, Edit, Save, X } from 'lucide-react'
import { motion } from 'framer-motion'

export function UserProfile() {
  const { data: session, update } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    phone: '',
    industry: '',
    address: {
      street: '',
      city: '',
      country: '',
      postalCode: ''
    }
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await update() // Refresh session
        setIsEditing(false)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          Please sign in to view your profile
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <ProfileAvatar
            src={session.user.image}
            alt={session.user.name}
            size="lg"
            type="user"
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {session.user.name}
            </h2>
            <p className="text-gray-600">{session.user.email}</p>
            <div className="flex items-center mt-1">
              <span className={`px-2 py-1 text-xs rounded-full ${
                session.user.userType === 'business' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {session.user.userType === 'business' ? 'Business' : 'Individual'}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isEditing ? <X className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
        </button>
      </div>

      {isEditing ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-gray-600">
            <Mail className="w-5 h-5" />
            <span>{session.user.email}</span>
          </div>
          
          {formData.phone && (
            <div className="flex items-center space-x-3 text-gray-600">
              <Phone className="w-5 h-5" />
              <span>{formData.phone}</span>
            </div>
          )}
          
          {formData.industry && (
            <div className="flex items-center space-x-3 text-gray-600">
              <Building className="w-5 h-5" />
              <span>{formData.industry}</span>
            </div>
          )}
          
          {(formData.address.street || formData.address.city) && (
            <div className="flex items-start space-x-3 text-gray-600">
              <MapPin className="w-5 h-5 mt-0.5" />
              <div>
                {formData.address.street && <div>{formData.address.street}</div>}
                {formData.address.city && (
                  <div>{formData.address.city}, {formData.address.country}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 