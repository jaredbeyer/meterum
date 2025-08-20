import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/auth';

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
    
    let query = supabaseAdmin
      .from('schedules')
      .select(`
        *,
        schedule_times (
          id,
          time_of_day,
          days_of_week,
          days_of_month,
          months
        ),
        schedule_actions (
          id,
          action_type,
          target_value,
          priority,
          sequence_order,
          delay_seconds,
          bacnet_points (
            id,
            object_name,
            description,
            units,
            point_category
          )
        ),
        schedule_executions (
          id,
          scheduled_time,
          execution_time,
          status,
          actions_executed,
          actions_failed
        )
      `)
      .eq('site_id', siteId)
      .order('name', { ascending: true });
    
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    
    const { data: schedules, error } = await query;
    
    if (error) {
      console.error('Failed to fetch schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }
    
    // Get next execution time for each schedule
    const schedulesWithNext = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { data: nextExec } = await supabaseAdmin
          .rpc('get_next_execution_time', { schedule_id: schedule.id });
        
        // Get last execution
        const lastExecution = schedule.schedule_executions
          ?.filter((e: any) => e.status === 'completed')
          ?.sort((a: any, b: any) => new Date(b.execution_time).getTime() - new Date(a.execution_time).getTime())[0];
        
        return {
          ...schedule,
          next_execution: nextExec,
          last_execution: lastExecution
        };
      })
    );
    
    return NextResponse.json(schedulesWithNext);
    
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
    
    // Start transaction
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('schedules')
      .insert({
        site_id,
        name,
        description,
        schedule_type,
        start_date,
        end_date,
        timezone: timezone || 'America/Chicago',
        is_active: true,
        created_by: userData.userId
      })
      .select()
      .single();
    
    if (scheduleError) {
      console.error('Failed to create schedule:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to create schedule' },
        { status: 500 }
      );
    }
    
    // Insert schedule times
    if (times && times.length > 0) {
      const timesData = times.map((time: any) => ({
        schedule_id: schedule.id,
        time_of_day: time.time_of_day,
        days_of_week: time.days_of_week,
        days_of_month: time.days_of_month,
        months: time.months
      }));
      
      const { error: timesError } = await supabaseAdmin
        .from('schedule_times')
        .insert(timesData);
      
      if (timesError) {
        console.error('Failed to create schedule times:', timesError);
      }
    }
    
    // Insert schedule actions
    if (actions && actions.length > 0) {
      const actionsData = actions.map((action: any, index: number) => ({
        schedule_id: schedule.id,
        point_id: action.point_id,
        action_type: action.action_type || 'write',
        target_value: action.target_value?.toString(),
        priority: action.priority || 16,
        sequence_order: action.sequence_order || index,
        delay_seconds: action.delay_seconds || 0
      }));
      
      const { error: actionsError } = await supabaseAdmin
        .from('schedule_actions')
        .insert(actionsData);
      
      if (actionsError) {
        console.error('Failed to create schedule actions:', actionsError);
      }
    }
    
    // Insert exceptions if provided
    if (exceptions && exceptions.length > 0) {
      const exceptionsData = exceptions.map((exception: any) => ({
        schedule_id: schedule.id,
        exception_date: exception.date,
        exception_type: exception.type,
        override_time: exception.override_time,
        reason: exception.reason
      }));
      
      const { error: exceptionsError } = await supabaseAdmin
        .from('schedule_exceptions')
        .insert(exceptionsData);
      
      if (exceptionsError) {
        console.error('Failed to create schedule exceptions:', exceptionsError);
      }
    }
    
    return NextResponse.json({
      success: true,
      schedule
    });
    
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
    
    const { data: schedule, error } = await supabaseAdmin
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Failed to update schedule:', error);
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      schedule
    });
    
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
    
    const { error } = await supabaseAdmin
      .from('schedules')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Failed to delete schedule:', error);
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}