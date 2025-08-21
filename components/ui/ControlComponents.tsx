'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, X, Info, Lock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';

// Confirmation modal
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default',
  requireConfirmation = false,
  confirmationText = ''
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
  requireConfirmation?: boolean;
  confirmationText?: string;
}) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireConfirmation && confirmInput !== confirmationText) {
      toast.error(`Please type "${confirmationText}" to confirm`);
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
      setConfirmInput('');
    }
  };

  const typeStyles = {
    default: {
      icon: <Info className="h-6 w-6 text-blue-600" />,
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    danger: {
      icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    }
  };

  const style = typeStyles[type];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10">
                {style.icon}
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">{message}</p>
                </div>
                {requireConfirmation && (
                  <div className="mt-4">
                    <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">
                      Type <span className="font-mono bg-gray-100 px-1">{confirmationText}</span> to confirm
                    </label>
                    <input
                      type="text"
                      id="confirmation"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder={confirmationText}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || (requireConfirmation && confirmInput !== confirmationText)}
              className={`inline-flex w-full justify-center rounded-md px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${style.button}`}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Value input with validation
export function ValidatedInput({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  unit,
  required = false,
  error,
  helpText,
  disabled = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === 'number' ? parseFloat(e.target.value) : e.target.value;
    onChange(newValue);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type={type}
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          required={required}
          disabled={disabled}
          className={`block w-full rounded-md shadow-sm sm:text-sm ${
            error
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {unit && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">{unit}</span>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
      {type === 'number' && (min !== undefined || max !== undefined) && (
        <p className="mt-1 text-xs text-gray-500">
          {min !== undefined && `Min: ${min}`}
          {min !== undefined && max !== undefined && ' | '}
          {max !== undefined && `Max: ${max}`}
        </p>
      )}
    </div>
  );
}

// Control point card with safety features
export function ControlPointCard({
  point,
  onControl,
  disabled = false
}: {
  point: {
    id: number;
    name: string;
    description?: string;
    currentValue: number | string | boolean;
    unit?: string;
    minValue?: number;
    maxValue?: number;
    isWritable: boolean;
    priority?: number;
    status?: 'online' | 'offline' | 'error';
  };
  onControl: (value: number | string | boolean, priority: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newValue, setNewValue] = useState(point.currentValue);
  const [priority, setPriority] = useState(point.priority || 10);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateValue = () => {
    if (typeof newValue === 'number') {
      if (point.minValue !== undefined && newValue < point.minValue) {
        return `Value must be at least ${point.minValue}`;
      }
      if (point.maxValue !== undefined && newValue > point.maxValue) {
        return `Value must be at most ${point.maxValue}`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateValue();
    if (validationError) {
      setError(validationError);
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onControl(newValue, priority);
      toast.success(`Control command sent for ${point.name}`);
      setIsEditing(false);
      setShowConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Control command failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    online: 'bg-green-100 text-green-800',
    offline: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800'
  };

  return (
    <>
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {point.name}
              </h3>
              {point.description && (
                <p className="mt-1 text-sm text-gray-500">{point.description}</p>
              )}
              
              <div className="mt-3 flex items-center space-x-4">
                <div>
                  <span className="text-sm text-gray-500">Current Value:</span>
                  <span className="ml-2 text-lg font-semibold">
                    {typeof point.currentValue === 'boolean'
                      ? point.currentValue ? 'ON' : 'OFF'
                      : point.currentValue}
                    {point.unit && ` ${point.unit}`}
                  </span>
                </div>
                {point.status && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[point.status]}`}>
                    {point.status}
                  </span>
                )}
              </div>

              {isEditing && (
                <div className="mt-4 space-y-4">
                  {typeof point.currentValue === 'boolean' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Value</label>
                      <div className="mt-1 flex space-x-4">
                        <button
                          onClick={() => setNewValue(true)}
                          className={`px-4 py-2 rounded-md ${
                            newValue === true
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          onClick={() => setNewValue(false)}
                          className={`px-4 py-2 rounded-md ${
                            newValue === false
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ValidatedInput
                      label="New Value"
                      value={newValue as string | number}
                      onChange={setNewValue}
                      type="number"
                      min={point.minValue}
                      max={point.maxValue}
                      unit={point.unit}
                      required
                      error={error || undefined}
                    />
                  )}
                  
                  <ValidatedInput
                    label="Priority (1-16)"
                    value={priority}
                    onChange={(v) => setPriority(Number(v))}
                    type="number"
                    min={1}
                    max={16}
                    helpText="Lower values have higher priority"
                  />

                  <div className="flex space-x-3">
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send Command'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setNewValue(point.currentValue);
                        setError(null);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="ml-4">
              {point.isWritable && !disabled ? (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`p-2 rounded-md ${
                    isEditing
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {isEditing ? <X className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                </button>
              ) : (
                <div className="p-2 rounded-md bg-gray-100 text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Confirm Control Command"
        message={`Are you sure you want to change ${point.name} from ${point.currentValue}${point.unit ? ` ${point.unit}` : ''} to ${newValue}${point.unit ? ` ${point.unit}` : ''} with priority ${priority}?`}
        type="warning"
        confirmText="Send Command"
      />
    </>
  );
}