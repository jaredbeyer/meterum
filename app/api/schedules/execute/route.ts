import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyToken } from '../../../../lib/auth';

// POST - Execute a schedule (manual trigger or system trigger)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduleId, isManual = false } = body;
    
    // For system triggers, verify API key
    // For manual triggers, verify user token
    if (!isManual) {
      const apiKey = request.headers.get('x-api-key');
      if (apiKey !== process.env.SYSTEM_API_KEY) {
        return NextResponse.json(
          { error: 'Invalid system API key' },
          { status: 401 }
        );
      }
    } else {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token || !verifyToken(token)) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      );
    }
    
    // Get schedule with actions
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('schedules')
      .select(`
        *,
        schedule_actions (
          *,
          bacnet_points (
            *,
            bacnet_devices (
              *
            )
          )
        )
      `)
      .eq('id', scheduleId)
      .single();
    
    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }
    
    // Check if schedule is active
    if (!schedule.is_active && !isManual) {
      return NextResponse.json(
        { error: 'Schedule is not active' },
        { status: 400 }
      );
    }
    
    // Create execution record
    const { data: execution, error: executionError } = await supabaseAdmin
      .from('schedule_executions')
      .insert({
        schedule_id: scheduleId,
        scheduled_time: new Date().toISOString(),
        execution_time: new Date().toISOString(),
        status: 'running'
      })
      .select()
      .single();
    
    if (executionError) {
      console.error('Failed to create execution record:', executionError);
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }
    
    // Sort actions by sequence order
    const sortedActions = schedule.schedule_actions.sort(
      (a: any, b: any) => a.sequence_order - b.sequence_order
    );
    
    let actionsExecuted = 0;
    let actionsFailed = 0;
    const results = [];
    
    // Execute each action
    for (const action of sortedActions) {
      // Add delay if specified
      if (action.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, action.delay_seconds * 1000));
      }
      
      try {
        // Create control command
        const { data: command, error: commandError } = await supabaseAdmin
          .from('control_commands')
          .insert({
            point_id: action.point_id,
            site_id: schedule.site_id,
            command_type: action.action_type.toUpperCase(),
            target_value: action.target_value,
            priority: action.priority,
            status: 'pending',
            requested_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (commandError) {
          throw commandError;
        }
        
        // Record action result
        await supabaseAdmin
          .from('schedule_action_results')
          .insert({
            execution_id: execution.id,
            action_id: action.id,
            command_id: command.id,
            status: 'sent',
            executed_at: new Date().toISOString()
          });
        
        actionsExecuted++;
        results.push({
          action_id: action.id,
          point_name: action.bacnet_points.object_name,
          status: 'sent',
          command_id: command.id
        });
        
      } catch (error) {
        console.error(`Failed to execute action ${action.id}:`, error);
        actionsFailed++;
        
        // Record failure
        await supabaseAdmin
          .from('schedule_action_results')
          .insert({
            execution_id: execution.id,
            action_id: action.id,
            status: 'failed',
            error_message: String(error),
            executed_at: new Date().toISOString()
          });
        
        results.push({
          action_id: action.id,
          point_name: action.bacnet_points?.object_name || 'Unknown',
          status: 'failed',
          error: String(error)
        });
      }
    }
    
    // Update execution record
    await supabaseAdmin
      .from('schedule_executions')
      .update({
        status: actionsFailed === 0 ? 'completed' : 'partial',
        actions_executed: actionsExecuted,
        actions_failed: actionsFailed
      })
      .eq('id', execution.id);
    
    return NextResponse.json({
      success: true,
      execution_id: execution.id,
      actions_executed: actionsExecuted,
      actions_failed: actionsFailed,
      results
    });
    
  } catch (error) {
    console.error('Error executing schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get execution history for a schedule
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
    const scheduleId = searchParams.get('scheduleId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      );
    }
    
    const { data: executions, error } = await supabaseAdmin
      .from('schedule_executions')
      .select(`
        *,
        schedule_action_results (
          *,
          schedule_actions (
            *,
            bacnet_points (
              object_name,
              description
            )
          )
        )
      `)
      .eq('schedule_id', scheduleId)
      .order('scheduled_time', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to fetch execution history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch execution history' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(executions || []);
    
  } catch (error) {
    console.error('Error fetching execution history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}