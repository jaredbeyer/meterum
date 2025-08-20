-- Migration: Add user roles and BACnet point display names
-- Description: Adds role-based access control and customizable display names
-- Date: 2025-08-20

-- Add role to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';

-- Add index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing admin user(s) - assuming first user is admin
UPDATE users 
SET role = 'admin' 
WHERE id = 1;

-- Add display_name to BACnet points
ALTER TABLE bacnet_points 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Initially set display_name to object_name
UPDATE bacnet_points 
SET display_name = object_name 
WHERE display_name IS NULL;

-- Create user_sites table for customer access control
CREATE TABLE IF NOT EXISTS user_sites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_control BOOLEAN DEFAULT false,
  can_schedule BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique user-site combination
  UNIQUE(user_id, site_id),
  
  -- Indexes for queries
  INDEX idx_user_sites_user (user_id),
  INDEX idx_user_sites_site (site_id)
);

-- Create audit log for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for queries
  INDEX idx_audit_log_user (user_id),
  INDEX idx_audit_log_action (action),
  INDEX idx_audit_log_created (created_at)
);

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id INTEGER,
  p_site_id INTEGER,
  p_permission VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  has_access BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM users
  WHERE id = p_user_id;
  
  -- Admins have all permissions
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check customer permissions for specific site
  IF p_permission = 'view' THEN
    SELECT can_view INTO has_access
    FROM user_sites
    WHERE user_id = p_user_id AND site_id = p_site_id;
  ELSIF p_permission = 'control' THEN
    SELECT can_control INTO has_access
    FROM user_sites
    WHERE user_id = p_user_id AND site_id = p_site_id;
  ELSIF p_permission = 'schedule' THEN
    SELECT can_schedule INTO has_access
    FROM user_sites
    WHERE user_id = p_user_id AND site_id = p_site_id;
  ELSE
    has_access := FALSE;
  END IF;
  
  RETURN COALESCE(has_access, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Create view for customer-accessible sites
CREATE OR REPLACE VIEW customer_sites AS
SELECT 
  s.*,
  us.can_control,
  us.can_schedule,
  us.user_id
FROM sites s
INNER JOIN user_sites us ON s.id = us.site_id
WHERE us.can_view = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, customer, technician, viewer';
COMMENT ON TABLE user_sites IS 'Maps customers to sites they can access with specific permissions';
COMMENT ON TABLE audit_log IS 'Tracks all administrative actions for security and compliance';
COMMENT ON COLUMN bacnet_points.display_name IS 'Custom display name for the point, defaults to object_name';

-- Insert sample customer user for testing
INSERT INTO users (username, email, password_hash, role, created_at)
SELECT 
  'customer_demo',
  'customer@example.com',
  '$2b$10$xGqRoF4LnWfLx7LBtLqJxOgY5j5YMxqJ2mYHs1XKQGp6sPqQvvfNa', -- password: Demo123!
  'customer',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'customer_demo'
);

-- Grant customer access to site 1 (if exists)
INSERT INTO user_sites (user_id, site_id, can_view, can_control, can_schedule)
SELECT 
  u.id,
  1,
  TRUE,
  TRUE,
  TRUE
FROM users u
WHERE u.username = 'customer_demo'
  AND EXISTS (SELECT 1 FROM sites WHERE id = 1)
  AND NOT EXISTS (
    SELECT 1 FROM user_sites 
    WHERE user_id = u.id AND site_id = 1
  );