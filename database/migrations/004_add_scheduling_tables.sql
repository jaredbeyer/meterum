-- Migration: Add scheduling system tables
-- Description: Adds tables for scheduling BACnet control actions
-- Date: 2025-08-20

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schedule_type VARCHAR(50) NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'custom'
  is_active BOOLEAN DEFAULT true,
  timezone VARCHAR(100) DEFAULT 'America/Chicago',
  start_date DATE NOT NULL,
  end_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for active schedules
  INDEX idx_schedules_active (is_active),
  INDEX idx_schedules_site (site_id)
);

-- Create schedule actions table (what to do)
CREATE TABLE IF NOT EXISTS schedule_actions (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  point_id INTEGER REFERENCES bacnet_points(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'write', 'release', 'read'
  target_value VARCHAR(255),
  priority INTEGER DEFAULT 16,
  sequence_order INTEGER DEFAULT 0, -- For ordering multiple actions
  delay_seconds INTEGER DEFAULT 0, -- Delay after previous action
  
  -- Index for schedule lookup
  INDEX idx_schedule_actions_schedule (schedule_id),
  INDEX idx_schedule_actions_point (point_id)
);

-- Create schedule times table (when to run)
CREATE TABLE IF NOT EXISTS schedule_times (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  time_of_day TIME NOT NULL, -- HH:MM:SS
  days_of_week INTEGER[], -- 0=Sunday, 1=Monday, etc. NULL for daily
  days_of_month INTEGER[], -- 1-31, NULL for non-monthly
  months INTEGER[], -- 1-12, NULL for all months
  
  -- Index for schedule lookup
  INDEX idx_schedule_times_schedule (schedule_id),
  INDEX idx_schedule_times_time (time_of_day)
);

-- Create schedule exceptions table (holidays, special dates)
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type VARCHAR(50) NOT NULL, -- 'skip', 'override'
  override_time TIME, -- If override, what time to run
  reason VARCHAR(255),
  
  -- Index for date lookup
  INDEX idx_schedule_exceptions_date (exception_date),
  INDEX idx_schedule_exceptions_schedule (schedule_id)
);

-- Create schedule execution history table
CREATE TABLE IF NOT EXISTS schedule_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'completed', 'failed', 'skipped'
  error_message TEXT,
  actions_executed INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  
  -- Index for monitoring
  INDEX idx_schedule_executions_schedule (schedule_id),
  INDEX idx_schedule_executions_status (status),
  INDEX idx_schedule_executions_time (scheduled_time)
);

-- Create schedule action results table
CREATE TABLE IF NOT EXISTS schedule_action_results (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES schedule_executions(id) ON DELETE CASCADE,
  action_id INTEGER REFERENCES schedule_actions(id) ON DELETE CASCADE,
  command_id INTEGER REFERENCES control_commands(id),
  status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'completed', 'failed'
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  
  -- Index for lookup
  INDEX idx_action_results_execution (execution_id),
  INDEX idx_action_results_action (action_id)
);

