-- Script to apply BACnet control functionality to Supabase
-- Run this in the Supabase SQL Editor after the UUID and logs migrations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BACnet devices discovered on the network
CREATE TABLE IF NOT EXISTS bacnet_devices (
    id SERIAL PRIMARY KEY,
    node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    device_instance INTEGER NOT NULL,
    ip_address INET,
    mac_address VARCHAR(17),
    network_number INTEGER DEFAULT 0,
    vendor_id INTEGER,
    vendor_name VARCHAR(100),
    model_name VARCHAR(100),
    firmware_revision VARCHAR(50),
    application_version VARCHAR(50),
    device_name VARCHAR(100),
    device_description TEXT,
    location VARCHAR(200),
    device_type VARCHAR(50),
    protocol_type VARCHAR(10) DEFAULT 'IP',
    max_apdu INTEGER,
    segmentation_support VARCHAR(50),
    is_online BOOLEAN DEFAULT true,
    last_seen TIMESTAMP,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    properties JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, device_instance)
);

-- BACnet points/objects discovered on devices
CREATE TABLE IF NOT EXISTS bacnet_points (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES bacnet_devices(id) ON DELETE CASCADE,
    object_type INTEGER NOT NULL,
    object_instance INTEGER NOT NULL,
    object_name VARCHAR(100),
    description TEXT,
    present_value TEXT,
    units VARCHAR(50),
    is_writable BOOLEAN DEFAULT false,
    is_commandable BOOLEAN DEFAULT false,
    priority_array JSONB,
    min_value DECIMAL,
    max_value DECIMAL,
    resolution DECIMAL,
    point_type VARCHAR(50),
    point_category VARCHAR(50),
    equipment_tag VARCHAR(100),
    metadata JSONB,
    last_read TIMESTAMP,
    last_write TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, object_type, object_instance)
);

-- Control commands queue for point writes
CREATE TABLE IF NOT EXISTS control_commands (
    id SERIAL PRIMARY KEY,
    point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
    command_type VARCHAR(20) NOT NULL,
    target_value TEXT,
    priority INTEGER DEFAULT 16,
    status VARCHAR(20) DEFAULT 'pending',
    requested_by INTEGER REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    response_value TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Point value history for trending
CREATE TABLE IF NOT EXISTS point_history (
    id SERIAL PRIMARY KEY,
    point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    value TEXT NOT NULL,
    quality VARCHAR(20) DEFAULT 'good',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bacnet_devices_node_id ON bacnet_devices(node_id);
CREATE INDEX IF NOT EXISTS idx_bacnet_devices_online ON bacnet_devices(is_online);
CREATE INDEX IF NOT EXISTS idx_bacnet_points_device_id ON bacnet_points(device_id);
CREATE INDEX IF NOT EXISTS idx_bacnet_points_writable ON bacnet_points(is_writable);
CREATE INDEX IF NOT EXISTS idx_control_commands_status ON control_commands(status);
CREATE INDEX IF NOT EXISTS idx_point_history_point_timestamp ON point_history(point_id, timestamp DESC);

-- Grant permissions for the service role
GRANT ALL ON bacnet_devices TO service_role;
GRANT ALL ON bacnet_points TO service_role;
GRANT ALL ON control_commands TO service_role;
GRANT ALL ON point_history TO service_role;
GRANT USAGE ON SEQUENCE bacnet_devices_id_seq TO service_role;
GRANT USAGE ON SEQUENCE bacnet_points_id_seq TO service_role;
GRANT USAGE ON SEQUENCE control_commands_id_seq TO service_role;
GRANT USAGE ON SEQUENCE point_history_id_seq TO service_role;

-- Insert sample data for testing
INSERT INTO bacnet_devices (node_id, device_instance, ip_address, vendor_name, model_name, device_name, device_type)
SELECT 
    (SELECT id FROM nodes WHERE node_id = 'VIRTUAL-NODE-001' LIMIT 1),
    100001,
    '192.168.1.100',
    'Johnson Controls',
    'NAE5510',
    'Building Controller',
    'HVAC Controller'
WHERE NOT EXISTS (
    SELECT 1 FROM bacnet_devices WHERE device_instance = 100001
);

-- Insert sample HVAC points
INSERT INTO bacnet_points (device_id, object_type, object_instance, object_name, description, present_value, units, is_writable, point_type, point_category, min_value, max_value)
SELECT 
    (SELECT id FROM bacnet_devices WHERE device_instance = 100001 LIMIT 1),
    2, -- Analog Value
    1,
    'Zone_1_Temp_Setpoint',
    'Zone 1 Temperature Setpoint',
    '72',
    'degreesFahrenheit',
    true,
    'Temperature',
    'HVAC',
    65,
    85
WHERE NOT EXISTS (
    SELECT 1 FROM bacnet_points WHERE object_type = 2 AND object_instance = 1
);

INSERT INTO bacnet_points (device_id, object_type, object_instance, object_name, description, present_value, units, is_writable, point_type, point_category)
SELECT 
    (SELECT id FROM bacnet_devices WHERE device_instance = 100001 LIMIT 1),
    0, -- Analog Input
    1,
    'Zone_1_Temp',
    'Zone 1 Current Temperature',
    '70.5',
    'degreesFahrenheit',
    false,
    'Temperature',
    'HVAC'
WHERE NOT EXISTS (
    SELECT 1 FROM bacnet_points WHERE object_type = 0 AND object_instance = 1
);

-- Insert sample lighting points
INSERT INTO bacnet_points (device_id, object_type, object_instance, object_name, description, present_value, units, is_writable, point_type, point_category, min_value, max_value)
SELECT 
    (SELECT id FROM bacnet_devices WHERE device_instance = 100001 LIMIT 1),
    1, -- Analog Output
    10,
    'Lobby_Dimmer',
    'Lobby Lighting Dimmer Control',
    '75',
    'percent',
    true,
    'Dimmer',
    'Lighting',
    0,
    100
WHERE NOT EXISTS (
    SELECT 1 FROM bacnet_points WHERE object_type = 1 AND object_instance = 10
);

INSERT INTO bacnet_points (device_id, object_type, object_instance, object_name, description, present_value, units, is_writable, point_type, point_category)
SELECT 
    (SELECT id FROM bacnet_devices WHERE device_instance = 100001 LIMIT 1),
    4, -- Binary Output
    1,
    'Office_Lights',
    'Office Area Lighting Switch',
    '1',
    'noUnits',
    true,
    'Switch',
    'Lighting'
WHERE NOT EXISTS (
    SELECT 1 FROM bacnet_points WHERE object_type = 4 AND object_instance = 1
);

-- Verification query
SELECT 
    'BACnet Control System Setup Complete' as status,
    (SELECT COUNT(*) FROM bacnet_devices) as devices,
    (SELECT COUNT(*) FROM bacnet_points) as points,
    (SELECT COUNT(*) FROM bacnet_points WHERE is_writable = true) as writable_points;