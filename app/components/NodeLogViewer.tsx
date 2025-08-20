'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface NodeLog {
  id: number;
  log_level: string;
  message: string;
  metadata?: any;
  timestamp: string;
  created_at: string;
}

interface NodeLogViewerProps {
  nodeId: number;
  nodeName: string;
  authToken: string;
}

export default function NodeLogViewer({ nodeId, nodeName, authToken }: NodeLogViewerProps) {
  const [logs, setLogs] = useState<NodeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [isExpanded, setIsExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const logLevels = ['ALL', 'DEBUG', 'INFO', 'SUCCESS', 'WARN', 'ERROR', 'DATA'];

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        nodeId: nodeId.toString(),
        limit: '100'
      });
      
      if (filterLevel !== 'ALL') {
        params.append('level', filterLevel);
      }

      const response = await fetch(`/api/nodes/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [nodeId, filterLevel, autoRefresh]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'text-gray-500';
      case 'INFO': return 'text-blue-600';
      case 'SUCCESS': return 'text-green-600';
      case 'WARN': return 'text-yellow-600';
      case 'ERROR': return 'text-red-600';
      case 'DATA': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getLogLevelBgColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-100';
      case 'INFO': return 'bg-blue-50';
      case 'SUCCESS': return 'bg-green-50';
      case 'WARN': return 'bg-yellow-50';
      case 'ERROR': return 'bg-red-50';
      case 'DATA': return 'bg-purple-50';
      default: return 'bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      timeZone: 'America/Chicago',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const clearLogs = async () => {
    // This would require an API endpoint to clear logs
    toast.error('Clear logs not implemented yet');
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Node Logs: {nodeName}
            </h3>
            <span className="text-xs text-gray-500">
              ({logs.length} entries)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Filter Dropdown */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {logLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2 py-1 text-xs rounded-md transition ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              {autoRefresh ? '🔄 Live' : '⏸ Paused'}
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchLogs}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition"
              title="Refresh logs"
            >
              Refresh
            </button>

            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
            >
              {isExpanded ? '▼ Collapse' : '▶ Expand'}
            </button>

            {/* Clear Logs */}
            <button
              onClick={clearLogs}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition"
              title="Clear all logs"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div 
        className={`bg-gray-900 overflow-y-auto transition-all duration-300 ${
          isExpanded ? 'max-h-96' : 'max-h-48'
        }`}
        style={{ minHeight: '12rem' }}
      >
        <div className="p-2 font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No logs available for this node
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`flex items-start space-x-2 py-1 px-2 rounded ${getLogLevelBgColor(log.log_level)} hover:bg-opacity-80 transition`}
              >
                {/* Timestamp */}
                <span className="text-gray-500 flex-shrink-0">
                  [{formatTimestamp(log.timestamp)}]
                </span>
                
                {/* Log Level */}
                <span className={`font-semibold flex-shrink-0 w-16 ${getLogLevelColor(log.log_level)}`}>
                  [{log.log_level}]
                </span>
                
                {/* Message */}
                <span className="text-gray-800 flex-1 break-all">
                  {log.message}
                </span>
                
                {/* Metadata (if present) */}
                {log.metadata && (
                  <span className="text-gray-600 text-xs ml-2">
                    {JSON.stringify(log.metadata)}
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {autoRefresh && 'Auto-refreshing every 5 seconds'}
          </span>
          <button
            onClick={scrollToBottom}
            className="text-blue-600 hover:text-blue-700"
          >
            Scroll to bottom ↓
          </button>
        </div>
      </div>
    </div>
  );
}