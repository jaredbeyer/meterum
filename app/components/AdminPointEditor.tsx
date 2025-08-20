'use client';

import { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';

interface BACnetPoint {
  id: number;
  object_name: string;
  display_name?: string;
  description: string;
  units: string;
  present_value: string;
  is_writable: boolean;
  point_category: string;
}

interface AdminPointEditorProps {
  point: BACnetPoint;
  isAdmin: boolean;
  onUpdate?: (pointId: number, displayName: string) => void;
}

export default function AdminPointEditor({ point, isAdmin, onUpdate }: AdminPointEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(point.display_name || point.object_name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName || displayName === point.display_name) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/bacnet-points/${point.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: displayName })
      });

      if (!response.ok) throw new Error('Failed to update');

      const result = await response.json();
      
      // Update local state
      point.display_name = displayName;
      
      // Notify parent component
      if (onUpdate) {
        onUpdate(point.id, displayName);
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update display name:', error);
      alert('Failed to update display name');
      setDisplayName(point.display_name || point.object_name);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(point.display_name || point.object_name);
    setIsEditing(false);
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Display name"
              disabled={saving}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
              title="Save"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div>
              <h4 className="font-medium text-sm text-gray-900">
                {point.display_name || point.object_name}
              </h4>
              {point.display_name && point.display_name !== point.object_name && (
                <p className="text-xs text-gray-500">({point.object_name})</p>
              )}
              <p className="text-xs text-gray-500">{point.description}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Edit display name"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {point.is_writable && (
        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">
          Control
        </span>
      )}
    </div>
  );
}