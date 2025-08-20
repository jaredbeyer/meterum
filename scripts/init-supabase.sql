-- Run this script in the Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/vzbpsmghagcjirbjmiuj/sql

-- Drop existing tables if they exist (for clean reset)
DROP TABLE IF EXISTS command_log CASCADE;
DROP TABLE IF EXISTS meter_templates CASCADE;
DROP TABLE IF EXISTS voltage_references CASCADE;
DROP TABLE IF EXISTS ct_channel_configs CASCADE;
DROP TABLE IF EXISTS meter_discovery CASCADE;
DROP TABLE IF EXISTS config_commands CASCADE;
DROP TABLE IF EXISTS energy_readings CASCADE;
DROP TABLE IF EXISTS sub_meters CASCADE;
DROP TABLE IF EXISTS meters CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) UNIQUE NOT NULL,
    site_id INTEGER REFERENCES sites(id),
    name VARCHAR(100),
    ip_address INET,
    last_seen TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    config_updated_at TIMESTAMP,
    notes TEXT
);

CREATE TABLE meters (
    id SERIAL PRIMARY KEY,
    meter_id VARCHAR(50) NOT NULL,
    node_id INTEGER REFERENCES nodes(id),
    ip_address INET NOT NULL,
    model VARCHAR(50) DEFAULT 'Veris E34',
    firmware_version VARCHAR(20),
    last_config_update TIMESTAMP,
    last_data_received TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, ip_address)
);

CREATE TABLE sub_meters (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    channel_number INTEGER NOT NULL,
    name VARCHAR(100),
    location VARCHAR(100),
    load_type VARCHAR(50),
    ct_ratio VARCHAR(10),
    phase VARCHAR(10),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meter_id, channel_number)
);

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

CREATE TABLE config_commands (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id),
    command_type VARCHAR(50) NOT NULL,
    command_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_energy_readings_timestamp ON energy_readings(timestamp);
CREATE INDEX idx_energy_readings_sub_meter_timestamp ON energy_readings(sub_meter_id, timestamp);
CREATE INDEX idx_nodes_last_seen ON nodes(last_seen);
CREATE INDEX idx_meters_node_id ON meters(node_id);
CREATE INDEX idx_sub_meters_meter_id ON sub_meters(meter_id);
CREATE INDEX idx_config_commands_status ON config_commands(status);
CREATE INDEX idx_config_commands_meter_id ON config_commands(meter_id);

-- Insert demo data
INSERT INTO customers (name, contact_email) VALUES 
('Demo Customer', 'demo@example.com');

INSERT INTO sites (customer_id, name, address) VALUES 
(1, 'Main Building', '123 Main St, City, State');

-- Create default admin user (password: 'admin123' - change this!)
-- Hash generated with bcrypt for 'admin123'
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@meterum.com', '$2a$10$YKqPt1XduGEqfDQBPCV.8uPGOlJMvByqQHeGCqthgTlpbCKwJBz5.', 'admin');

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_commands ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
CREATE POLICY "Service role has full access to users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to customers" ON customers
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to sites" ON sites
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to nodes" ON nodes
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to meters" ON meters
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to sub_meters" ON sub_meters
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to energy_readings" ON energy_readings
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to config_commands" ON config_commands
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions for API operations (using service role)
CREATE POLICY "Allow public read for health checks" ON nodes
    FOR SELECT USING (true);

-- Success message
SELECT 'Database initialized successfully!' as message;