import { supabaseAdmin } from './supabase';
import { verifyToken } from './auth';

export type UserRole = 'admin' | 'customer' | 'technician' | 'viewer';
export type Permission = 'view' | 'control' | 'schedule' | 'admin';

interface UserPermissions {
  role: UserRole;
  userId: number;
  username: string;
  allowedSites?: number[];
  permissions?: {
    [siteId: number]: {
      canView: boolean;
      canControl: boolean;
      canSchedule: boolean;
    };
  };
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: string, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 4,
    technician: 3,
    customer: 2,
    viewer: 1
  };

  const userLevel = roleHierarchy[userRole as UserRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Get user permissions from token
 */
export async function getUserPermissions(token: string): Promise<UserPermissions | null> {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const permissions: UserPermissions = {
    role: decoded.role || 'viewer',
    userId: decoded.userId,
    username: decoded.username
  };

  // Admins have access to everything
  if (permissions.role === 'admin') {
    return permissions;
  }

  // For non-admins, get specific site permissions
  const { data: userSites, error } = await supabaseAdmin
    .from('user_sites')
    .select('site_id, can_view, can_control, can_schedule')
    .eq('user_id', decoded.userId);

  if (!error && userSites) {
    permissions.allowedSites = userSites.map(us => us.site_id);
    permissions.permissions = {};
    
    userSites.forEach(us => {
      permissions.permissions![us.site_id] = {
        canView: us.can_view,
        canControl: us.can_control,
        canSchedule: us.can_schedule
      };
    });
  }

  return permissions;
}

/**
 * Check if user can access a specific site
 */
export async function canAccessSite(
  token: string, 
  siteId: number, 
  permission: Permission = 'view'
): Promise<boolean> {
  const userPerms = await getUserPermissions(token);
  if (!userPerms) return false;

  // Admins can access everything
  if (userPerms.role === 'admin') return true;

  // Check if user has access to this site
  if (!userPerms.allowedSites?.includes(siteId)) return false;

  // Check specific permission
  const sitePerms = userPerms.permissions?.[siteId];
  if (!sitePerms) return false;

  switch (permission) {
    case 'view':
      return sitePerms.canView;
    case 'control':
      return sitePerms.canControl;
    case 'schedule':
      return sitePerms.canSchedule;
    case 'admin':
      return false; // Only admins have admin permission
    default:
      return false;
  }
}

/**
 * Get sites accessible to user
 */
export async function getUserSites(token: string): Promise<number[]> {
  const userPerms = await getUserPermissions(token);
  if (!userPerms) return [];

  // Admins can see all sites
  if (userPerms.role === 'admin') {
    const { data: sites } = await supabaseAdmin
      .from('sites')
      .select('id');
    return sites?.map(s => s.id) || [];
  }

  return userPerms.allowedSites || [];
}

/**
 * Check if user can perform admin actions
 */
export function isAdmin(userRole: string): boolean {
  return userRole === 'admin';
}

/**
 * Check if user can modify system settings
 */
export function canModifySystem(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'technician';
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  userId: number,
  action: string,
  entityType?: string,
  entityId?: number,
  oldValue?: any,
  newValue?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue,
        new_value: newValue,
        ip_address: ipAddress,
        user_agent: userAgent
      });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}