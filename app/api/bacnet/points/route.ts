import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, point } = body;
    
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }
    
    // Verify node exists and API key matches
    const { data: node, error: nodeError } = await supabaseAdmin
      .from('nodes')
      .select('id, site_id')
      .eq('node_id', nodeId)
      .eq('api_key', apiKey)
      .single();
    
    if (nodeError || !node) {
      return NextResponse.json(
        { error: 'Invalid node or API key' },
        { status: 401 }
      );
    }
    
    // Get device ID from bacnet_devices table
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('bacnet_devices')
      .select('id')
      .eq('node_id', node.id)
      .eq('device_instance', point.device_id)
      .single();
    
    if (deviceError || !device) {
      console.error('Device not found for point:', point);
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }
    
    // Store point in database (upsert)
    const { data, error } = await supabaseAdmin
      .from('bacnet_points')
      .upsert({
        device_id: device.id,
        site_id: node.site_id,
        object_type: point.object_type,
        object_instance: point.object_instance,
        object_name: point.object_name,
        description: point.description,
        present_value: point.present_value,
        units: point.units,
        is_writable: point.is_writable || false,
        point_type: point.point_type,
        point_category: point.point_category,
        min_value: point.min_value,
        max_value: point.max_value,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'device_id,object_type,object_instance'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to store BACnet point:', error);
      return NextResponse.json(
        { error: 'Failed to store point' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      pointId: data.id,
      message: 'Point stored successfully'
    });
    
  } catch (error) {
    console.error('Error processing BACnet point:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const deviceId = searchParams.get('deviceId');
    
    let query = supabaseAdmin
      .from('bacnet_points')
      .select(`
        *,
        bacnet_devices (
          device_name,
          device_instance,
          ip_address
        )
      `);
    
    if (siteId) {
      query = query.eq('site_id', siteId);
    }
    
    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }
    
    const { data: points, error } = await query
      .order('point_category', { ascending: true })
      .order('object_name', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch BACnet points:', error);
      return NextResponse.json(
        { error: 'Failed to fetch points' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(points || []);
    
  } catch (error) {
    console.error('Error fetching BACnet points:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}