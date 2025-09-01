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
    
  const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
  return NextResponse.json({ customers: result.rows });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
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
    const { name, contact_email, contact_phone, address } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO customers (name, contact_email, contact_phone, address, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [name, contact_email || null, contact_phone || null, address || null, true];
    try {
      const result = await pool.query(insertQuery, values);
      return NextResponse.json({ customer: result.rows[0], message: 'Customer created successfully' });
    } catch (error) {
      console.error('Failed to create customer:', error);
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to create customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}