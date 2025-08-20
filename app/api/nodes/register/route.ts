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
    
    const { nodeId, version, ipAddress } = await request.json();
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    // Check if node exists
    const { data: existingNode, error: fetchError } = await supabaseAdmin
      .from('nodes')
      .select('id, site_id, name, status')
      .eq('node_id', nodeId)
      .single();
    
    if (existingNode && !fetchError) {
      // Update existing node
      const { error: updateError } = await supabaseAdmin
        .from('nodes')
        .update({
          last_seen: new Date().toISOString(),
          version: version || null,
          ip_address: ipAddress || null,
          status: 'active'
        })
        .eq('node_id', nodeId);
      
      if (updateError) {
        throw updateError;
      }
      
      return NextResponse.json({
        nodeId,
        status: 'updated',
        siteId: existingNode.site_id,
        name: existingNode.name
      });
    } else {
      // Register new node
      const { data: newNode, error: insertError } = await supabaseAdmin
        .from('nodes')
        .insert({
          node_id: nodeId,
          version: version || null,
          ip_address: ipAddress || null,
          last_seen: new Date().toISOString(),
          status: 'pending'
        })
        .select('id')
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      return NextResponse.json({
        nodeId,
        status: 'registered',
        id: newNode.id,
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