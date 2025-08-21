import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Redis client - use memory store in development
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// In-memory store for development/testing
class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async incr(key: string): Promise<number> {
    const now = Date.now();
    const data = this.store.get(key);
    
    if (!data || data.resetTime < now) {
      this.store.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return 1;
    }
    
    data.count++;
    return data.count;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const data = this.store.get(key);
    if (data) {
      data.resetTime = Date.now() + (seconds * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const memoryStore = new MemoryStore();

// Rate limiter configurations
export const rateLimiters = {
  // Strict limit for login attempts
  login: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
    prefix: 'login',
  }) : null,

  // General API rate limit
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'api',
  }) : null,

  // Sensitive operations (control, schedule changes)
  sensitive: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 operations per minute
    analytics: true,
    prefix: 'sensitive',
  }) : null,

  // Node ingestion - higher limit
  ingest: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 requests per minute
    analytics: true,
    prefix: 'ingest',
  }) : null,
};

// Memory-based rate limiting for development
export async function checkMemoryRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<{ success: boolean; remaining: number }> {
  const key = `ratelimit:${identifier}`;
  const count = await memoryStore.incr(key);
  
  if (count > limit) {
    return { success: false, remaining: 0 };
  }
  
  return { success: true, remaining: limit - count };
}

// Get identifier from request
export function getRateLimitIdentifier(request: NextRequest): string {
  // Try to get user ID from auth
  const authCookie = request.cookies.get('auth-token');
  if (authCookie) {
    return `user:${authCookie.value.substring(0, 20)}`; // Use partial token as ID
  }
  
  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0] : 
    request.headers.get('x-real-ip') || 
    request.ip || 
    'unknown';
  
  return `ip:${ip}`;
}

// Rate limit middleware
export async function withRateLimit(
  request: NextRequest,
  limiterType: keyof typeof rateLimiters = 'api',
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const identifier = getRateLimitIdentifier(request);
  const limiter = rateLimiters[limiterType];
  
  if (limiter) {
    // Use Upstash rate limiter if available
    const { success, limit, reset, remaining } = await limiter.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          retryAfter: Math.floor((reset - Date.now()) / 1000) 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': Math.floor((reset - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    const response = await handler();
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());
    
    return response;
  } else {
    // Use memory-based rate limiting in development
    const limits = {
      login: { limit: 5, window: 900000 }, // 5 per 15 min
      api: { limit: 100, window: 60000 }, // 100 per min
      sensitive: { limit: 20, window: 60000 }, // 20 per min
      ingest: { limit: 1000, window: 60000 }, // 1000 per min
    };
    
    const config = limits[limiterType];
    const { success, remaining } = await checkMemoryRateLimit(
      `${limiterType}:${identifier}`,
      config.limit,
      config.window
    );
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          retryAfter: Math.floor(config.window / 1000) 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': Math.floor(config.window / 1000).toString(),
          }
        }
      );
    }
    
    const response = await handler();
    response.headers.set('X-RateLimit-Limit', config.limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    
    return response;
  }
}

// Exponential backoff for failed login attempts
export async function trackFailedLogin(identifier: string): Promise<void> {
  if (redis) {
    const key = `failed_login:${identifier}`;
    await redis.incr(key);
    await redis.expire(key, 900); // 15 minutes
  } else {
    await memoryStore.incr(`failed_login:${identifier}`);
  }
}

export async function getFailedLoginCount(identifier: string): Promise<number> {
  if (redis) {
    const count = await redis.get(`failed_login:${identifier}`);
    return count ? parseInt(count as string) : 0;
  } else {
    const key = `failed_login:${identifier}`;
    return (await memoryStore.incr(key)) - 1;
  }
}

export async function clearFailedLogins(identifier: string): Promise<void> {
  if (redis) {
    await redis.del(`failed_login:${identifier}`);
  } else {
    await memoryStore.del(`failed_login:${identifier}`);
  }
}