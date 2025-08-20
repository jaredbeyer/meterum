-- Script to apply node logs migration to Supabase
-- Run this in the Supabase SQL Editor after the UUID migration

-- Create node_logs table
CREATE TABLE IF NOT EXISTS node_logs (
    id SERIAL PRIMARY KEY,
    node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    node_uuid UUID,
    log_level VARCHAR(20) NOT NULL, -- DEBUG, INFO, WARN, ERROR, SUCCESS, DATA
    message TEXT NOT NULL,
    metadata JSONB, -- Additional structured data
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_node_logs_node_id ON node_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_node_logs_node_uuid ON node_logs(node_uuid);
CREATE INDEX IF NOT EXISTS idx_node_logs_timestamp ON node_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_node_logs_level ON node_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_node_logs_created_at ON node_logs(created_at DESC);

-- Create a view for recent logs with node details
CREATE OR REPLACE VIEW recent_node_logs AS
SELECT 
    nl.id,
    nl.node_id,
    nl.node_uuid,
    n.node_id as node_identifier,
    n.name as node_name,
    n.mac_address,
    nl.log_level,
    nl.message,
    nl.metadata,
    nl.timestamp,
    nl.created_at,
    s.name as site_name,
    c.name as customer_name
FROM node_logs nl
LEFT JOIN nodes n ON nl.node_id = n.id
LEFT JOIN sites s ON n.site_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id
WHERE nl.created_at > NOW() - INTERVAL '7 days'
ORDER BY nl.timestamp DESC;

-- Function to clean up old logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_node_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM node_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the service role
GRANT ALL ON node_logs TO service_role;
GRANT ALL ON recent_node_logs TO service_role;
GRANT USAGE ON SEQUENCE node_logs_id_seq TO service_role;

-- Verification query
SELECT 'Node logs table created successfully' as status;