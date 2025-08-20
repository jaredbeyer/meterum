import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { node_id } = body;
    
    if (!node_id) {
      return NextResponse.json({ error: 'Node ID is required' }, { status: 400 });
    }
    
    // Update the node to remove site assignment
    const { data: updatedNode, error } = await supabaseAdmin
      .from('nodes')
      .update({
        site_id: null,
        status: 'pending'
      })
      .eq('id', node_id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ 
      node: updatedNode, 
      message: 'Node unassigned from site successfully' 
    });
  } catch (error) {
    console.error('Failed to unassign node:', error);
    return NextResponse.json({ error: 'Failed to unassign node from site' }, { status: 500 });
  }
}