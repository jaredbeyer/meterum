import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: meters, error } = await supabaseAdmin
      .from('meters')
      .select(`
        *,
        nodes (
          id,
          node_id,
          name,
          site_id,
          sites (
            id,
            name,
            customers (
              id,
              name
            )
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ meters: meters || [] });
  } catch (error) {
    console.error('Failed to fetch meters:', error);
    return NextResponse.json({ error: 'Failed to fetch meters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { node_id, meter_id, ip_address, model } = body;
    
    if (!node_id || !meter_id || !ip_address) {
      return NextResponse.json({ 
        error: 'Node ID, Meter ID, and IP address are required' 
      }, { status: 400 });
    }
    
    const { data: meter, error } = await supabaseAdmin
      .from('meters')
      .insert({
        node_id,
        meter_id,
        ip_address,
        model: model || 'Veris E34',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ meter, message: 'Meter added successfully' });
  } catch (error) {
    console.error('Failed to create meter:', error);
    return NextResponse.json({ error: 'Failed to create meter' }, { status: 500 });
  }
}