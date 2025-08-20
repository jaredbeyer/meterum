# UUID Implementation Documentation

## Overview
This document describes the UUID implementation for the Meterum energy monitoring system. UUIDs have been added to all major entities (customers, sites, nodes, and meters) to provide globally unique identifiers.

## Key Features

### 1. UUID Generation
- **Customers, Sites, Meters**: Automatically generate random UUIDs (v4) on creation
- **Nodes**: Generate deterministic UUIDs (v5) based on MAC address when available

### 2. MAC Address Linking for Nodes
Nodes are uniquely identified by their MAC address, which is used to generate a consistent UUID:
- When a node registers with a MAC address, a UUID v5 is generated using the MAC as input
- This ensures the same node always gets the same UUID, even if re-registered
- Nodes without MAC addresses receive a random UUID v4

### 3. Database Schema Changes

#### New Columns Added:
- `customers.uuid` - UUID for customer identification
- `sites.uuid` - UUID for site identification  
- `nodes.uuid` - UUID for node identification
- `nodes.mac_address` - MAC address of the node's network interface
- `meters.uuid` - UUID for meter identification

#### Database Trigger:
A PostgreSQL trigger automatically generates deterministic UUIDs for nodes when a MAC address is provided or updated.

### 4. API Updates

#### Node Registration (`/api/nodes/register`)
- Now accepts `macAddress` parameter
- Returns node UUID in response
- Example request:
```json
{
  "nodeId": "RPI-001",
  "version": "1.0.0",
  "ipAddress": "192.168.1.100",
  "macAddress": "02:42:AC:11:00:02"
}
```

#### All GET Endpoints
The following endpoints now return UUIDs in their responses:
- `/api/customers` - Returns customer UUIDs
- `/api/sites` - Returns site UUIDs with related customer UUIDs
- `/api/nodes` - Returns node UUIDs and MAC addresses
- `/api/meters` - Returns meter UUIDs with related node UUIDs

### 5. Frontend Updates

The dashboard now displays:
- Node UUIDs (abbreviated) in the unassigned nodes table
- MAC addresses for registered nodes
- UUID information is available in all entity objects for future use

### 6. Migration Instructions

To apply the UUID migration to your Supabase database:

1. Open the Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `/scripts/apply-uuid-migration.sql`
4. Paste and execute in the SQL Editor
5. Verify the migration with the verification query at the end

### 7. Benefits

- **Global Uniqueness**: UUIDs ensure no collision across distributed systems
- **MAC-based Node Identity**: Nodes maintain consistent identity based on hardware
- **API Integration Ready**: UUIDs provide stable identifiers for external integrations
- **Audit Trail**: UUIDs can be used for tracking entities across system changes

### 8. Views for Easy Access

Two convenience views have been created:
- `nodes_with_uuids` - Shows nodes with all related UUIDs (site, customer)
- `meters_with_uuids` - Shows meters with all related UUIDs (node, site, customer)

### 9. Example Usage

#### Querying by UUID:
```sql
-- Find a node by UUID
SELECT * FROM nodes WHERE uuid = 'your-uuid-here';

-- Get all meters for a customer UUID
SELECT * FROM meters_with_uuids 
WHERE customer_uuid = 'customer-uuid-here';
```

#### Node Registration with MAC:
```javascript
// Raspberry Pi client
const macAddress = getMacAddress(); // Gets MAC from network interface
const response = await registerNode({
  nodeId: cpuSerial,
  macAddress: macAddress,
  version: '1.0.0',
  ipAddress: localIP
});
console.log('Node UUID:', response.uuid);
```

## Testing

The virtual node simulator automatically generates a consistent virtual MAC address for testing UUID generation. Run the virtual node with:

```bash
cd test-node
npm start
```

The virtual MAC address is generated deterministically from the NODE_ID, ensuring consistent UUIDs for testing.