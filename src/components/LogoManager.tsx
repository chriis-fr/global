'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Upload, 
  Edit, 
  Trash2, 
  Star, 
  StarOff, 
  Plus,
  X,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

interface LogoManagerProps {
  onLogoSelectAction?: (logo: Logo) => void;
  selectedLogoId?: string;
  className?: string;
}

export function LogoManager({ onLogoSelectAction, selectedLogoId, className = '' }: LogoManagerProps) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingLogo, setEditingLogo] = useState<Logo | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    file: null as File | null
  });
  const [editForm, setEditForm] = useState({
    name: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const fetchLogos = useCallback(async () => {
    try {
      const response = await fetch('/api/user/logos');
      const data = await response.json();
      
      if (data.success) {
        setLogos(data.logos || []);
      } else {
        setMessage({ type: 'error', text: 'Failed to load logos' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load logos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select a valid image file' });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File size too large. Maximum 5MB allowed' });
        return;
      }

      setUploadForm(prev => ({ ...prev, file }));
      setMessage(null); // Clear any previous messages
    }
  };



  const handleUpload = async () => {
    if (!uploadForm.name || !uploadForm.file) {
      setMessage({ type: 'error', text: 'Please provide a name and select a file' });
      return;
    }

    setUploading(true);
    try {
      // Upload the file first
      const formData = new FormData();
      formData.append('logo', uploadForm.file);
      
      const uploadResponse = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
      });
      
      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Save the logo with the uploaded URL
      const saveResponse = await fetch('/api/user/logos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uploadForm.name,
          url: uploadResult.logoUrl,
          isDefault: logos.length === 0 // Set as default if it's the first logo
        }),
      });

      const saveResult = await saveResponse.json();
      
      if (saveResult.success) {
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
        setShowUploadForm(false);
        setUploadForm({ name: '', file: null });
        await fetchLogos();
      } else {
        throw new Error(saveResult.error || 'Failed to save logo');
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingLogo || !editForm.name) {
      setMessage({ type: 'error', text: 'Please provide a name' });
      return;
    }

    try {
      const response = await fetch('/api/user/logos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingLogo.id,
          name: editForm.name
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Logo updated successfully!' });
        setEditingLogo(null);
        setEditForm({ name: '' });
        await fetchLogos();
      } else {
        throw new Error(result.error || 'Failed to update logo');
      }
    } catch {
      setMessage({ type: 'error', text: 'Update failed' });
    }
  };

  const handleDelete = async (logoId: string) => {
    if (!confirm('Are you sure you want to delete this logo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/logos?id=${logoId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Logo deleted successfully!' });
        await fetchLogos();
      } else {
        throw new Error(result.error || 'Failed to delete logo');
      }
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  const handleSetDefault = async (logoId: string) => {
    try {
      const response = await fetch('/api/user/logos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: logoId,
          isDefault: true
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Default logo updated!' });
        await fetchLogos();
      } else {
        throw new Error(result.error || 'Failed to update default logo');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to set default' });
    }
  };

  const handleLogoClick = (logo: Logo) => {
    if (onLogoSelectAction) {
      onLogoSelectAction(logo);
    }
  };

  const handleImageError = (logoId: string) => {
    setImageErrors(prev => new Set(prev).add(logoId));
  };

  const handleImageLoad = (logoId: string) => {
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(logoId);
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading logos...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {message && (
        <div className={`p-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Upload New Logo</h3>
            <button
              onClick={() => setShowUploadForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo Name
              </label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                placeholder="Enter logo name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo File
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white font-medium"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: PNG, JPG, JPEG, GIF. Max size: 5MB
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadForm.name || !uploadForm.file}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {logos.map((logo) => (
          <div
            key={logo.id}
            className={`relative bg-white border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedLogoId === logo.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleLogoClick(logo)}
          >
            {/* Default Badge */}
            {logo.isDefault && (
              <div className="absolute top-2 right-2">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              </div>
            )}

            {/* Logo Image */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                {imageErrors.has(logo.id) ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <AlertCircle className="h-6 w-6 text-gray-400" />
                  </div>
                ) : (
                  <Image
                    src={logo.url}
                    alt={logo.name}
                    width={64}
                    height={64}
                    className="object-contain w-full h-full"
                    onError={() => handleImageError(logo.id)}
                    onLoad={() => handleImageLoad(logo.id)}
                    unoptimized={logo.url.startsWith('data:')}
                    style={{ backgroundColor: 'white' }}
                  />
                )}
              </div>
            </div>

            {/* Logo Name */}
            <div className="text-center mb-3">
              <h4 className="font-medium text-gray-900 truncate">{logo.name}</h4>
              <p className="text-xs text-gray-500">
                {new Date(logo.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-center space-x-2">
              {!logo.isDefault && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetDefault(logo.id);
                  }}
                  className="p-1 text-gray-400 hover:text-yellow-500"
                  title="Set as default"
                >
                  <StarOff className="h-4 w-4" />
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingLogo(logo);
                  setEditForm({ name: logo.name });
                }}
                className="p-1 text-gray-400 hover:text-blue-500"
                title="Edit logo"
              >
                <Edit className="h-4 w-4" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(logo.id);
                }}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Delete logo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add New Logo Button */}
        <button
          onClick={() => setShowUploadForm(true)}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center"
        >
          <Plus className="h-8 w-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-600">Add New Logo</span>
        </button>
      </div>

      {/* Edit Modal */}
      {editingLogo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Edit Logo</h3>
              <button
                onClick={() => setEditingLogo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setEditingLogo(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!editForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 