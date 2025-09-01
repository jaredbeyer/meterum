import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
import { verifyToken } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Query meters with joined nodes and sites (simplified for pg)
    const result = await pool.query(`
      SELECT m.*, n.id as node_id, n.name as node_name, n.site_id, s.id as site_id, s.name as site_name, c.id as customer_id, c.name as customer_name
      FROM meters m
      LEFT JOIN nodes n ON m.node_id = n.id
      LEFT JOIN sites s ON n.site_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY m.created_at DESC
    `);
    return NextResponse.json({ meters: result.rows });
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

    const insertQuery = `
      INSERT INTO meters (node_id, meter_id, ip_address, model, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [node_id, meter_id, ip_address, model || 'Veris E34', 'pending'];
    try {
      const result = await pool.query(insertQuery, values);
      return NextResponse.json({ meter: result.rows[0], message: 'Meter added successfully' });
    } catch (error) {
      console.error('Failed to create meter:', error);
      return NextResponse.json({ error: 'Failed to create meter' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to create meter:', error);
    return NextResponse.json({ error: 'Failed to create meter' }, { status: 500 });
  }
}