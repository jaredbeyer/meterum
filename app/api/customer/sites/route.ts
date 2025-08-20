import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';
import { getUserPermissions } from '../../../../lib/authorization';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userPerms = await getUserPermissions(token);
    if (!userPerms) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    let sites;

    // Admins see all sites
    if (userPerms.role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('sites')
        .select(`
          *,
          customers (
            name
          )
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      
      sites = data?.map(site => ({
        ...site,
        customer_name: site.customers?.name,
        can_control: true,
        can_schedule: true
      }));
    } else {
      // Customers only see their assigned sites
      if (!userPerms.allowedSites || userPerms.allowedSites.length === 0) {
        return NextResponse.json([]);
      }

      const { data, error } = await supabaseAdmin
        .from('sites')
        .select(`
          *,
          customers (
            name
          )
        `)
        .in('id', userPerms.allowedSites)
        .order('name', { ascending: true });

      if (error) throw error;

      // Add permissions for each site
      sites = data?.map(site => ({
        ...site,
        customer_name: site.customers?.name,
        can_control: userPerms.permissions?.[site.id]?.canControl || false,
        can_schedule: userPerms.permissions?.[site.id]?.canSchedule || false
      }));
    }

    return NextResponse.json(sites || []);
    
  } catch (error) {
    console.error('Error fetching customer sites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}