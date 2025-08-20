-- Migration to add BACnet device discovery and control functionality
-- This enables full building automation control (HVAC, Lighting, etc.)

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
    device_type VARCHAR(50), -- HVAC Controller, Lighting Controller, VAV, etc.
    protocol_type VARCHAR(10) DEFAULT 'IP', -- IP or MSTP
    max_apdu INTEGER,
    segmentation_support VARCHAR(50),
    is_online BOOLEAN DEFAULT true,
    last_seen TIMESTAMP,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    properties JSONB, -- Additional device properties
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, device_instance)
);

-- BACnet points/objects discovered on devices
CREATE TABLE IF NOT EXISTS bacnet_points (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES bacnet_devices(id) ON DELETE CASCADE,
    object_type INTEGER NOT NULL, -- 0=AI, 1=AO, 2=AV, 3=BI, 4=BO, 5=BV, etc.
    object_instance INTEGER NOT NULL,
    object_name VARCHAR(100),
    description TEXT,
    present_value TEXT, -- Store as text to handle different data types
    units VARCHAR(50), -- degreesFahrenheit, percent, etc.
    is_writable BOOLEAN DEFAULT false,
    is_commandable BOOLEAN DEFAULT false,
    priority_array JSONB, -- BACnet priority array (1-16)
    min_value DECIMAL,
    max_value DECIMAL,
    resolution DECIMAL,
    point_type VARCHAR(50), -- Temperature, Humidity, Pressure, Switch, Dimmer, etc.
    point_category VARCHAR(50), -- HVAC, Lighting, Security, Energy, etc.
    equipment_tag VARCHAR(100), -- AHU-1, VAV-2-1, LIGHT-ZONE-3, etc.
    metadata JSONB, -- Additional point metadata
    last_read TIMESTAMP,
    last_write TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, object_type, object_instance)
);

-- Control schedules for automated control
CREATE TABLE IF NOT EXISTS control_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50), -- Occupancy, Temperature, Lighting, etc.
    days_of_week VARCHAR(20), -- MON,TUE,WED or WEEKDAY, WEEKEND, ALL
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10, -- BACnet priority level
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled control actions
CREATE TABLE IF NOT EXISTS control_actions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES control_schedules(id) ON DELETE CASCADE,
    point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL, -- WRITE, RELEASE, OVERRIDE
    target_value TEXT, -- Value to write
    priority INTEGER DEFAULT 10, -- BACnet priority (1-16)
    relinquish_default TEXT, -- Value when released
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Control commands queue for point writes
CREATE TABLE IF NOT EXISTS control_commands (
    id SERIAL PRIMARY KEY,
    point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
    command_type VARCHAR(20) NOT NULL, -- READ, WRITE, RELEASE, SUBSCRIBE
    target_value TEXT,
    priority INTEGER DEFAULT 16, -- BACnet priority
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, completed, failed
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
    quality VARCHAR(20) DEFAULT 'good', -- good, uncertain, bad
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alarms and events from BACnet devices
CREATE TABLE IF NOT EXISTS bacnet_alarms (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES bacnet_devices(id) ON DELETE CASCADE,
    point_id INTEGER REFERENCES bacnet_points(id),
    alarm_type VARCHAR(50), -- HIGH_LIMIT, LOW_LIMIT, FAULT, etc.
    alarm_state VARCHAR(20), -- NORMAL, ALARM, FAULT, etc.
    priority INTEGER,
    message TEXT,
    timestamp TIMESTAMP NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Control zones for grouping points
CREATE TABLE IF NOT EXISTS control_zones (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50), -- HVAC Zone, Lighting Zone, etc.
    description TEXT,
    floor_number INTEGER,
    area_sqft DECIMAL,
    occupancy_schedule_id INTEGER REFERENCES control_schedules(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zone to point mapping
CREATE TABLE IF NOT EXISTS zone_points (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER REFERENCES control_zones(id) ON DELETE CASCADE,
    point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
    point_role VARCHAR(50), -- Temperature Sensor, Damper Control, Light Switch, etc.
    UNIQUE(zone_id, point_id)
);

-- Indexes for performance
CREATE INDEX idx_bacnet_devices_node_id ON bacnet_devices(node_id);
CREATE INDEX idx_bacnet_devices_device_instance ON bacnet_devices(device_instance);
CREATE INDEX idx_bacnet_devices_online ON bacnet_devices(is_online);
CREATE INDEX idx_bacnet_points_device_id ON bacnet_points(device_id);
CREATE INDEX idx_bacnet_points_type ON bacnet_points(object_type);
CREATE INDEX idx_bacnet_points_category ON bacnet_points(point_category);
CREATE INDEX idx_bacnet_points_writable ON bacnet_points(is_writable);
CREATE INDEX idx_control_commands_status ON control_commands(status);
CREATE INDEX idx_control_commands_point_id ON control_commands(point_id);
CREATE INDEX idx_point_history_point_timestamp ON point_history(point_id, timestamp DESC);
CREATE INDEX idx_bacnet_alarms_device_id ON bacnet_alarms(device_id);
CREATE INDEX idx_bacnet_alarms_acknowledged ON bacnet_alarms(acknowledged);

-- Views for common queries
CREATE OR REPLACE VIEW controllable_points AS
SELECT 
    bp.*,
    bd.device_name,
    bd.ip_address as device_ip,
    bd.device_type,
    n.node_id,
    n.name as node_name,
    s.name as site_name,
    c.name as customer_name
FROM bacnet_points bp
JOIN bacnet_devices bd ON bp.device_id = bd.id
JOIN nodes n ON bd.node_id = n.id
LEFT JOIN sites s ON n.site_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id
WHERE bp.is_writable = true
  AND bd.is_online = true;

CREATE OR REPLACE VIEW hvac_points AS
SELECT * FROM controllable_points
WHERE point_category = 'HVAC';

CREATE OR REPLACE VIEW lighting_points AS
SELECT * FROM controllable_points
WHERE point_category = 'Lighting';

-- Function to log point value changes
CREATE OR REPLACE FUNCTION log_point_value_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.present_value IS DISTINCT FROM NEW.present_value THEN
        INSERT INTO point_history (point_id, timestamp, value)
        VALUES (NEW.id, NOW(), NEW.present_value);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log value changes
CREATE TRIGGER trigger_log_point_value_change
    AFTER UPDATE OF present_value ON bacnet_points
    FOR EACH ROW
    EXECUTE FUNCTION log_point_value_change();

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;