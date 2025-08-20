import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyNodeApiKey } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    if (!verifyNodeApiKey(apiKey || '')) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    const { nodeId, version, ipAddress, macAddress } = await request.json();
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    // Check if node exists
    const { data: existingNode, error: fetchError } = await supabaseAdmin
      .from('nodes')
      .select('id, site_id, name, status, uuid')
      .eq('node_id', nodeId)
      .single();
    
    if (existingNode && !fetchError) {
      // Update existing node with MAC address if provided
      const updateData: any = {
        last_seen: new Date().toISOString(),
        version: version || null,
        ip_address: ipAddress || null,
        status: 'active'
      };
      
      // Add MAC address if provided and different from existing
      if (macAddress) {
        updateData.mac_address = macAddress;
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('nodes')
        .update(updateData)
        .eq('node_id', nodeId);
      
      if (updateError) {
        throw updateError;
      }
      
      return NextResponse.json({
        nodeId,
        status: 'updated',
        siteId: existingNode.site_id,
        name: existingNode.name,
        uuid: existingNode.uuid
      });
    } else {
      // Register new node with MAC address
      const insertData: any = {
        node_id: nodeId,
        version: version || null,
        ip_address: ipAddress || null,
        last_seen: new Date().toISOString(),
        status: 'pending'
      };
      
      // Add MAC address if provided
      if (macAddress) {
        insertData.mac_address = macAddress;
      }
      
      const { data: newNode, error: insertError } = await supabaseAdmin
        .from('nodes')
        .insert(insertData)
        .select('id, uuid')
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      return NextResponse.json({
        nodeId,
        status: 'registered',
        id: newNode.id,
        uuid: newNode.uuid,
        message: 'Node registered. Awaiting site assignment.'
      });
    }
  } catch (error) {
    console.error('Node registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}