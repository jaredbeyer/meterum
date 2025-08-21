import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '../../../../lib/auth';
import { createToken, createRefreshToken, setAuthCookie, setRefreshCookie } from '../../../../lib/cookies';
import { loginSchema } from '../../../../lib/validation/schemas';
import { validateBody, validationErrorResponse } from '../../../../lib/validation/validate';
import { withRateLimit, getRateLimitIdentifier, trackFailedLogin, getFailedLoginCount, clearFailedLogins } from '../../../../lib/rate-limit';

export async function POST(request: NextRequest) {
  return withRateLimit(request, 'login', async () => {
    try {
      const identifier = getRateLimitIdentifier(request);
    const validation = await validateBody(request, loginSchema);
    
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }
    
      const { username, password } = validation.data!;
      
      // Check failed login attempts for exponential backoff
      const failedAttempts = await getFailedLoginCount(identifier);
      if (failedAttempts >= 10) {
        return NextResponse.json(
          { error: 'Account temporarily locked. Please try again later.' },
          { status: 429 }
        );
      }
      
      const result = await authenticateUser(username, password);
      
      if (result.success) {
        // Clear failed login attempts on success
        await clearFailedLogins(identifier);
      const token = await createToken({
        userId: result.user!.id,
        username: result.user!.username,
        role: result.user!.role
      });
      
      const refreshToken = await createRefreshToken({
        userId: result.user!.id,
        username: result.user!.username,
        role: result.user!.role
      });
      
      const response = NextResponse.json({
        user: result.user,
        token: result.token
      });
      
      setAuthCookie(response, token);
      setRefreshCookie(response, refreshToken);
      
        return response;
      } else {
        // Track failed login attempt
        await trackFailedLogin(identifier);
        
        return NextResponse.json(
          { error: result.error },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}