-- Meterum Database Schema
-- PostgreSQL database schema for energy monitoring system

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Customers table (top level of hierarchy)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- Sites table (locations within customers)
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- Nodes table (Raspberry Pi devices)
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) UNIQUE NOT NULL, -- CPU serial number
    site_id INTEGER REFERENCES sites(id),
    name VARCHAR(100),
    ip_address INET,
    last_seen TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, offline, error
    version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    config_updated_at TIMESTAMP,
    notes TEXT
);

-- Meters table (Veris E34 devices)
CREATE TABLE meters (
    id SERIAL PRIMARY KEY,
    meter_id VARCHAR(50) NOT NULL, -- Unique identifier
    node_id INTEGER REFERENCES nodes(id),
    ip_address INET NOT NULL,
    model VARCHAR(50) DEFAULT 'Veris E34',
    firmware_version VARCHAR(20),
    last_config_update TIMESTAMP,
    last_data_received TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, configured, active, offline, error
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, ip_address)
);

-- Sub-meters table (individual CT channels)
CREATE TABLE sub_meters (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    channel_number INTEGER NOT NULL,
    name VARCHAR(100),
    location VARCHAR(100),
    load_type VARCHAR(50), -- lighting, hvac, equipment, etc.
    ct_ratio VARCHAR(10), -- 100:5, 200:5, etc.
    phase VARCHAR(10), -- A, B, C, AB, BC, CA, ABC
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meter_id, channel_number)
);

-- Energy readings table (time-series data)
CREATE TABLE energy_readings (
    id SERIAL PRIMARY KEY,
    sub_meter_id INTEGER REFERENCES sub_meters(id),
    timestamp TIMESTAMP NOT NULL,
    kwh_total DECIMAL(12,3),
    kw_demand DECIMAL(10,3),
    voltage DECIMAL(6,2),
    current DECIMAL(8,2),
    power_factor DECIMAL(4,3),
    frequency DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuration commands queue for remote meter setup
CREATE TABLE config_commands (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    command_type VARCHAR(50) NOT NULL, -- discover, configure_channel, set_voltage, etc.
    command_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Meter discovery results
CREATE TABLE meter_discovery (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    discovery_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_channels INTEGER,
    active_channels INTEGER,
    channel_details JSONB, -- Store detailed channel info
    voltage_config JSONB, -- Store voltage configuration found
    device_info JSONB -- Store device identification info
);

-- CT Channel configurations
CREATE TABLE ct_channel_configs (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    channel_number INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT false,
    ct_ratio VARCHAR(10) DEFAULT '100:5',
    phase_assignment VARCHAR(10) DEFAULT 'A', -- A, B, C, AB, BC, CA, ABC
    circuit_name VARCHAR(100),
    load_type VARCHAR(50),
    high_current_alarm DECIMAL(8,2),
    low_voltage_alarm DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meter_id, channel_number)
);

-- Voltage reference configurations
CREATE TABLE voltage_references (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    reference_number INTEGER NOT NULL, -- 1, 2, 3 for 3-phase
    nominal_voltage DECIMAL(6,2) DEFAULT 120.0,
    pt_ratio VARCHAR(10) DEFAULT '1:1',
    phase VARCHAR(5) NOT NULL, -- A, B, C
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meter_id, reference_number)
);

-- Configuration templates for reuse
CREATE TABLE meter_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL, -- Complete meter configuration
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Command execution log
CREATE TABLE command_log (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    command_type VARCHAR(50),
    bacnet_object_instance INTEGER,
    bacnet_property VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_energy_readings_timestamp ON energy_readings(timestamp);
CREATE INDEX idx_energy_readings_sub_meter_timestamp ON energy_readings(sub_meter_id, timestamp);
CREATE INDEX idx_nodes_last_seen ON nodes(last_seen);
CREATE INDEX idx_meters_node_id ON meters(node_id);
CREATE INDEX idx_sub_meters_meter_id ON sub_meters(meter_id);
CREATE INDEX idx_config_commands_status ON config_commands(status);
CREATE INDEX idx_config_commands_meter_id ON config_commands(meter_id);
CREATE INDEX idx_ct_configs_meter_id ON ct_channel_configs(meter_id);

-- Views for common queries
CREATE VIEW active_nodes AS 
SELECT n.*, s.name as site_name, c.name as customer_name
FROM nodes n
JOIN sites s ON n.site_id = s.id
JOIN customers c ON s.customer_id = c.id
WHERE n.status = 'active';

CREATE VIEW meter_summary AS
SELECT 
    m.id,
    m.meter_id,
    m.ip_address,
    m.status,
    n.node_id,
    s.name as site_name,
    c.name as customer_name,
    COUNT(sm.id) as total_channels,
    COUNT(CASE WHEN sm.enabled THEN 1 END) as active_channels,
    MAX(er.timestamp) as last_reading
FROM meters m
JOIN nodes n ON m.node_id = n.id
JOIN sites s ON n.site_id = s.id
JOIN customers c ON s.customer_id = c.id
LEFT JOIN sub_meters sm ON m.id = sm.meter_id
LEFT JOIN energy_readings er ON sm.id = er.sub_meter_id
GROUP BY m.id, m.meter_id, m.ip_address, m.status, n.node_id, s.name, c.name;

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the timestamp update trigger to relevant tables
CREATE TRIGGER update_ct_channel_configs_updated_at 
    BEFORE UPDATE ON ct_channel_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voltage_references_updated_at 
    BEFORE UPDATE ON voltage_references 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meter_templates_updated_at 
    BEFORE UPDATE ON meter_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data for testing
INSERT INTO customers (name, contact_email) VALUES 
('Demo Customer', 'demo@example.com');

INSERT INTO sites (customer_id, name, address) VALUES 
(1, 'Main Building', '123 Main St, City, State');

-- Create default admin user (password needs to be hashed in production)
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@meterum.com', '$2a$10$placeholder', 'admin');