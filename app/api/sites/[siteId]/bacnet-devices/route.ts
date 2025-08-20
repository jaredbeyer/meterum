import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyToken } from '../../../../../lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const siteId = params.siteId;
    
    // Get all nodes for this site
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from('nodes')
      .select('id')
      .eq('site_id', siteId);
    
    if (nodesError) {
      throw nodesError;
    }
    
    if (!nodes || nodes.length === 0) {
      return NextResponse.json({
        devices: [],
        message: 'No nodes found for this site'
      });
    }
    
    const nodeIds = nodes.map(n => n.id);
    
    // Get all BACnet devices for these nodes
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('bacnet_devices')
      .select(`
        *,
        bacnet_points (
          id,
          object_type,
          object_instance,
          object_name,
          description,
          present_value,
          units,
          is_writable,
          point_type,
          point_category,
          min_value,
          max_value
        )
      `)
      .in('node_id', nodeIds)
      .order('device_instance', { ascending: true });
    
    if (devicesError) {
      throw devicesError;
    }
    
    // Calculate statistics
    const stats = {
      totalDevices: devices?.length || 0,
      onlineDevices: devices?.filter(d => d.is_online).length || 0,
      totalPoints: devices?.reduce((sum, d) => sum + (d.bacnet_points?.length || 0), 0) || 0,
      controllablePoints: devices?.reduce((sum, d) => 
        sum + (d.bacnet_points?.filter(p => p.is_writable).length || 0), 0) || 0,
      categories: {
        hvac: devices?.reduce((sum, d) => 
          sum + (d.bacnet_points?.filter(p => p.point_category === 'HVAC').length || 0), 0) || 0,
        lighting: devices?.reduce((sum, d) => 
          sum + (d.bacnet_points?.filter(p => p.point_category === 'Lighting').length || 0), 0) || 0,
        energy: devices?.reduce((sum, d) => 
          sum + (d.bacnet_points?.filter(p => p.point_category === 'Energy').length || 0), 0) || 0,
        security: devices?.reduce((sum, d) => 
          sum + (d.bacnet_points?.filter(p => p.point_category === 'Security').length || 0), 0) || 0
      }
    };
    
    return NextResponse.json({
      devices: devices || [],
      stats
    });
    
  } catch (error) {
    console.error('Failed to fetch site BACnet devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}