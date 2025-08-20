-- Migration: Add BACnet support tables
-- Description: Adds tables for storing BACnet devices and points discovered by nodes
-- Date: 2025-08-20

-- Create BACnet devices table
CREATE TABLE IF NOT EXISTS bacnet_devices (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  device_instance INTEGER NOT NULL,
  ip_address VARCHAR(50),
  vendor_id INTEGER,
  vendor_name VARCHAR(255),
  model_name VARCHAR(255),
  device_name VARCHAR(255),
  device_type VARCHAR(100),
  location VARCHAR(255),
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure device_instance is unique per node
  UNIQUE(node_id, device_instance)
);

-- Create BACnet points table
CREATE TABLE IF NOT EXISTS bacnet_points (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  device_id INTEGER REFERENCES bacnet_devices(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  object_type INTEGER NOT NULL,
  object_instance INTEGER NOT NULL,
  object_name VARCHAR(255),
  description TEXT,
  present_value VARCHAR(255),
  units VARCHAR(100),
  is_writable BOOLEAN DEFAULT false,
  point_type VARCHAR(100), -- Temperature, Humidity, Pressure, etc.
  point_category VARCHAR(50), -- HVAC, Lighting, Energy, etc.
  min_value NUMERIC,
  max_value NUMERIC,
  zone VARCHAR(100), -- Building zone/area
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique object per device
  UNIQUE(device_id, object_type, object_instance)
);

-- Create BACnet control commands table
CREATE TABLE IF NOT EXISTS control_commands (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  command_type VARCHAR(50) NOT NULL, -- READ, WRITE, RELEASE, SUBSCRIBE
  target_value VARCHAR(255),
  priority INTEGER DEFAULT 16,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, completed, failed
  response_value VARCHAR(255),
  error_message TEXT,
  created_by INTEGER REFERENCES users(id),
  requested_by INTEGER REFERENCES users(id),
  requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  
  -- Index for finding pending commands
  INDEX idx_commands_status (status),
  INDEX idx_commands_site (site_id)
);

-- Create BACnet point history table for tracking changes
CREATE TABLE IF NOT EXISTS point_history (
  id SERIAL PRIMARY KEY,
  point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
  value VARCHAR(255),
  changed_by VARCHAR(100), -- 'system', 'user', 'schedule', etc.
  command_id INTEGER REFERENCES control_commands(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for efficient queries
  INDEX idx_point_history_point (point_id),
  INDEX idx_point_history_timestamp (timestamp)
);

-- Add indexes for performance
CREATE INDEX idx_bacnet_devices_site ON bacnet_devices(site_id);
CREATE INDEX idx_bacnet_devices_node ON bacnet_devices(node_id);
CREATE INDEX idx_bacnet_points_site ON bacnet_points(site_id);
CREATE INDEX idx_bacnet_points_device ON bacnet_points(device_id);
CREATE INDEX idx_bacnet_points_category ON bacnet_points(point_category);

-- Add triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bacnet_devices_updated_at BEFORE UPDATE ON bacnet_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bacnet_points_updated_at BEFORE UPDATE ON bacnet_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE bacnet_devices IS 'Stores BACnet devices discovered by nodes';
COMMENT ON TABLE bacnet_points IS 'Stores BACnet points (sensors, actuators) from devices';
COMMENT ON TABLE control_commands IS 'Queues control commands to be executed on BACnet points';
COMMENT ON TABLE point_history IS 'Historical record of BACnet point value changes';

COMMENT ON COLUMN bacnet_devices.device_instance IS 'BACnet device instance number';
COMMENT ON COLUMN bacnet_points.object_type IS 'BACnet object type (0=AI, 1=AO, 2=AV, 3=BI, 4=BO, 5=BV, etc.)';
COMMENT ON COLUMN bacnet_points.object_instance IS 'BACnet object instance number';
COMMENT ON COLUMN control_commands.priority IS 'BACnet write priority (1-16, lower is higher priority)';