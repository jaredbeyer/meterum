'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import NodeLogViewer from '../components/NodeLogViewer';

interface Node {
  id: number;
  uuid: string;
  node_id: string;
  mac_address?: string;
  name: string;
  status: string;
  last_seen: string;
  ip_address: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedNodeForLogs, setSelectedNodeForLogs] = useState<Node | null>(null);

  useEffect(() => {
    // Check authentication
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');
    
    if (!authToken || !userStr) {
      router.push('/login');
      return;
    }
    
    setUser(JSON.parse(userStr));
    fetchNodes();
  }, [router]);

  const fetchNodes = async () => {
    try {
      const response = await fetch('/api/nodes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNodes(data.nodes || []);
      }
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    router.push('/login');
    toast.success('Logged out successfully');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Meterum Dashboard</h1>
              <p className="text-sm text-gray-500">Energy Monitoring System</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user?.username}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'nodes', 'meters', 'customers', 'analytics'].map((tab) => (
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Nodes</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{nodes.length}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {nodes.filter(n => n.status === 'active').length} active
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Meters</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
                <p className="text-sm text-gray-600 mt-1">Ready to configure</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Energy Today</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">0 kWh</p>
                <p className="text-sm text-gray-600 mt-1">No data yet</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">System Status</h3>
                <p className="text-3xl font-bold text-green-600 mt-2">Online</p>
                <p className="text-sm text-gray-600 mt-1">All systems operational</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
              </div>
              <div className="p-6">
                {nodes.length > 0 ? (
                  <div className="space-y-3">
                    {nodes.slice(0, 5).map((node) => (
                      <div key={node.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{node.name || node.node_id}</p>
                          <p className="text-sm text-gray-500">
                            Last seen: {formatDate(node.last_seen)}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
                          {node.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No nodes registered yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Registered Nodes</h2>
                <button
                  onClick={fetchNodes}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Node ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {nodes.map((node) => (
                    <tr key={node.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {node.node_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {node.name || 'Unnamed'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {node.ip_address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}>
                          {node.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(node.last_seen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedNodeForLogs(node)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nodes.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No nodes registered yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Nodes will appear here once they register with the system
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Node Log Viewer */}
          {selectedNodeForLogs && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Node Activity Logs</h3>
                <button
                  onClick={() => setSelectedNodeForLogs(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Close
                </button>
              </div>
              <NodeLogViewer
                nodeId={selectedNodeForLogs.id}
                nodeName={selectedNodeForLogs.name || selectedNodeForLogs.node_id}
                authToken={localStorage.getItem('authToken') || ''}
              />
            </div>
          )}
        </div>
        )}

        {activeTab === 'meters' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Meters Management</h2>
            <p className="text-gray-500 mb-4">Configure and manage your Veris E34 energy meters.</p>
            <a
              href="/dashboard/meters"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-block"
            >
              Go to Meter Configuration →
            </a>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Customer & Site Management</h2>
            <p className="text-gray-500 mb-4">Manage your customers, sites, and node assignments.</p>
            <a
              href="/dashboard/customers"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-block"
            >
              Go to Customer Management →
            </a>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Analytics</h2>
            <p className="text-gray-500">Energy analytics will appear here once meters start reporting data.</p>
          </div>
        )}
      </main>
    </div>
  );
}