import { z } from 'zod';

// User and Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100)
});

export const userCreateSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  role: z.enum(['admin', 'customer', 'technician', 'viewer']),
  email: z.string().email().optional()
});

// Site schemas
export const siteIdSchema = z.object({
  siteId: z.string().transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0, 'Invalid site ID')
});

export const siteCreateSchema = z.object({
  name: z.string().min(1).max(255),
  customer_id: z.number().positive(),
  address: z.string().max(500).optional(),
  timezone: z.string().default('UTC'),
  metadata: z.record(z.string(), z.any()).optional()
});

// BACnet control schemas
export const bacnetControlSchema = z.object({
  site_id: z.number().positive(),
  device_id: z.number().positive(),
  object_type: z.string(),
  object_instance: z.number().min(0),
  property: z.string().default('present-value'),
  value: z.union([z.string(), z.number(), z.boolean()]),
  priority: z.number().min(1).max(16).optional(),
  override_duration: z.number().positive().optional()
});

export const bacnetDiscoverSchema = z.object({
  site_id: z.number().positive(),
  timeout: z.number().min(1000).max(30000).default(5000),
  max_devices: z.number().min(1).max(100).default(50)
});

// Schedule schemas
export const scheduleActionSchema = z.object({
  device_id: z.number().positive(),
  object_type: z.string(),
  object_instance: z.number().min(0),
  property: z.string().default('present-value'),
  value: z.union([z.string(), z.number(), z.boolean()]),
  priority: z.number().min(1).max(16).optional()
});

export const scheduleTimeSchema = z.object({
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59),
  days_of_week: z.array(z.number().min(0).max(6)).optional()
});

export const scheduleCreateSchema = z.object({
  site_id: z.number().positive(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  schedule_type: z.enum(['once', 'daily', 'weekly', 'monthly']),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  timezone: z.string().default('UTC'),
  times: z.array(scheduleTimeSchema),
  actions: z.array(scheduleActionSchema),
  exceptions: z.array(z.string().datetime()).optional(),
  is_active: z.boolean().default(true)
});

export const scheduleExecuteSchema = z.object({
  schedule_id: z.number().positive(),
  force: z.boolean().default(false)
});

// Node schemas
export const nodeRegisterSchema = z.object({
  name: z.string().min(1).max(255),
  ip_address: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address').optional(),
  location: z.string().max(500).optional(),
  capabilities: z.array(z.string()).optional(),
  version: z.string().optional()
});

export const nodeAssignSchema = z.object({
  node_id: z.number().positive(),
  site_id: z.number().positive()
});

export const nodeIngestSchema = z.object({
  node_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: z.record(z.string(), z.any()),
  status: z.enum(['online', 'offline', 'error']).optional()
});

// Command schemas
export const commandResultSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(['pending', 'success', 'error', 'timeout']),
  result: z.any().optional(),
  error: z.string().optional(),
  executed_at: z.string().datetime().optional()
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.string().default('1').transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0, 'Invalid page number'),
  limit: z.string().default('20').transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc')
});

// Filter schemas
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

export const logFilterSchema = dateRangeSchema.extend({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  source: z.string().optional(),
  node_id: z.number().positive().optional(),
  site_id: z.number().positive().optional()
});