import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
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
    const { rows: existingNodes } = await sql`
      SELECT id, site_id, name, status FROM nodes WHERE node_id = ${nodeId}
    `;
    
    if (existingNodes.length > 0) {
      // Update existing node
      const node = existingNodes[0];
      await sql`
        UPDATE nodes 
        SET last_seen = CURRENT_TIMESTAMP,
            version = ${version || null},
            ip_address = ${ipAddress || null},
            status = 'active'
        WHERE node_id = ${nodeId}
      `;
      
      return NextResponse.json({
        nodeId,
        status: 'updated',
        siteId: node.site_id,
        name: node.name
      });
    } else {
      // Register new node
      const { rows: newNodes } = await sql`
        INSERT INTO nodes (node_id, version, ip_address, last_seen, status)
        VALUES (${nodeId}, ${version || null}, ${ipAddress || null}, CURRENT_TIMESTAMP, 'pending')
        RETURNING id
      `;
      
      return NextResponse.json({
        nodeId,
        status: 'registered',
        id: newNodes[0].id,
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