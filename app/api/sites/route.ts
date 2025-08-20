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
    
    const { data: sites, error } = await supabaseAdmin
      .from('sites')
      .select(`
        *,
        customers (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ sites: sites || [] });
  } catch (error) {
    console.error('Failed to fetch sites:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
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
    const { customer_id, name, address, timezone } = body;
    
    if (!customer_id || !name) {
      return NextResponse.json({ error: 'Customer ID and site name are required' }, { status: 400 });
    }
    
    const { data: site, error } = await supabaseAdmin
      .from('sites')
      .insert({
        customer_id,
        name,
        address: address || null,
        timezone: timezone || 'UTC',
        active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ site, message: 'Site created successfully' });
  } catch (error) {
    console.error('Failed to create site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}