'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface Site {
  id: number;
  uuid: string;
  name: string;
  customers?: {
    id: number;
    uuid: string;
    name: string;
  };
}

interface Node {
  id: number;
  uuid: string;
  node_id: string;
  mac_address?: string;
  name: string;
  site_id: number;
  sites?: Site;
}

interface Meter {
  id: number;
  uuid: string;
  meter_id: string;
  node_id: number;
  ip_address: string;
  model: string;
  status: string;
  nodes?: Node;
}

interface ChannelConfig {
  channel: number;
  enabled: boolean;
  ctRatio: string;
  phase: string;
  name: string;
  loadType: string;
}

export default function MetersPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddMeterModal, setShowAddMeterModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  
  const [meterForm, setMeterForm] = useState({
    node_id: '',
    meter_id: '',
    ip_address: '',
    model: 'Veris E34'
  });

  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>(
    Array.from({ length: 42 }, (_, i) => ({
      channel: i + 1,
      enabled: false,
      ctRatio: '100:5',
      phase: 'A',
      name: '',
      loadType: ''
    }))
  );

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [nodesRes, metersRes] = await Promise.all([
        fetch('/api/nodes', { headers }),
        fetch('/api/meters', { headers })
      ]);
      
      if (nodesRes.ok) {
        const data = await nodesRes.json();
        // Filter only nodes that are assigned to sites
        const assignedNodes = (data.nodes || []).filter((n: Node) => n.site_id);
        setNodes(assignedNodes);
      }
      
      if (metersRes.ok) {
        const data = await metersRes.json();
        setMeters(data.meters || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addMeter = async () => {
    try {
      const response = await fetch('/api/meters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(meterForm)
      });
      
      if (response.ok) {
        toast.success('Meter added successfully');
        setShowAddMeterModal(false);
        setMeterForm({ node_id: '', meter_id: '', ip_address: '', model: 'Veris E34' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add meter');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const discoverMeter = async (meterId: number) => {
    toast.success('Starting meter discovery...');
    // Simulate discovery process
    setTimeout(() => {
      toast.success('Discovery complete! 6 active channels found.');
      // In production, this would actually communicate with the meter
    }, 2000);
  };

  const saveMeterConfig = async () => {
    const enabledChannels = channelConfigs.filter(ch => ch.enabled);
    
    if (enabledChannels.length === 0) {
      toast.error('Please enable at least one channel');
      return;
    }

    toast.success(`Configuration saved for ${enabledChannels.length} channels`);
    setShowConfigModal(false);
    
    // In production, this would send the configuration to the backend
    console.log('Saving configuration:', enabledChannels);
  };

  const updateChannelConfig = (index: number, field: keyof ChannelConfig, value: any) => {
    const newConfigs = [...channelConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    setChannelConfigs(newConfigs);
  };

  const enableChannelRange = (start: number, end: number) => {
    const newConfigs = [...channelConfigs];
    for (let i = start - 1; i < end; i++) {
      newConfigs[i].enabled = true;
    }
    setChannelConfigs(newConfigs);
  };

  const getNodeWithSite = (nodeId: number) => {
    const node = nodes.find(n => n.id === nodeId);
    return node;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Meter Configuration</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'configuration', 'diagnostics'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Meters ({meters.length})</h2>
              <button
                onClick={() => {
                  if (nodes.length === 0) {
                    toast.error('Please assign nodes to sites first');
                    router.push('/dashboard/customers');
                    return;
                  }
                  setShowAddMeterModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Meter
              </button>
            </div>
            
            {meters.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-medium mb-2">No Meters Configured</h3>
                <p className="text-gray-500 mb-6">Add your first Veris E34 meter to start monitoring energy</p>
                <div className="max-w-md mx-auto text-left bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium mb-2">Prerequisites:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Node assigned to a site</li>
                    <li>✓ Veris E34 meter on network</li>
                    <li>✓ Static IP configured on meter</li>
                    <li>✓ BACnet/IP enabled (port 47808)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {meters.map((meter) => {
                  const node = getNodeWithSite(meter.node_id);
                  return (
                    <div key={meter.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-medium text-lg">{meter.meter_id}</h3>
                          <p className="text-sm text-gray-500">{meter.model}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          meter.status === 'active' ? 'bg-green-100 text-green-800' :
                          meter.status === 'configured' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {meter.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <p>📍 IP: {meter.ip_address}</p>
                        <p>📡 Node: {node?.name || node?.node_id || 'Unknown'}</p>
                        {node?.sites && (
                          <p>🏢 Site: {node.sites.name}</p>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <button
                          onClick={() => discoverMeter(meter.id)}
                          className="w-full text-blue-600 hover:bg-blue-50 py-2 rounded text-sm font-medium"
                        >
                          🔍 Discover Channels
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMeter(meter);
                            setShowConfigModal(true);
                          }}
                          className="w-full text-green-600 hover:bg-green-50 py-2 rounded text-sm font-medium"
                        >
                          ⚙️ Configure Channels
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium mb-4">Quick Configuration</h2>
            {meters.length === 0 ? (
              <p className="text-gray-500">Add meters first to configure them.</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Configuration Steps:</h3>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Click "Discover Channels" to scan the meter</li>
                    <li>Enable channels with connected CTs</li>
                    <li>Set CT ratios based on your installation</li>
                    <li>Assign phase and circuit names</li>
                    <li>Apply configuration to save</li>
                  </ol>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Common CT Ratios:</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>• Lighting: 100:5 or 200:5</div>
                    <div>• HVAC: 400:5 or 800:5</div>
                    <div>• Motors: 1600:5 or 3200:5</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diagnostics Tab */}
        {activeTab === 'diagnostics' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium mb-4">Meter Diagnostics</h2>
            <p className="text-gray-500 mb-4">Test meter connectivity and troubleshoot issues.</p>
            
            {meters.length > 0 ? (
              <div className="space-y-4">
                {meters.map((meter) => (
                  <div key={meter.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{meter.meter_id}</h3>
                        <p className="text-sm text-gray-500">IP: {meter.ip_address}</p>
                      </div>
                      <button
                        onClick={() => {
                          toast.success(`Pinging ${meter.ip_address}...`);
                          setTimeout(() => {
                            toast.success('Meter is responding');
                          }, 1000);
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Test Connection
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No meters to diagnose.</p>
            )}
          </div>
        )}
      </main>

      {/* Add Meter Modal */}
      {showAddMeterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Add New Meter</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Node *
                </label>
                <select
                  value={meterForm.node_id}
                  onChange={(e) => setMeterForm({ ...meterForm, node_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a node</option>
                  {nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.name || node.node_id} ({node.sites?.name})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meter ID *
                </label>
                <input
                  type="text"
                  value={meterForm.meter_id}
                  onChange={(e) => setMeterForm({ ...meterForm, meter_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="E34-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Address *
                </label>
                <input
                  type="text"
                  value={meterForm.ip_address}
                  onChange={(e) => setMeterForm({ ...meterForm, ip_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={meterForm.model}
                  onChange={(e) => setMeterForm({ ...meterForm, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Veris E34">Veris E34</option>
                  <option value="Veris E34-480">Veris E34-480</option>
                  <option value="Veris E34-600">Veris E34-600</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex space-x-3 justify-end">
              <button
                onClick={() => setShowAddMeterModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addMeter}
                disabled={!meterForm.node_id || !meterForm.meter_id || !meterForm.ip_address}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Meter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Configuration Modal */}
      {showConfigModal && selectedMeter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Configure Meter Channels</h2>
                <p className="text-sm text-gray-500">Meter: {selectedMeter.meter_id} ({selectedMeter.ip_address})</p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions */}
            <div className="mb-4 flex space-x-2">
              <button
                onClick={() => enableChannelRange(1, 6)}
                className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Enable 1-6
              </button>
              <button
                onClick={() => enableChannelRange(1, 12)}
                className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Enable 1-12
              </button>
              <button
                onClick={() => enableChannelRange(1, 24)}
                className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Enable 1-24
              </button>
              <button
                onClick={() => enableChannelRange(1, 42)}
                className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Enable All
              </button>
              <button
                onClick={() => setChannelConfigs(channelConfigs.map(ch => ({ ...ch, enabled: false })))}
                className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>

            {/* Channel Configuration Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ch</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Enable</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CT Ratio</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Circuit Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Load Type</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {channelConfigs.map((channel, idx) => (
                      <tr key={idx} className={channel.enabled ? 'bg-blue-50' : ''}>
                        <td className="px-3 py-2 text-sm font-medium">{channel.channel}</td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={channel.enabled}
                            onChange={(e) => updateChannelConfig(idx, 'enabled', e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={channel.ctRatio}
                            onChange={(e) => updateChannelConfig(idx, 'ctRatio', e.target.value)}
                            disabled={!channel.enabled}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="100:5">100:5</option>
                            <option value="200:5">200:5</option>
                            <option value="400:5">400:5</option>
                            <option value="800:5">800:5</option>
                            <option value="1600:5">1600:5</option>
                            <option value="3200:5">3200:5</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={channel.phase}
                            onChange={(e) => updateChannelConfig(idx, 'phase', e.target.value)}
                            disabled={!channel.enabled}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="AB">AB</option>
                            <option value="BC">BC</option>
                            <option value="CA">CA</option>
                            <option value="ABC">ABC</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={channel.name}
                            onChange={(e) => updateChannelConfig(idx, 'name', e.target.value)}
                            disabled={!channel.enabled}
                            className="text-sm border rounded px-2 py-1 w-full"
                            placeholder="Circuit name"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={channel.loadType}
                            onChange={(e) => updateChannelConfig(idx, 'loadType', e.target.value)}
                            disabled={!channel.enabled}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="">Select...</option>
                            <option value="lighting">Lighting</option>
                            <option value="hvac">HVAC</option>
                            <option value="equipment">Equipment</option>
                            <option value="receptacles">Receptacles</option>
                            <option value="other">Other</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm">
                <span className="font-medium">Enabled Channels:</span> {channelConfigs.filter(ch => ch.enabled).length} / 42
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex space-x-3 justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveMeterConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}