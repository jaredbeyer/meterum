import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { commandId, status, responseValue, errorMessage, executedAt } = body;
    
    if (!commandId || !status) {
      return NextResponse.json(
        { error: 'Command ID and status required' },
        { status: 400 }
      );
    }
    
    // Update command status
    const { data: command, error: updateError } = await supabaseAdmin
      .from('control_commands')
      .update({
        status,
        response_value: responseValue?.toString(),
        error_message: errorMessage,
        executed_at: executedAt || new Date().toISOString()
      })
      .eq('id', commandId)
      .select(`
        *,
        bacnet_points (
          id,
          object_name
        )
      `)
      .single();
    
    if (updateError) {
      console.error('Failed to update command status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update command status' },
        { status: 500 }
      );
    }
    
    // If successful WRITE command, update the point's present value
    if (status === 'completed' && command.command_type === 'WRITE' && responseValue !== undefined) {
      await supabaseAdmin
        .from('bacnet_points')
        .update({
          present_value: responseValue.toString(),
          last_updated: new Date().toISOString()
        })
        .eq('id', command.point_id);
      
      // Add to point history
      await supabaseAdmin
        .from('point_history')
        .insert({
          point_id: command.point_id,
          value: responseValue.toString(),
          changed_by: 'control_command',
          command_id: commandId,
          timestamp: new Date().toISOString()
        });
    }
    
    return NextResponse.json({
      success: true,
      message: `Command ${commandId} marked as ${status}`
    });
    
  } catch (error) {
    console.error('Error updating command result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}