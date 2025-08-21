import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from './cookies';
import { canAccessSite } from './authorization-helpers';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: number;
    username: string;
    role: string;
  };
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getAuthFromRequest(request);
  
  if (!auth) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      const { verifyToken } = await import('./auth');
      const legacyAuth = verifyToken(token);
      
      if (legacyAuth) {
        const req = request as AuthenticatedRequest;
        req.user = {
          userId: legacyAuth.userId,
          username: legacyAuth.username,
          role: legacyAuth.role
        };
        return handler(req);
      }
    }
    
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const req = request as AuthenticatedRequest;
  req.user = {
    userId: auth.userId,
    username: auth.username,
    role: auth.role
  };
  
  return handler(req);
}

export async function withSiteAccess(
  request: NextRequest,
  siteId: number,
  permission: 'view' | 'control' | 'schedule',
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const hasAccess = await canAccessSite(req.user.userId, siteId, permission);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return handler(req);
  });
}