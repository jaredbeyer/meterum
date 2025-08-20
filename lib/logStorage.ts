// Temporary in-memory log storage
// This is a temporary solution until the database migration is applied

interface NodeLog {
  id: number;
  node_id: number;
  node_uuid: string;
  log_level: string;
  message: string;
  metadata?: any;
  timestamp: string;
  created_at: string;
}

// In-memory storage for logs (will be lost on server restart)
const logsStorage = new Map<number, NodeLog[]>();
let logIdCounter = 1;

export function addLogsForNode(nodeId: number, nodeUuid: string, logs: any[]): void {
  if (!logsStorage.has(nodeId)) {
    logsStorage.set(nodeId, []);
  }
  
  const nodeLogs = logsStorage.get(nodeId)!;
  
  // Add new logs
  for (const log of logs) {
    const newLog: NodeLog = {
      id: logIdCounter++,
      node_id: nodeId,
      node_uuid: nodeUuid,
      log_level: log.level || 'INFO',
      message: log.message,
      metadata: log.metadata || null,
      timestamp: log.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    nodeLogs.push(newLog);
  }
  
  // Keep only last 500 logs per node
  if (nodeLogs.length > 500) {
    logsStorage.set(nodeId, nodeLogs.slice(-500));
  }
}

export function getLogsForNode(nodeId: number, limit: number = 100, level?: string): NodeLog[] {
  const nodeLogs = logsStorage.get(nodeId) || [];
  
  let filteredLogs = [...nodeLogs];
  
  // Filter by level if specified
  if (level && level !== 'ALL') {
    filteredLogs = filteredLogs.filter(log => log.log_level === level);
  }
  
  // Sort by timestamp descending and limit
  return filteredLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function clearLogsForNode(nodeId: number): void {
  logsStorage.delete(nodeId);
}

export function getAllNodeIds(): number[] {
  return Array.from(logsStorage.keys());
}