'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Clock,
  Calendar,
  Settings,
  Save,
  AlertCircle
} from 'lucide-react';

interface BACnetPoint {
  id: number;
  object_name: string;
  description: string;
  units: string;
  is_writable: boolean;
  point_category: string;
  present_value: string;
  min_value?: number;
  max_value?: number;
}

interface ScheduleAction {
  point_id: number;
  point?: BACnetPoint;
  action_type: string;
  target_value: string;
  priority: number;
  sequence_order: number;
  delay_seconds: number;
}

interface ScheduleTime {
  time_of_day: string;
  days_of_week?: number[];
  days_of_month?: number[];
  months?: number[];
}

export default function CreateSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<BACnetPoint[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Schedule form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleType, setScheduleType] = useState('weekly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [times, setTimes] = useState<ScheduleTime[]>([{
    time_of_day: '08:00',
    days_of_week: [1, 2, 3, 4, 5]
  }]);
  const [actions, setActions] = useState<ScheduleAction[]>([]);

  useEffect(() => {
    fetchPoints();
    fetchTemplates();
  }, [siteId]);

  const fetchPoints = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/bacnet/points?siteId=${siteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch points');
      
      const data = await response.json();
      setPoints(data.filter((p: BACnetPoint) => p.is_writable));
    } catch (error) {
      console.error('Error fetching points:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/templates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const addTime = () => {
    setTimes([...times, {
      time_of_day: '12:00',
      days_of_week: scheduleType === 'weekly' ? [1, 2, 3, 4, 5] : undefined
    }]);
  };

  const removeTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const updateTime = (index: number, field: string, value: any) => {
    const updated = [...times];
    updated[index] = { ...updated[index], [field]: value };
    setTimes(updated);
  };

  const addAction = () => {
    setActions([...actions, {
      point_id: 0,
      action_type: 'write',
      target_value: '',
      priority: 16,
      sequence_order: actions.length,
      delay_seconds: 0
    }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    
    // If point_id changed, update point reference
    if (field === 'point_id') {
      const point = points.find(p => p.id === parseInt(value));
      updated[index].point = point;
    }
    
    setActions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || times.length === 0 || actions.length === 0) {
      alert('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          site_id: parseInt(siteId),
          name,
          description,
          schedule_type: scheduleType,
          start_date: startDate,
          end_date: endDate || null,
          timezone,
          times,
          actions: actions.map((a, idx) => ({
            ...a,
            sequence_order: idx
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to create schedule');
      
      router.push(`/dashboard/sites/${siteId}/schedules`);
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: any) => {
    if (!confirm(`Apply "${template.name}" template?`)) return;
    
    const data = template.template_data;
    setName(data.schedule.name);
    setScheduleType(data.schedule.schedule_type);
    
    // Convert template times
    const templateTimes = data.schedule.times.map((t: any) => ({
      time_of_day: t.time,
      days_of_week: t.days_of_week
    }));
    setTimes(templateTimes);
    
    // Note: Template actions would need to be mapped to actual points
    alert('Template applied. Please configure the control actions for your specific points.');
  };

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/dashboard/sites/${siteId}/schedules`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Schedules
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900">Create Schedule</h1>
        <p className="mt-2 text-gray-600">Set up automated control actions</p>
      </div>

      {templates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Quick Start Templates</h3>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="px-3 py-1 bg-white text-blue-700 rounded-md border border-blue-300 hover:bg-blue-100 text-sm"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Office Hours HVAC"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Type *
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Describe what this schedule does..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Schedule Times */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Schedule Times</h2>
            <button
              type="button"
              onClick={addTime}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-5 w-5" />
              Add Time
            </button>
          </div>
          
          <div className="space-y-3">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="h-5 w-5 text-gray-400" />
                
                <input
                  type="time"
                  value={time.time_of_day}
                  onChange={(e) => updateTime(index, 'time_of_day', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                
                {scheduleType === 'weekly' && (
                  <div className="flex gap-1">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const days = time.days_of_week || [];
                          const updated = days.includes(day.value)
                            ? days.filter(d => d !== day.value)
                            : [...days, day.value];
                          updateTime(index, 'days_of_week', updated);
                        }}
                        className={`px-2 py-1 text-xs rounded ${
                          time.days_of_week?.includes(day.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => removeTime(index)}
                  className="ml-auto text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Control Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Control Actions</h2>
            <button
              type="button"
              onClick={addAction}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-5 w-5" />
              Add Action
            </button>
          </div>
          
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Control Point
                    </label>
                    <select
                      value={action.point_id}
                      onChange={(e) => updateAction(index, 'point_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a point...</option>
                      {points.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.object_name} - {point.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Action Type
                    </label>
                    <select
                      value={action.action_type}
                      onChange={(e) => updateAction(index, 'action_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="write">Write</option>
                      <option value="release">Release</option>
                    </select>
                  </div>
                  
                  {action.action_type === 'write' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Target Value
                        </label>
                        <input
                          type="text"
                          value={action.target_value}
                          onChange={(e) => updateAction(index, 'target_value', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={action.point?.units || 'Value'}
                          required
                        />
                        {action.point && (action.point.min_value !== undefined || action.point.max_value !== undefined) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Range: {action.point.min_value ?? '-∞'} to {action.point.max_value ?? '∞'}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Priority
                        </label>
                        <input
                          type="number"
                          value={action.priority}
                          onChange={(e) => updateAction(index, 'priority', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="1"
                          max="16"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delay (seconds)
                    </label>
                    <input
                      type="number"
                      value={action.delay_seconds}
                      onChange={(e) => updateAction(index, 'delay_seconds', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="mt-3 text-red-600 hover:text-red-700 text-sm"
                >
                  Remove Action
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/sites/${siteId}/schedules`)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {loading ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}