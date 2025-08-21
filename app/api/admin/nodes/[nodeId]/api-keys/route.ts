import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../lib/api-auth';
import { generateNodeApiKey, rotateNodeApiKey } from '../../../../../../lib/node-auth';
import { supabaseAdmin } from '../../../../../../lib/supabase';

// GET - List API keys for a node
export async function GET(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  return withAuth(request, async (req) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const nodeId = parseInt(params.nodeId);

    try {
      const { data: keys, error } = await supabaseAdmin
        .from('node_api_keys')
        .select('id, key_prefix, created_at, last_used, is_active')
        .eq('node_id', nodeId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return NextResponse.json({ keys: keys || [] });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }
  });
}

// POST - Generate new API key for a node
export async function POST(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  return withAuth(request, async (req) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const nodeId = parseInt(params.nodeId);
    const { rotate } = await request.json();

    try {
      let result;
      if (rotate) {
        result = await rotateNodeApiKey(nodeId);
      } else {
        result = await generateNodeApiKey(nodeId);
      }

      // Log the action
      await supabaseAdmin
        .from('audit_log')
        .insert({
          user_id: req.user.userId,
          action: rotate ? 'rotate_node_api_key' : 'generate_node_api_key',
          entity_type: 'node',
          entity_id: nodeId,
          metadata: { key_id: result.keyId },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          created_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        key: result.key,
        keyId: result.keyId,
        message: 'API key generated successfully. Please save this key securely as it cannot be retrieved again.'
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      );
    }
  });
}

// DELETE - Deactivate an API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  return withAuth(request, async (req) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { keyId } = await request.json();

    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID required' },
        { status: 400 }
      );
    }

    try {
      const { error } = await supabaseAdmin
        .from('node_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) {
        throw error;
      }

      // Log the action
      await supabaseAdmin
        .from('audit_log')
        .insert({
          user_id: req.user.userId,
          action: 'deactivate_node_api_key',
          entity_type: 'node_api_key',
          entity_id: keyId,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          created_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        message: 'API key deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating API key:', error);
      return NextResponse.json(
        { error: 'Failed to deactivate API key' },
        { status: 500 }
      );
    }
  });
}