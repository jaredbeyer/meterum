import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

// POST - Write to a BACnet point
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const userData = verifyToken(token || '');
    if (!userData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { pointId, value, priority = 10 } = await request.json();
    
    if (!pointId || value === undefined) {
      return NextResponse.json(
        { error: 'Point ID and value required' },
        { status: 400 }
      );
    }
    
    // Get point information
    const { data: point, error: pointError } = await supabaseAdmin
      .from('bacnet_points')
      .select(`
        *,
        bacnet_devices!inner (
          id,
          node_id,
          device_instance,
          ip_address,
          is_online
        )
      `)
      .eq('id', pointId)
      .single();
    
    if (pointError || !point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }
    
    // Check if point is writable
    if (!point.is_writable) {
      return NextResponse.json(
        { error: 'Point is not writable' },
        { status: 403 }
      );
    }
    
    // Check if device is online
    if (!point.bacnet_devices.is_online) {
      return NextResponse.json(
        { error: 'Device is offline' },
        { status: 503 }
      );
    }
    
    // Validate value based on point type
    if (point.object_type <= 2) { // Analog types
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return NextResponse.json(
          { error: 'Invalid numeric value' },
          { status: 400 }
        );
      }
      
      // Check min/max if defined
      if (point.min_value !== null && numValue < point.min_value) {
        return NextResponse.json(
          { error: `Value below minimum (${point.min_value})` },
          { status: 400 }
        );
      }
      if (point.max_value !== null && numValue > point.max_value) {
        return NextResponse.json(
          { error: `Value above maximum (${point.max_value})` },
          { status: 400 }
        );
      }
    }
    
    // Create control command
    const { data: command, error: commandError } = await supabaseAdmin
      .from('control_commands')
      .insert({
        point_id: pointId,
        command_type: 'WRITE',
        target_value: value.toString(),
        priority: priority,
        status: 'pending',
        requested_by: userData.userId,
        requested_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (commandError) {
      throw commandError;
    }
    
    // Log the action
    await supabaseAdmin
      .from('node_logs')
      .insert({
        node_id: point.bacnet_devices.node_id,
        log_level: 'INFO',
        message: `Control command: Write ${value} to ${point.object_name} (priority ${priority})`,
        metadata: {
          pointId,
          value,
          priority,
          requestedBy: userData.username
        },
        timestamp: new Date().toISOString()
      });
    
    return NextResponse.json({
      success: true,
      message: 'Control command queued',
      commandId: command.id,
      point: {
        name: point.object_name,
        currentValue: point.present_value,
        targetValue: value
      }
    });
    
  } catch (error) {
    console.error('Control command error:', error);
    return NextResponse.json(
      { error: 'Failed to send control command' },
      { status: 500 }
    );
  }
}

// GET - Get point value and history
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
    const pointId = searchParams.get('pointId');
    const includeHistory = searchParams.get('history') === 'true';
    const hours = parseInt(searchParams.get('hours') || '24');
    
    if (!pointId) {
      return NextResponse.json(
        { error: 'Point ID required' },
        { status: 400 }
      );
    }
    
    // Get point information
    const { data: point, error: pointError } = await supabaseAdmin
      .from('bacnet_points')
      .select(`
        *,
        bacnet_devices!inner (
          device_name,
          device_type,
          is_online
        )
      `)
      .eq('id', pointId)
      .single();
    
    if (pointError || !point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }
    
    let history = [];
    if (includeHistory) {
      // Get point history
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);
      
      const { data: historyData, error: historyError } = await supabaseAdmin
        .from('point_history')
        .select('timestamp, value')
        .eq('point_id', pointId)
        .gte('timestamp', cutoffTime.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (!historyError) {
        history = historyData || [];
      }
    }
    
    // Get recent commands
    const { data: recentCommands } = await supabaseAdmin
      .from('control_commands')
      .select('*')
      .eq('point_id', pointId)
      .order('requested_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      point,
      history,
      recentCommands: recentCommands || []
    });
    
  } catch (error) {
    console.error('Failed to fetch point data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch point data' },
      { status: 500 }
    );
  }
}

// PUT - Release/relinquish control of a point
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const userData = verifyToken(token || '');
    if (!userData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { pointId, priority = 10 } = await request.json();
    
    if (!pointId) {
      return NextResponse.json(
        { error: 'Point ID required' },
        { status: 400 }
      );
    }
    
    // Create release command
    const { data: command, error: commandError } = await supabaseAdmin
      .from('control_commands')
      .insert({
        point_id: pointId,
        command_type: 'RELEASE',
        priority: priority,
        status: 'pending',
        requested_by: userData.userId,
        requested_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (commandError) {
      throw commandError;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Release command queued',
      commandId: command.id
    });
    
  } catch (error) {
    console.error('Release command error:', error);
    return NextResponse.json(
      { error: 'Failed to release control' },
      { status: 500 }
    );
  }
}