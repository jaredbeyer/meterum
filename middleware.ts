import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthFromRequest, refreshAuthToken, setAuthCookie, setRefreshCookie } from './lib/cookies';
import { getCORSHeaders } from './lib/security-headers';

const publicPaths = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/nodes/ingest',
  '/login',
  '/',
  '/_next',
  '/favicon.ico'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCORSHeaders(request);
    return new NextResponse(null, { 
      status: 200,
      headers: corsHeaders
    });
  }
  
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(publicPath + '/')
  );
  
  // Add CORS headers to response
  const corsHeaders = getCORSHeaders(request);
  
  if (isPublicPath) {
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  
  let auth = await getAuthFromRequest(request);
  
  if (!auth) {
    const tokens = await refreshAuthToken(request);
    if (tokens) {
      const response = NextResponse.next();
      setAuthCookie(response, tokens.token);
      setRefreshCookie(response, tokens.refreshToken);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    
    if (path.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};