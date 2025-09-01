import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { verifyToken } from '../../../lib/auth';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Join sites with customers for local Postgres
    const result = await pool.query(`
      SELECT s.*, c.id as customer_id, c.uuid as customer_uuid, c.name as customer_name
      FROM sites s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
    `);
    return NextResponse.json({ sites: result.rows });
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

    const insertQuery = `
      INSERT INTO sites (customer_id, name, address, timezone, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [customer_id, name, address || null, timezone || 'UTC', true];
    try {
      const result = await pool.query(insertQuery, values);
      return NextResponse.json({ site: result.rows[0], message: 'Site created successfully' });
    } catch (error) {
      console.error('Failed to create site:', error);
      return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to create site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}