-- Create common schedule templates table
CREATE TABLE IF NOT EXISTS schedule_templates (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'HVAC', 'Lighting', 'Energy', etc.
  description TEXT,
  template_data JSONB NOT NULL, -- JSON structure of schedule and actions
  is_public BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to get next execution time for a schedule
CREATE OR REPLACE FUNCTION get_next_execution_time(schedule_id INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  schedule_record RECORD;
  schedule_time RECORD;
  next_time TIMESTAMP WITH TIME ZONE;
  current_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current time in schedule's timezone
  SELECT s.*, CURRENT_TIMESTAMP AT TIME ZONE s.timezone as local_time
  INTO schedule_record
  FROM schedules s
  WHERE s.id = get_next_execution_time.schedule_id;
  
  IF NOT FOUND OR NOT schedule_record.is_active THEN
    RETURN NULL;
  END IF;
  
  current_time := schedule_record.local_time;
  
  -- Get the next scheduled time based on schedule_type
  FOR schedule_time IN 
    SELECT * FROM schedule_times 
    WHERE schedule_times.schedule_id = get_next_execution_time.schedule_id
    ORDER BY time_of_day
  LOOP
    -- Calculate next occurrence based on schedule type
    -- This is simplified; actual implementation would be more complex
    next_time := current_time::date + schedule_time.time_of_day;
    
    IF next_time > current_time THEN
      RETURN next_time;
    END IF;
  END LOOP;
  
  -- If no time found today, get tomorrow's first time
  SELECT MIN(current_time::date + INTERVAL '1 day' + time_of_day)
  INTO next_time
  FROM schedule_times
  WHERE schedule_times.schedule_id = get_next_execution_time.schedule_id;
  
  RETURN next_time;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if schedule should run
CREATE OR REPLACE FUNCTION should_schedule_run(schedule_id INTEGER, check_time TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
DECLARE
  schedule_record RECORD;
  exception_record RECORD;
BEGIN
  -- Get schedule
  SELECT * INTO schedule_record
  FROM schedules
  WHERE id = should_schedule_run.schedule_id;
  
  IF NOT FOUND OR NOT schedule_record.is_active THEN
    RETURN FALSE;
  END IF;
  
  -- Check date range
  IF check_time::date < schedule_record.start_date OR 
     (schedule_record.end_date IS NOT NULL AND check_time::date > schedule_record.end_date) THEN
    RETURN FALSE;
  END IF;
  
  -- Check for exceptions
  SELECT * INTO exception_record
  FROM schedule_exceptions
  WHERE schedule_exceptions.schedule_id = should_schedule_run.schedule_id
    AND exception_date = check_time::date
    AND exception_type = 'skip';
  
  IF FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE schedules IS 'Defines scheduled automation tasks for BACnet control';
COMMENT ON TABLE schedule_actions IS 'Actions to perform when schedule triggers';
COMMENT ON TABLE schedule_times IS 'Time specifications for when schedules run';
COMMENT ON TABLE schedule_exceptions IS 'Dates to skip or override normal schedule';
COMMENT ON TABLE schedule_executions IS 'History of schedule execution attempts';
COMMENT ON TABLE schedule_action_results IS 'Results of individual actions within schedule execution';
COMMENT ON TABLE schedule_templates IS 'Reusable schedule templates for common scenarios';

-- Insert some default schedule templates
INSERT INTO schedule_templates (name, category, description, is_public, template_data) VALUES
('Office Hours HVAC', 'HVAC', 'Standard office building HVAC schedule', true, '{
  "schedule": {
    "name": "Office HVAC Schedule",
    "schedule_type": "weekly",
    "times": [
      {"time": "06:00:00", "days_of_week": [1,2,3,4,5], "action": "start"},
      {"time": "18:00:00", "days_of_week": [1,2,3,4,5], "action": "stop"}
    ]
  },
  "actions": {
    "start": [
      {"point_type": "Zone_*_Temp_Setpoint", "value": 72, "priority": 10},
      {"point_type": "*_Fan_Speed", "value": 75, "priority": 10}
    ],
    "stop": [
      {"point_type": "Zone_*_Temp_Setpoint", "value": 78, "priority": 10},
      {"point_type": "*_Fan_Speed", "value": 25, "priority": 10}
    ]
  }
}'),
('Night Lighting', 'Lighting', 'Automatic night lighting schedule', true, '{
  "schedule": {
    "name": "Night Lighting",
    "schedule_type": "daily",
    "times": [
      {"time": "sunset", "action": "on"},
      {"time": "23:00:00", "action": "dim"},
      {"time": "sunrise", "action": "off"}
    ]
  },
  "actions": {
    "on": [
      {"point_type": "*_Lights", "value": 1, "priority": 10},
      {"point_type": "*_Dimmer", "value": 100, "priority": 10}
    ],
    "dim": [
      {"point_type": "*_Dimmer", "value": 30, "priority": 10}
    ],
    "off": [
      {"point_type": "*_Lights", "value": 0, "priority": 10}
    ]
  }
}'),
('Energy Savings Weekend', 'Energy', 'Reduce energy consumption on weekends', true, '{
  "schedule": {
    "name": "Weekend Energy Savings",
    "schedule_type": "weekly",
    "times": [
      {"time": "00:00:00", "days_of_week": [0,6], "action": "setback"}
    ]
  },
  "actions": {
    "setback": [
      {"point_type": "Zone_*_Temp_Setpoint", "value": 85, "priority": 10},
      {"point_type": "*_Fan_Speed", "value": 0, "priority": 10},
      {"point_type": "*_Lights", "value": 0, "priority": 10}
    ]
  }
}');