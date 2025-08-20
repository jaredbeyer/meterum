-- Migration: Add UUID columns to all tables and link nodes by MAC address
-- Date: 2025-08-20
-- Description: Add UUID columns to nodes, customers, sites, and meters tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add UUID columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL;

-- Add UUID columns to sites table
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL;

-- Add UUID and MAC address columns to nodes table
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17) UNIQUE; -- Format: XX:XX:XX:XX:XX:XX

-- Add UUID columns to meters table
ALTER TABLE meters 
ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL;

-- Create indexes for UUID columns for better performance
CREATE INDEX IF NOT EXISTS idx_customers_uuid ON customers(uuid);
CREATE INDEX IF NOT EXISTS idx_sites_uuid ON sites(uuid);
CREATE INDEX IF NOT EXISTS idx_nodes_uuid ON nodes(uuid);
CREATE INDEX IF NOT EXISTS idx_nodes_mac_address ON nodes(mac_address);
CREATE INDEX IF NOT EXISTS idx_meters_uuid ON meters(uuid);

-- Create a function to generate deterministic UUID from MAC address for nodes
CREATE OR REPLACE FUNCTION generate_uuid_from_mac(mac_address TEXT)
RETURNS UUID AS $$
DECLARE
    namespace_uuid UUID := '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; -- Standard namespace UUID
BEGIN
    -- Generate UUID v5 (SHA-1 based) from MAC address
    RETURN uuid_generate_v5(namespace_uuid, mac_address);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set UUID based on MAC address for nodes
CREATE OR REPLACE FUNCTION set_node_uuid_from_mac()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.mac_address IS NOT NULL THEN
        NEW.uuid := generate_uuid_from_mac(NEW.mac_address);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to nodes table
DROP TRIGGER IF EXISTS trigger_set_node_uuid ON nodes;
CREATE TRIGGER trigger_set_node_uuid
    BEFORE INSERT OR UPDATE OF mac_address ON nodes
    FOR EACH ROW
    EXECUTE FUNCTION set_node_uuid_from_mac();

-- Create view with UUID relationships
CREATE OR REPLACE VIEW nodes_with_uuids AS
SELECT 
    n.id,
    n.uuid as node_uuid,
    n.node_id,
    n.mac_address,
    n.name as node_name,
    n.ip_address,
    n.status,
    n.last_seen,
    s.uuid as site_uuid,
    s.name as site_name,
    c.uuid as customer_uuid,
    c.name as customer_name
FROM nodes n
LEFT JOIN sites s ON n.site_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id;

-- Create view for meters with UUID relationships
CREATE OR REPLACE VIEW meters_with_uuids AS
SELECT 
    m.id,
    m.uuid as meter_uuid,
    m.meter_id,
    m.ip_address as meter_ip,
    m.model,
    m.status as meter_status,
    n.uuid as node_uuid,
    n.node_id,
    n.mac_address,
    n.name as node_name,
    s.uuid as site_uuid,
    s.name as site_name,
    c.uuid as customer_uuid,
    c.name as customer_name
FROM meters m
LEFT JOIN nodes n ON m.node_id = n.id
LEFT JOIN sites s ON n.site_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id;

-- Update existing records to ensure they have UUIDs (if any exist without them)
UPDATE customers SET uuid = uuid_generate_v4() WHERE uuid IS NULL;
UPDATE sites SET uuid = uuid_generate_v4() WHERE uuid IS NULL;
UPDATE meters SET uuid = uuid_generate_v4() WHERE uuid IS NULL;

-- For existing nodes without MAC addresses, keep the random UUID
-- When MAC address is added later, the trigger will update the UUID
UPDATE nodes SET uuid = uuid_generate_v4() WHERE uuid IS NULL;

-- Add comment documentation
COMMENT ON COLUMN customers.uuid IS 'Unique identifier for the customer';
COMMENT ON COLUMN sites.uuid IS 'Unique identifier for the site';
COMMENT ON COLUMN nodes.uuid IS 'Unique identifier for the node, derived from MAC address when available';
COMMENT ON COLUMN nodes.mac_address IS 'MAC address of the network interface, used to generate deterministic UUID';
COMMENT ON COLUMN meters.uuid IS 'Unique identifier for the meter';

-- Verification query to check migration success
DO $$
BEGIN
    RAISE NOTICE 'UUID Migration Complete. Run the following query to verify:';
    RAISE NOTICE 'SELECT table_name, column_name FROM information_schema.columns WHERE column_name = ''uuid'' AND table_schema = ''public'';';
END $$;