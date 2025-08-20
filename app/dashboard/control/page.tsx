'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface BACnetDevice {
  id: number;
  device_instance: number;
  device_name: string;
  vendor_name: string;
  model_name: string;
  device_type: string;
  ip_address: string;
  is_online: boolean;
  last_seen: string;
  bacnet_points?: BACnetPoint[];
}

interface BACnetPoint {
  id: number;
  object_type: number;
  object_instance: number;
  object_name: string;
  description: string;
  present_value: string;
  units: string;
  is_writable: boolean;
  point_type: string;
  point_category: string;
  min_value?: number;
  max_value?: number;
}

export default function ControlPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [devices, setDevices] = useState<BACnetDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BACnetDevice | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<BACnetPoint | null>(null);
  const [controlValue, setControlValue] = useState('');
  const [priority, setPriority] = useState(10);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    totalPoints: 0,
    writablePoints: 0
  });

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      router.push('/login');
      return;
    }
    fetchDevices();
  }, [router]);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/bacnet/discover?nodeId=1', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        setStats(data.stats || {
          totalDevices: 0,
          onlineDevices: 0,
          totalPoints: 0,
          writablePoints: 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const startDiscovery = async () => {
    setDiscovering(true);
    try {
      const response = await fetch('/api/bacnet/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          nodeId: 1, // TODO: Get actual node ID
          scanOptions: {
            lowLimit: 0,
            highLimit: 4194303,
            timeout: 30000
          }
        })
      });

      if (response.ok) {
        toast.success('Discovery started. This may take a few minutes...');
        // Poll for results
        setTimeout(fetchDevices, 5000);
        setTimeout(fetchDevices, 15000);
        setTimeout(fetchDevices, 30000);
      } else {
        toast.error('Failed to start discovery');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast.error('Discovery failed');
    } finally {
      setTimeout(() => setDiscovering(false), 30000);
    }
  };

  const writePoint = async () => {
    if (!selectedPoint || !controlValue) {
      toast.error('Please select a point and enter a value');
      return;
    }

    try {
      const response = await fetch('/api/bacnet/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          pointId: selectedPoint.id,
          value: controlValue,
          priority: priority
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Command sent: ${data.point.name} → ${controlValue}`);
        setControlValue('');
        // Refresh point value after a moment
        setTimeout(fetchDevices, 2000);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send command');
      }
    } catch (error) {
      console.error('Control error:', error);
      toast.error('Failed to send control command');
    }
  };

  const releasePoint = async () => {
    if (!selectedPoint) {
      toast.error('Please select a point');
      return;
    }

    try {
      const response = await fetch('/api/bacnet/control', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          pointId: selectedPoint.id,
          priority: priority
        })
      });

      if (response.ok) {
        toast.success(`Released control of ${selectedPoint.object_name}`);
        setTimeout(fetchDevices, 2000);
      } else {
        toast.error('Failed to release control');
      }
    } catch (error) {
      console.error('Release error:', error);
      toast.error('Failed to release control');
    }
  };

  const getObjectTypeName = (type: number) => {
    const types: { [key: number]: string } = {
      0: 'AI', 1: 'AO', 2: 'AV',
      3: 'BI', 4: 'BO', 5: 'BV',
      13: 'MSI', 14: 'MSO', 19: 'MSV'
    };
    return types[type] || `Type ${type}`;
  };

  const getPointIcon = (category: string) => {
    switch (category) {
      case 'HVAC': return '🌡️';
      case 'Lighting': return '💡';
      case 'Energy': return '⚡';
      case 'Security': return '🔒';
      default: return '📊';
    }
  };

  const filteredDevices = filter === 'all' ? devices : 
    devices.filter(d => d.bacnet_points?.some(p => p.point_category === filter));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading control system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Building Control System</h1>
              <p className="text-sm text-gray-500">BACnet Device Discovery & Control</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex space-x-6 text-sm">
              <span>Devices: <strong>{stats.totalDevices}</strong></span>
              <span>Online: <strong>{stats.onlineDevices}</strong></span>
              <span>Points: <strong>{stats.totalPoints}</strong></span>
              <span>Writable: <strong>{stats.writablePoints}</strong></span>
            </div>
            <button
              onClick={startDiscovery}
              disabled={discovering}
              className={`px-4 py-1 rounded-md text-sm font-medium transition ${
                discovering 
                  ? 'bg-blue-500 cursor-not-allowed' 
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              {discovering ? 'Discovering...' : '🔍 Discover Devices'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Device List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b">
                <h2 className="text-lg font-medium text-gray-900">Devices & Points</h2>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="mt-2 w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Energy">Energy</option>
                  <option value="Security">Security</option>
                </select>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {filteredDevices.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No devices discovered yet</p>
                    <button
                      onClick={startDiscovery}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Start Discovery
                    </button>
                  </div>
                ) : (
                  filteredDevices.map((device) => (
                    <div key={device.id} className="border-b">
                      <div
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                          selectedDevice?.id === device.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedDevice(device)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {device.device_name || `Device ${device.device_instance}`}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {device.vendor_name} - {device.model_name}
                            </p>
                            <p className="text-xs text-gray-400">{device.ip_address}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            device.is_online 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {device.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      
                      {selectedDevice?.id === device.id && device.bacnet_points && (
                        <div className="bg-gray-50 px-4 py-2 space-y-1">
                          {device.bacnet_points.map((point) => (
                            <div
                              key={point.id}
                              className={`px-3 py-2 rounded-md cursor-pointer text-sm ${
                                selectedPoint?.id === point.id 
                                  ? 'bg-white border border-blue-500' 
                                  : 'hover:bg-white'
                              }`}
                              onClick={() => setSelectedPoint(point)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-medium">
                                    {getPointIcon(point.point_category)} {point.object_name}
                                  </span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    {getObjectTypeName(point.object_type)}:{point.object_instance}
                                  </span>
                                </div>
                                {point.is_writable && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                    Writable
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                Value: <strong>{point.present_value}</strong> {point.units}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">Point Control</h2>
              </div>
              
              <div className="p-6">
                {selectedPoint ? (
                  <div className="space-y-6">
                    {/* Point Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {selectedPoint.object_name}
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Description:</span>
                          <p className="font-medium">{selectedPoint.description || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <p className="font-medium">{selectedPoint.point_type}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Current Value:</span>
                          <p className="font-medium text-lg text-blue-600">
                            {selectedPoint.present_value} {selectedPoint.units}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Category:</span>
                          <p className="font-medium">{selectedPoint.point_category}</p>
                        </div>
                        {selectedPoint.min_value !== undefined && (
                          <div>
                            <span className="text-gray-500">Range:</span>
                            <p className="font-medium">
                              {selectedPoint.min_value} - {selectedPoint.max_value} {selectedPoint.units}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Control Interface */}
                    {selectedPoint.is_writable ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Value
                          </label>
                          <div className="flex space-x-3">
                            <input
                              type={selectedPoint.object_type <= 2 ? 'number' : 'text'}
                              value={controlValue}
                              onChange={(e) => setControlValue(e.target.value)}
                              placeholder={`Enter value (${selectedPoint.units})`}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min={selectedPoint.min_value}
                              max={selectedPoint.max_value}
                            />
                            <select
                              value={priority}
                              onChange={(e) => setPriority(parseInt(e.target.value))}
                              className="px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value={1}>Priority 1 (Manual Life Safety)</option>
                              <option value={2}>Priority 2 (Auto Life Safety)</option>
                              <option value={5}>Priority 5 (Critical Equipment)</option>
                              <option value={8}>Priority 8 (Manual Operator)</option>
                              <option value={10}>Priority 10 (Default)</option>
                              <option value={16}>Priority 16 (Lowest)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex space-x-3">
                          <button
                            onClick={writePoint}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                          >
                            Write Value
                          </button>
                          <button
                            onClick={releasePoint}
                            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition"
                          >
                            Release Control
                          </button>
                        </div>

                        {/* Quick Actions */}
                        {selectedPoint.point_category === 'Lighting' && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-2">Quick Actions</p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setControlValue('0')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                Off
                              </button>
                              <button
                                onClick={() => setControlValue('1')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                On
                              </button>
                              <button
                                onClick={() => setControlValue('50')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                50%
                              </button>
                              <button
                                onClick={() => setControlValue('100')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                100%
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedPoint.point_category === 'HVAC' && selectedPoint.point_type === 'Temperature' && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-2">Temperature Presets</p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setControlValue('68')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                68°F
                              </button>
                              <button
                                onClick={() => setControlValue('70')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                70°F
                              </button>
                              <button
                                onClick={() => setControlValue('72')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                72°F
                              </button>
                              <button
                                onClick={() => setControlValue('74')}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                              >
                                74°F
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>This point is read-only</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Select a point from the device list to control it</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}