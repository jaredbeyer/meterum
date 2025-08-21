import { supabaseAdmin } from './supabase';

export type Permission = 'view' | 'control' | 'schedule' | 'admin';

/**
 * Check if a user has access to a specific site with a specific permission
 */
export async function canAccessSite(
  userId: number,
  siteId: number,
  permission: Permission = 'view'
): Promise<boolean> {
  // Get user details
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (userError || !user) return false;

  // Admins can access everything
  if (user.role === 'admin') return true;

  // Check user_site_permissions table
  const { data: sitePerms, error: permsError } = await supabaseAdmin
    .from('user_site_permissions')
    .select('can_view, can_control, can_schedule')
    .eq('user_id', userId)
    .eq('site_id', siteId)
    .single();

  if (permsError || !sitePerms) {
    // If no specific permissions, check if user has any site access
    const { data: userSite } = await supabaseAdmin
      .from('user_sites')
      .select('site_id')
      .eq('user_id', userId)
      .eq('site_id', siteId)
      .single();

    // Basic access for customers/technicians to their sites
    if (userSite && permission === 'view') {
      return true;
    }
    
    return false;
  }

  // Check specific permission
  switch (permission) {
    case 'view':
      return sitePerms.can_view || false;
    case 'control':
      return sitePerms.can_control || false;
    case 'schedule':
      return sitePerms.can_schedule || false;
    case 'admin':
      return false; // Only role-based admin check above
    default:
      return false;
  }
}