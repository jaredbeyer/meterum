import { NextRequest, NextResponse } from 'next/server';
import { refreshAuthToken, setAuthCookie, setRefreshCookie } from '../../../../lib/cookies';

export async function POST(request: NextRequest) {
  try {
    const tokens = await refreshAuthToken(request);
    
    if (!tokens) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }
    
    const response = NextResponse.json({ success: true });
    setAuthCookie(response, tokens.token);
    setRefreshCookie(response, tokens.refreshToken);
    
    return response;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}