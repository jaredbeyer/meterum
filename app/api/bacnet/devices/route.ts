import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, device } = body;
    
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
    
    // Store device in database (upsert)
    const { data, error } = await supabaseAdmin
      .from('bacnet_devices')
      .upsert({
        node_id: node.id,
        site_id: node.site_id,
        device_instance: device.device_instance,
        ip_address: device.ip_address,
        vendor_id: device.vendor_id,
        vendor_name: device.vendor_name,
        model_name: device.model_name,
        device_name: device.device_name,
        device_type: device.device_type,
        location: device.location,
        is_online: device.is_online || true,
        last_seen: new Date().toISOString(),
        properties: device.properties || {}
      }, {
        onConflict: 'node_id,device_instance'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to store BACnet device:', error);
      return NextResponse.json(
        { error: 'Failed to store device' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deviceId: data.id,
      message: 'Device stored successfully'
    });
    
  } catch (error) {
    console.error('Error processing BACnet device:', error);
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
    
    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID required' },
        { status: 400 }
      );
    }
    
    // Get BACnet devices for the site
    const { data: devices, error } = await supabaseAdmin
      .from('bacnet_devices')
      .select('*')
      .eq('site_id', siteId)
      .order('device_name', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch BACnet devices:', error);
      return NextResponse.json(
        { error: 'Failed to fetch devices' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(devices || []);
    
  } catch (error) {
    console.error('Error fetching BACnet devices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}