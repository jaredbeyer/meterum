'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserPermissions } from '../../../lib/authorization';

interface Site {
  id: number;
  name: string;
  address: string;
  customer_name: string;
  can_control?: boolean;
  can_schedule?: boolean;
}

interface BACnetDevice {
  id: number;
  device_name: string;
  device_type: string;
  is_online: boolean;
  point_count?: number;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [devices, setDevices] = useState<BACnetDevice[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // Decode token to get user info
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        setUserRole(payload.role || 'customer');
        setUsername(payload.username || 'User');
        
        // Redirect admins to full dashboard
        if (payload.role === 'admin') {
          router.push('/dashboard');
          return;
        }
      }

      await fetchCustomerSites(token);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerSites = async (token: string) => {
    try {
      const response = await fetch('/api/customer/sites', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch sites');
      
      const data = await response.json();
      setSites(data);
      
      // Auto-select first site if only one
      if (data.length === 1) {
        handleSiteSelect(data[0]);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleSiteSelect = async (site: Site) => {
    setSelectedSite(site);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sites/${site.id}/bacnet-devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const navigateToControl = (siteId: number) => {
    router.push(`/dashboard/sites/${siteId}/control`);
  };

  const navigateToSchedules = (siteId: number) => {
    router.push(`/dashboard/sites/${siteId}/schedules`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Meterum Energy Monitor</h1>
              <p className="text-sm text-gray-500">Welcome, {username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sites.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Sites Available</h2>
            <p className="text-gray-600">You don't have access to any sites yet. Please contact your administrator.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Site Selection */}
            {sites.length > 1 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Sites</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sites.map(site => (
                    <button
                      key={site.id}
                      onClick={() => handleSiteSelect(site)}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        selectedSite?.id === site.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{site.address}</p>
                      <div className="mt-2 space-x-2">
                        {site.can_control && (
                          <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Control
                          </span>
                        )}
                        {site.can_schedule && (
                          <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Schedule
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Site Details */}
            {selectedSite && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedSite.name}</h2>
                      <p className="text-gray-600">{selectedSite.address}</p>
                    </div>
                    <div className="space-x-2">
                      {selectedSite.can_control && (
                        <button
                          onClick={() => navigateToControl(selectedSite.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Open Control Panel
                        </button>
                      )}
                      {selectedSite.can_schedule && (
                        <button
                          onClick={() => navigateToSchedules(selectedSite.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          View Schedules
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Device Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {devices.length}
                      </div>
                      <div className="text-sm text-gray-600">Total Devices</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {devices.filter(d => d.is_online).length}
                      </div>
                      <div className="text-sm text-gray-600">Online</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-400">
                        {devices.filter(d => !d.is_online).length}
                      </div>
                      <div className="text-sm text-gray-600">Offline</div>
                    </div>
                  </div>
                </div>

                {/* Device List */}
                {devices.length > 0 && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b">
                      <h3 className="text-lg font-semibold text-gray-900">Connected Devices</h3>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {devices.map(device => (
                        <div key={device.id} className="px-6 py-4 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{device.device_name}</h4>
                            <p className="text-sm text-gray-600">{device.device_type}</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            {device.point_count !== undefined && (
                              <span className="text-sm text-gray-500">
                                {device.point_count} points
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              device.is_online
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {device.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}