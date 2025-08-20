'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Clock, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  Play, 
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Settings
} from 'lucide-react';

interface Schedule {
  id: number;
  name: string;
  description: string;
  schedule_type: string;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  timezone: string;
  next_execution?: string;
  last_execution?: any;
  schedule_times: any[];
  schedule_actions: any[];
}

export default function SchedulesPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, [siteId]);

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules?siteId=${siteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch schedules');
      
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (scheduleId: number, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: scheduleId,
          is_active: !isActive
        })
      });

      if (!response.ok) throw new Error('Failed to toggle schedule');
      
      await fetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const executeSchedule = async (scheduleId: number) => {
    if (!confirm('Execute this schedule now?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduleId,
          isManual: true
        })
      });

      if (!response.ok) throw new Error('Failed to execute schedule');
      
      const result = await response.json();
      alert(`Schedule executed: ${result.actions_executed} actions completed, ${result.actions_failed} failed`);
      
      await fetchSchedules();
    } catch (error) {
      console.error('Error executing schedule:', error);
      alert('Failed to execute schedule');
    }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules?id=${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete schedule');
      
      await fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDaysOfWeek = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const getScheduleTypeIcon = (type: string) => {
    switch (type) {
      case 'once': return '📍';
      case 'daily': return '📅';
      case 'weekly': return '📆';
      case 'monthly': return '🗓️';
      default: return '⏰';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'partial': return 'text-yellow-600';
      case 'running': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Schedules</h1>
            <p className="mt-2 text-gray-600">Automate BACnet control actions</p>
            <div className="mt-2 space-x-4">
              <button
                onClick={() => router.push(`/dashboard/sites/${siteId}/control`)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                ← Back to Control System
              </button>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/sites/${siteId}/schedules/create`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Create Schedule
          </button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedules Yet</h3>
          <p className="text-gray-600 mb-4">Create your first schedule to automate control actions</p>
          <button
            onClick={() => router.push(`/dashboard/sites/${siteId}/schedules/create`)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Create Schedule
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getScheduleTypeIcon(schedule.schedule_type)}</span>
                    <h3 className="text-xl font-semibold text-gray-900">{schedule.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      schedule.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {schedule.description && (
                    <p className="text-gray-600 mb-3">{schedule.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-sm text-gray-500">Schedule Type:</span>
                      <p className="font-medium capitalize">{schedule.schedule_type}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Time Zone:</span>
                      <p className="font-medium">{schedule.timezone}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Actions:</span>
                      <p className="font-medium">{schedule.schedule_actions.length} points</p>
                    </div>
                  </div>

                  {schedule.schedule_times.length > 0 && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-500">Schedule Times:</span>
                      <div className="mt-1 space-y-1">
                        {schedule.schedule_times.map((time, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{formatTime(time.time_of_day)}</span>
                            {time.days_of_week && (
                              <span className="ml-2 text-gray-600">
                                ({formatDaysOfWeek(time.days_of_week)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {schedule.next_execution && (
                      <div>
                        <span className="text-sm text-gray-500">Next Execution:</span>
                        <p className="font-medium text-blue-600">
                          {new Date(schedule.next_execution).toLocaleString('en-US', {
                            timeZone: 'America/Chicago',
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                    )}
                    {schedule.last_execution && (
                      <div>
                        <span className="text-sm text-gray-500">Last Execution:</span>
                        <p className={`font-medium ${getStatusColor(schedule.last_execution.status)}`}>
                          {new Date(schedule.last_execution.execution_time).toLocaleString('en-US', {
                            timeZone: 'America/Chicago',
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                          {schedule.last_execution.status === 'completed' && (
                            <CheckCircle className="inline-block ml-1 h-4 w-4" />
                          )}
                          {schedule.last_execution.status === 'failed' && (
                            <XCircle className="inline-block ml-1 h-4 w-4" />
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleSchedule(schedule.id, schedule.is_active)}
                    className={`p-2 rounded-lg ${
                      schedule.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={schedule.is_active ? 'Pause Schedule' : 'Activate Schedule'}
                  >
                    {schedule.is_active ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => executeSchedule(schedule.id)}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="Execute Now"
                  >
                    <Play className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/sites/${siteId}/schedules/${schedule.id}/edit`)}
                    className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    title="Edit Schedule"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    title="Delete Schedule"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}