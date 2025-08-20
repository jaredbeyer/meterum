'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import AdminPointEditor from '../../../components/AdminPointEditor';

interface Site {
  id: number;
  name: string;
  customer_name: string;
  address: string;
}

interface Node {
  id: number;
  node_id: string;
  name: string;
  status: string;
}

interface BACnetDevice {
  id: number;
  device_instance: number;
  device_name: string;
  vendor_name: string;
  device_type: string;
  is_online: boolean;
  bacnet_points?: BACnetPoint[];
}

interface BACnetPoint {
  id: number;
  object_name: string;
  display_name?: string;
  description: string;
  present_value: string;
  units: string;
  is_writable: boolean;
  point_category: string;
  point_type: string;
  min_value?: number;
  max_value?: number;
}

interface ControlZone {
  name: string;
  type: string;
  points: BACnetPoint[];
}

export default function SiteControlPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params?.siteId as string;
  
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [devices, setDevices] = useState<BACnetDevice[]>([]);
  const [zones, setZones] = useState<ControlZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userRole, setUserRole] = useState<string>('customer');
  const [canControl, setCanControl] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<BACnetPoint | null>(null);
  const [controlValue, setControlValue] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!authToken) {
      router.push('/login');
      return;
    }
    
    // Check user role and permissions
    try {
      const tokenParts = authToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        setUserRole(payload.role || 'customer');
      }
    } catch (error) {
      console.error('Error parsing token:', error);
    }
    
    fetchSiteData();
  }, [siteId, router]);

  const fetchSiteData = async () => {
    try {
      // Fetch site info
      const siteResponse = await fetch(`/api/sites/${siteId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (siteResponse.ok) {
        const siteData = await siteResponse.json();
        setSite(siteData.site);
        setNodes(siteData.nodes || []);
      }

      // Fetch BACnet devices for all nodes at this site
      const devicesResponse = await fetch(`/api/sites/${siteId}/bacnet-devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json();
        setDevices(devicesData.devices || []);
        organizeIntoZones(devicesData.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch site data:', error);
      toast.error('Failed to load site control data');
    } finally {
      setLoading(false);
    }
  };

  const organizeIntoZones = (devices: BACnetDevice[]) => {
    const zoneMap = new Map<string, ControlZone>();
    
    // Group points by category and location
    devices.forEach(device => {
      device.bacnet_points?.forEach(point => {
        const zoneKey = `${point.point_category}-${device.device_name}`;
        
        if (!zoneMap.has(zoneKey)) {
          zoneMap.set(zoneKey, {
            name: device.device_name || 'Unknown Zone',
            type: point.point_category,
            points: []
          });
        }
        
        zoneMap.get(zoneKey)?.points.push(point);
      });
    });
    
    setZones(Array.from(zoneMap.values()));
  };

  const writePoint = async (point: BACnetPoint, value: string) => {
    try {
      const response = await fetch('/api/bacnet/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          pointId: point.id,
          value: value,
          priority: 10
        })
      });

      if (response.ok) {
        toast.success(`Updated ${point.object_name} to ${value} ${point.units}`);
        fetchSiteData(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update point');
      }
    } catch (error) {
      console.error('Control error:', error);
      toast.error('Failed to send control command');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'HVAC': return '🌡️';
      case 'Lighting': return '💡';
      case 'Energy': return '⚡';
      case 'Security': return '🔒';
      default: return '📊';
    }
  };

  const getStatusColor = (value: string, type: string) => {
    if (type === 'Switch' || type === 'Binary') {
      return value === '1' || value === 'true' ? 'text-green-600' : 'text-gray-400';
    }
    return 'text-blue-600';
  };

  const filteredZones = selectedCategory === 'all' 
    ? zones 
    : zones.filter(z => z.type === selectedCategory);

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
              <h1 className="text-2xl font-bold text-gray-900">
                {site?.name} - Control System
              </h1>
              <p className="text-sm text-gray-500">
                {site?.customer_name} • {site?.address}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push(`/dashboard/sites/${siteId}/schedules`)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                📅 Schedules
              </button>
              <button
                onClick={() => router.push(`/dashboard/customers`)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Filter:</span>
            {['all', 'HVAC', 'Lighting', 'Energy', 'Security'].map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded text-sm transition ${
                  selectedCategory === category
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-500 hover:bg-blue-400'
                }`}
              >
                {category === 'all' ? 'All Systems' : `${getCategoryIcon(category)} ${category}`}
              </button>
            ))}
            <div className="ml-auto text-sm">
              {nodes.filter(n => n.status === 'active').length}/{nodes.length} nodes online
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Control Zones Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredZones.map((zone, index) => (
            <div key={index} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900">
                  {getCategoryIcon(zone.type)} {zone.name}
                </h3>
                <p className="text-xs text-gray-500">{zone.type} • {zone.points.length} points</p>
              </div>
              
              <div className="p-4 space-y-3">
                {zone.points.map(point => (
                  <div key={point.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="mb-2">
                      <AdminPointEditor
                        point={point}
                        isAdmin={userRole === 'admin'}
                        onUpdate={(pointId, displayName) => {
                          // Update local state when display name changes
                          point.display_name = displayName;
                        }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className={`text-lg font-bold ${getStatusColor(point.present_value, point.point_type)}`}>
                        {point.present_value} {point.units}
                      </div>
                      
                      {point.is_writable && (userRole === 'admin' || canControl) && (
                        <div className="flex space-x-1">
                          {point.point_type === 'Switch' ? (
                            <>
                              <button
                                onClick={() => writePoint(point, '0')}
                                className={`px-2 py-1 text-xs rounded ${
                                  point.present_value === '0' 
                                    ? 'bg-gray-600 text-white' 
                                    : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                              >
                                Off
                              </button>
                              <button
                                onClick={() => writePoint(point, '1')}
                                className={`px-2 py-1 text-xs rounded ${
                                  point.present_value === '1' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                              >
                                On
                              </button>
                            </>
                          ) : point.point_type === 'Dimmer' ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="range"
                                min={point.min_value || 0}
                                max={point.max_value || 100}
                                value={parseFloat(point.present_value)}
                                onChange={(e) => writePoint(point, e.target.value)}
                                className="w-20 h-4"
                              />
                              <span className="text-xs w-10 text-right">
                                {point.present_value}%
                              </span>
                            </div>
                          ) : point.point_type === 'Temperature' ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => writePoint(point, String(parseFloat(point.present_value) - 1))}
                                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                              >
                                −
                              </button>
                              <button
                                onClick={() => writePoint(point, String(parseFloat(point.present_value) + 1))}
                                className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedPoint(point)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Set
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredZones.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No control points found for this site.</p>
            <p className="text-sm text-gray-400 mt-2">
              Make sure BACnet devices have been discovered on the nodes at this site.
            </p>
          </div>
        )}
      </div>

      {/* Value Input Modal */}
      {selectedPoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Set Value: {selectedPoint.object_name}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedPoint.description}</p>
            
            <input
              type="number"
              value={controlValue}
              onChange={(e) => setControlValue(e.target.value)}
              min={selectedPoint.min_value}
              max={selectedPoint.max_value}
              placeholder={`Enter value (${selectedPoint.units})`}
              className="w-full px-3 py-2 border rounded-md mb-4"
              autoFocus
            />
            
            {selectedPoint.min_value !== undefined && (
              <p className="text-xs text-gray-500 mb-4">
                Range: {selectedPoint.min_value} - {selectedPoint.max_value} {selectedPoint.units}
              </p>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  writePoint(selectedPoint, controlValue);
                  setSelectedPoint(null);
                  setControlValue('');
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Set Value
              </button>
              <button
                onClick={() => {
                  setSelectedPoint(null);
                  setControlValue('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}