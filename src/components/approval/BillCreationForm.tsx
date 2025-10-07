'use client';

import React, { useState } from 'react';
import { Plus, DollarSign, Calendar, FileText, Tag, Building } from 'lucide-react';
import { usePermissions } from '@/lib/contexts/PermissionContext';

interface BillCreationFormProps {
  onSubmit?: (billData: BillData) => void;
  onCancel?: () => void;
}

interface BillData {
  vendor: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  dueDate: string;
  invoiceNumber?: string;
  reference?: string;
}

export function BillCreationForm({ onSubmit, onCancel }: BillCreationFormProps) {
  const { permissions } = usePermissions();
  const [formData, setFormData] = useState<BillData>({
    vendor: '',
    amount: 0,
    currency: 'USD',
    description: '',
    category: '',
    dueDate: '',
    invoiceNumber: '',
    reference: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!permissions.canCreateBills) {
      setError('You do not have permission to create bills');
      return;
    }

    // Validate form
    if (!formData.vendor || !formData.amount || !formData.description || !formData.dueDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the bill
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Call the onSubmit callback if provided
        if (onSubmit) {
          onSubmit(formData);
        }
        
        // Reset form
        setFormData({
          vendor: '',
          amount: 0,
          currency: 'USD',
          description: '',
          category: '',
          dueDate: '',
          invoiceNumber: '',
          reference: ''
        });
      } else {
        throw new Error(data.message || 'Failed to create bill');
      }
    } catch (err) {
      console.error('Error creating bill:', err);
      setError(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!permissions.canCreateBills) {
    return (
      <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-6 text-center">
        <FileText className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-red-300 font-medium mb-2">Access Denied</h3>
        <p className="text-red-200 text-sm">
          You do not have permission to create bills. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Plus className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Create New Bill</h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-600/10 border border-red-500/30 rounded-lg">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Information */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <Building className="h-4 w-4 inline mr-2" />
            Vendor Name *
          </label>
          <input
            type="text"
            name="vendor"
            value={formData.vendor}
            onChange={handleInputChange}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Enter vendor name"
            required
          />
        </div>

        {/* Amount and Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <DollarSign className="h-4 w-4 inline mr-2" />
              Amount *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Currency
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="KES">KES</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <FileText className="h-4 w-4 inline mr-2" />
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Enter bill description"
            rows={3}
            required
          />
        </div>

        {/* Category and Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <Tag className="h-4 w-4 inline mr-2" />
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select category</option>
              <option value="office-supplies">Office Supplies</option>
              <option value="software">Software</option>
              <option value="marketing">Marketing</option>
              <option value="travel">Travel</option>
              <option value="utilities">Utilities</option>
              <option value="professional-services">Professional Services</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <Calendar className="h-4 w-4 inline mr-2" />
              Due Date *
            </label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter invoice number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Reference
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter reference"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{isSubmitting ? 'Creating...' : 'Create Bill'}</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
