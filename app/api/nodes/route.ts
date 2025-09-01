import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../../../lib/auth';

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch all nodes from local PostgreSQL
    const result = await pool.query('SELECT * FROM nodes ORDER BY created_at DESC');
    return NextResponse.json({
      nodes: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}