import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { verifyToken } from '../../../lib/auth';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// GET - List schedules for a site
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const isActive = searchParams.get('active');
    
    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID required' },
        { status: 400 }
      );
    }
    
    // Fetch schedules and related data from local PostgreSQL
    let query = `SELECT * FROM schedules WHERE site_id = $1`;
    const values = [siteId];
    if (isActive !== null) {
      query += ' AND is_active = $2';
      values.push(isActive === 'true');
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, values);
    // Note: For full join with times/actions/executions, more queries or a view is needed
    return NextResponse.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new schedule
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const userData = verifyToken(token || '');
    if (!userData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const {
      site_id,
      name,
      description,
      schedule_type,
      start_date,
      end_date,
      timezone,
      times,
      actions,
      exceptions
    } = body;
    
    // Validate required fields
    if (!site_id || !name || !schedule_type || !start_date || !times || !actions) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Insert schedule
    const insertSchedule = `
      INSERT INTO schedules (site_id, name, description, schedule_type, start_date, end_date, timezone, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const scheduleValues = [site_id, name, description, schedule_type, start_date, end_date, timezone || 'America/Chicago', true, userData.userId];
    const scheduleResult = await pool.query(insertSchedule, scheduleValues);
    const schedule = scheduleResult.rows[0];

    // Insert schedule_times
    if (times && times.length > 0) {
      const timesQuery = `
        INSERT INTO schedule_times (schedule_id, time_of_day, days_of_week, days_of_month, months)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      for (const time of times) {
        await pool.query(timesQuery, [schedule.id, time.time_of_day, time.days_of_week, time.days_of_month, time.months]);
      }
    }

    // Insert schedule_actions
    if (actions && actions.length > 0) {
      const actionsQuery = `
        INSERT INTO schedule_actions (schedule_id, point_id, action_type, target_value, priority, sequence_order, delay_seconds)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      for (const [index, action] of actions.entries()) {
        await pool.query(actionsQuery, [schedule.id, action.point_id, action.action_type || 'write', action.target_value?.toString(), action.priority || 16, action.sequence_order || index, action.delay_seconds || 0]);
      }
    }

    // Insert schedule_exceptions
    if (exceptions && exceptions.length > 0) {
      const exceptionsQuery = `
        INSERT INTO schedule_exceptions (schedule_id, exception_date, exception_type, override_time, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      for (const exception of exceptions) {
        await pool.query(exceptionsQuery, [schedule.id, exception.date, exception.type, exception.override_time, exception.reason]);
      }
    }

    return NextResponse.json({ success: true, schedule });
    
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a schedule
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      );
    }
    
    // Update schedule
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    if (fields.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const updateQuery = `UPDATE schedules SET ${setClause} WHERE id = $1 RETURNING *;`;
    const result = await pool.query(updateQuery, [id, ...values]);
    return NextResponse.json({ success: true, schedule: result.rows[0] });
    
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a schedule
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      );
    }
    
  // Delete schedule
  await pool.query('DELETE FROM schedules WHERE id = $1', [id]);
  return NextResponse.json({ success: true, message: 'Schedule deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}