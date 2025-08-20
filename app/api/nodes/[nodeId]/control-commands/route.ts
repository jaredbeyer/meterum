import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }
    
    const nodeId = params.nodeId;
    
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
    
    // Get pending control commands for devices managed by this node
    const { data: commands, error: commandsError } = await supabaseAdmin
      .from('control_commands')
      .select(`
        id,
        command_type,
        target_value,
        priority,
        status,
        bacnet_points!inner (
          id,
          object_type,
          object_instance,
          object_name,
          bacnet_devices!inner (
            device_instance,
            ip_address,
            node_id
          )
        )
      `)
      .eq('status', 'pending')
      .eq('bacnet_points.bacnet_devices.node_id', node.id)
      .order('created_at', { ascending: true })
      .limit(10);
    
    if (commandsError) {
      console.error('Failed to fetch control commands:', commandsError);
      return NextResponse.json(
        { error: 'Failed to fetch commands' },
        { status: 500 }
      );
    }
    
    // Format commands for the node
    const formattedCommands = (commands || []).map((cmd: any) => ({
      id: cmd.id,
      command_type: cmd.command_type,
      target_value: cmd.target_value,
      priority: cmd.priority,
      point_id: cmd.bacnet_points.id,
      object_type: cmd.bacnet_points.object_type,
      object_instance: cmd.bacnet_points.object_instance,
      object_name: cmd.bacnet_points.object_name,
      device_address: cmd.bacnet_points.bacnet_devices.ip_address,
      device_id: cmd.bacnet_points.bacnet_devices.device_instance
    }));
    
    // Mark commands as sent
    if (formattedCommands.length > 0) {
      const commandIds = formattedCommands.map(cmd => cmd.id);
      await supabaseAdmin
        .from('control_commands')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .in('id', commandIds);
    }
    
    return NextResponse.json({
      commands: formattedCommands
    });
    
  } catch (error) {
    console.error('Error fetching control commands:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}