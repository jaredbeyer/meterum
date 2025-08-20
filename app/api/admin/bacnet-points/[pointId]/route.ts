import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyToken } from '../../../../../lib/auth';
import { isAdmin, logAdminAction } from '../../../../../lib/authorization';

// PUT - Update BACnet point display name (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { pointId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const userData = verifyToken(token || '');
    if (!userData || !isAdmin(userData.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const pointId = params.pointId;
    const body = await request.json();
    const { display_name } = body;

    if (!display_name) {
      return NextResponse.json(
        { error: 'Display name required' },
        { status: 400 }
      );
    }

    // Get current point data for audit log
    const { data: currentPoint } = await supabaseAdmin
      .from('bacnet_points')
      .select('display_name, object_name')
      .eq('id', pointId)
      .single();

    // Update the display name
    const { data: updatedPoint, error } = await supabaseAdmin
      .from('bacnet_points')
      .update({ display_name })
      .eq('id', pointId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update point:', error);
      return NextResponse.json(
        { error: 'Failed to update display name' },
        { status: 500 }
      );
    }

    // Log the admin action
    await logAdminAction(
      userData.userId,
      'UPDATE_POINT_DISPLAY_NAME',
      'bacnet_points',
      parseInt(pointId),
      { display_name: currentPoint?.display_name },
      { display_name },
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      point: updatedPoint
    });
    
  } catch (error) {
    console.error('Error updating point:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get point details (with display name)
export async function GET(
  request: NextRequest,
  { params }: { params: { pointId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pointId = params.pointId;
    
    const { data: point, error } = await supabaseAdmin
      .from('bacnet_points')
      .select(`
        *,
        bacnet_devices (
          device_name,
          device_instance,
          ip_address,
          site_id
        )
      `)
      .eq('id', pointId)
      .single();

    if (error || !point) {
      return NextResponse.json(
        { error: 'Point not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(point);
    
  } catch (error) {
    console.error('Error fetching point:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}