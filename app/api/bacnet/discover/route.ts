import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

// POST - Trigger BACnet discovery on a node
export async function POST(request: NextRequest) {
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
    
    const { nodeId, scanOptions } = await request.json();
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    // Get node information
    const { data: node, error: nodeError } = await supabaseAdmin
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
    
    if (nodeError || !node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    // Create a discovery command for the node
    const { data: command, error: commandError } = await supabaseAdmin
      .from('config_commands')
      .insert({
        meter_id: null, // Not meter-specific
        command_type: 'BACNET_DISCOVER',
        command_data: {
          nodeId: node.node_id,
          scanOptions: scanOptions || {
            lowLimit: 0,
            highLimit: 4194303,
            timeout: 30000
          }
        },
        status: 'pending'
      })
      .select()
      .single();
    
    if (commandError) {
      throw commandError;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Discovery initiated',
      commandId: command.id
    });
    
  } catch (error) {
    console.error('Discovery initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate discovery' },
      { status: 500 }
    );
  }
}

// GET - Get discovered devices for a node
export async function GET(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    // Get discovered devices
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
          point_category
        )
      `)
      .eq('node_id', nodeId)
      .order('device_instance', { ascending: true });
    
    if (devicesError) {
      throw devicesError;
    }
    
    // Get device statistics
    const stats = {
      totalDevices: devices?.length || 0,
      onlineDevices: devices?.filter(d => d.is_online).length || 0,
      totalPoints: devices?.reduce((sum, d) => sum + (d.bacnet_points?.length || 0), 0) || 0,
      writablePoints: devices?.reduce((sum, d) => 
        sum + (d.bacnet_points?.filter((p: any) => p.is_writable).length || 0), 0) || 0
    };
    
    return NextResponse.json({
      devices: devices || [],
      stats
    });
    
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}