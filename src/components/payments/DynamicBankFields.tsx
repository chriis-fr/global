'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface DynamicBankFieldsProps {
  fields: Record<string, string>;
  onFieldsChange: (fields: Record<string, string>) => void;
}

const PREDEFINED_FIELDS = [
  'Bank Address',
  'Account Holder',
  'Routing Number',
  'Beneficiary Name'
];

export default function DynamicBankFields({ fields, onFieldsChange }: DynamicBankFieldsProps) {
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  const availableFields = PREDEFINED_FIELDS.filter(field => !fields[field]);

  const addPredefinedField = (fieldName: string) => {
    onFieldsChange({
      ...fields,
      [fieldName]: ''
    });
    setShowFieldSelector(false);
  };

  const addCustomField = () => {
    if (newFieldName.trim() && newFieldValue.trim()) {
      onFieldsChange({
        ...fields,
        [newFieldName.trim()]: newFieldValue.trim()
      });
      setNewFieldName('');
      setNewFieldValue('');
      setShowAddField(false);
    }
  };

  const updateField = (fieldName: string, value: string) => {
    onFieldsChange({
      ...fields,
      [fieldName]: value
    });
  };

  const removeField = (fieldName: string) => {
    const newFields = { ...fields };
    delete newFields[fieldName];
    onFieldsChange(newFields);
  };

  return (
    <div className="space-y-3">
      {/* Existing fields */}
      {Object.entries(fields).map(([fieldName, value]) => (
        <div key={fieldName} className="flex items-start gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{fieldName}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => updateField(fieldName, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium text-sm"
              placeholder={`Enter ${fieldName.toLowerCase()}`}
            />
          </div>
          <button
            type="button"
            onClick={() => removeField(fieldName)}
            className="mt-5 p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove field"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Add field section */}
      <div className="pt-2 border-t border-gray-200">
        {!showAddField && !showFieldSelector && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFieldSelector(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Select Field
            </button>
            <button
              type="button"
              onClick={() => setShowAddField(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Custom Field
            </button>
          </div>
        )}

        {/* Predefined field selector */}
        {showFieldSelector && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Select a field:</span>
              <button
                type="button"
                onClick={() => setShowFieldSelector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {availableFields.length > 0 ? (
              <div className="space-y-1">
                {availableFields.map((fieldName) => (
                  <button
                    key={fieldName}
                    type="button"
                    onClick={() => addPredefinedField(fieldName)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-md transition-colors"
                  >
                    {fieldName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">All predefined fields are added</p>
            )}
          </div>
        )}

        {/* Custom field input */}
        {showAddField && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Add custom field:</span>
              <button
                type="button"
                onClick={() => {
                  setShowAddField(false);
                  setNewFieldName('');
                  setNewFieldValue('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium text-sm"
                placeholder="Field name (e.g., IBAN, Sort Code)"
              />
              <input
                type="text"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-600 bg-white font-medium text-sm"
                placeholder="Field value"
              />
              <button
                type="button"
                onClick={addCustomField}
                disabled={!newFieldName.trim() || !newFieldValue.trim()}
                className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Field
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

