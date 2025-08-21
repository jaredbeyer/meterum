import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '../../../../lib/cookies';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}