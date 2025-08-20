'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface Customer {
  id: number;
  uuid: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  active: boolean;
  created_at: string;
}

interface Site {
  id: number;
  uuid: string;
  customer_id: number;
  name: string;
  address: string;
  timezone: string;
  active: boolean;
  created_at: string;
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
  site_id: number | null;
  name: string;
  status: string;
  last_seen: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customers');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Form states
  const [customerForm, setCustomerForm] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });
  
  const [siteForm, setSiteForm] = useState({
    customer_id: '',
    name: '',
    address: '',
    timezone: 'America/New_York'
  });

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
      
      // Fetch all data in parallel
      const [customersRes, sitesRes, nodesRes] = await Promise.all([
        fetch('/api/customers', { headers }),
        fetch('/api/sites', { headers }),
        fetch('/api/nodes', { headers })
      ]);
      
      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.customers || []);
      }
      
      if (sitesRes.ok) {
        const data = await sitesRes.json();
        setSites(data.sites || []);
      }
      
      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.nodes || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async () => {
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(customerForm)
      });
      
      if (response.ok) {
        toast.success('Customer created successfully');
        setShowCreateModal(false);
        setCustomerForm({ name: '', contact_email: '', contact_phone: '', address: '' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create customer');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const createSite = async () => {
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(siteForm)
      });
      
      if (response.ok) {
        toast.success('Site created successfully');
        setShowCreateModal(false);
        setSiteForm({ customer_id: '', name: '', address: '', timezone: 'America/New_York' });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create site');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const assignNodeToSite = async (nodeId: number, siteId: string, nodeName: string) => {
    try {
      const response = await fetch('/api/nodes/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          node_id: nodeId,
          site_id: parseInt(siteId),
          name: nodeName
        })
      });
      
      if (response.ok) {
        toast.success('Node assigned to site successfully');
        setShowAssignModal(false);
        setSelectedNode(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign node');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const getUnassignedNodes = () => {
    return nodes.filter(node => !node.site_id);
  };

  const getNodesBySite = (siteId: number) => {
    return nodes.filter(node => node.site_id === siteId);
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
            <h1 className="text-2xl font-bold text-gray-900">Customer & Site Management</h1>
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
            {['customers', 'sites', 'unassigned-nodes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Customers ({customers.length})</h2>
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setActiveTab('customers');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Customer
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sites</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.contact_email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.contact_phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {sites.filter(s => s.customer_id === customer.id).length} sites
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No customers yet. Create your first customer above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sites Tab */}
        {activeTab === 'sites' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Sites ({sites.length})</h2>
              <button
                onClick={() => {
                  if (customers.length === 0) {
                    toast.error('Please create a customer first');
                    setActiveTab('customers');
                    return;
                  }
                  setShowCreateModal(true);
                  setActiveTab('sites');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Site
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sites.map((site) => {
                const siteNodes = getNodesBySite(site.id);
                return (
                  <div key={site.id} className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-medium text-lg mb-2">{site.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Customer: {site.customers?.name || 'Unknown'}
                    </p>
                    <div className="space-y-2 text-sm">
                      <p>📍 {site.address || 'No address'}</p>
                      <p>🕐 {site.timezone}</p>
                      <p>📡 {siteNodes.length} nodes assigned</p>
                    </div>
                    {siteNodes.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-gray-500 mb-2">Assigned Nodes:</p>
                        <div className="space-y-1">
                          {siteNodes.map(node => (
                            <div key={node.id} className="flex justify-between items-center text-xs bg-gray-50 px-2 py-1 rounded">
                              <span>{node.name || node.node_id}</span>
                              <button
                                onClick={async () => {
                                  if (confirm(`Unassign ${node.name || node.node_id} from this site?`)) {
                                    try {
                                      const response = await fetch('/api/nodes/unassign', {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                                        },
                                        body: JSON.stringify({ node_id: node.id })
                                      });
                                      
                                      if (response.ok) {
                                        toast.success('Node unassigned successfully');
                                        fetchData();
                                      } else {
                                        toast.error('Failed to unassign node');
                                      }
                                    } catch (error) {
                                      toast.error('Network error');
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 ml-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {sites.length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No sites yet. Create your first site above.</p>
              </div>
            )}
          </div>
        )}

        {/* Unassigned Nodes Tab */}
        {activeTab === 'unassigned-nodes' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium">
              Unassigned Nodes ({getUnassignedNodes().length})
            </h2>
            
            <div className="bg-white rounded-lg shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Node ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAC Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getUnassignedNodes().map((node) => (
                      <tr key={node.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium">{node.node_id}</div>
                            <div className="text-xs text-gray-500">UUID: {node.uuid?.substring(0, 8)}...</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{node.mac_address || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            node.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {node.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {node.last_seen ? new Date(node.last_seen).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (sites.length === 0) {
                                toast.error('Please create a site first');
                                setActiveTab('sites');
                                return;
                              }
                              setSelectedNode(node);
                              setShowAssignModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Assign to Site
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {getUnassignedNodes().length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">All nodes are assigned to sites!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Customer Modal */}
      {showCreateModal && activeTab === 'customers' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create New Customer</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Corporation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={customerForm.contact_email}
                  onChange={(e) => setCustomerForm({ ...customerForm, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={customerForm.contact_phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="123 Main St, City, State"
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createCustomer}
                disabled={!customerForm.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Site Modal */}
      {showCreateModal && activeTab === 'sites' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create New Site</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={siteForm.customer_id}
                  onChange={(e) => setSiteForm({ ...siteForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name *
                </label>
                <input
                  type="text"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Main Building"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="123 Main St, City, State"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={siteForm.timezone}
                  onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex space-x-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createSite}
                disabled={!siteForm.customer_id || !siteForm.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Node Modal */}
      {showAssignModal && selectedNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Assign Node to Site</h2>
            <p className="text-sm text-gray-600 mb-4">
              Assigning node: <span className="font-medium">{selectedNode.node_id}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Site *
                </label>
                <select
                  id="site-select"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a site</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.customers?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Node Name (Optional)
                </label>
                <input
                  type="text"
                  id="node-name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Building A Monitor"
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedNode(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const siteSelect = document.getElementById('site-select') as HTMLSelectElement;
                  const nameInput = document.getElementById('node-name') as HTMLInputElement;
                  if (siteSelect?.value) {
                    assignNodeToSite(selectedNode.id, siteSelect.value, nameInput?.value || '');
                  } else {
                    toast.error('Please select a site');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Assign Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}