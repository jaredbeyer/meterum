import { NextRequest } from 'next/server';

export interface SecurityConfig {
  allowedOrigins: string[];
  isDevelopment: boolean;
}

export function getSecurityConfig(): SecurityConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Define allowed origins based on environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : isDevelopment
      ? ['http://localhost:3000', 'http://localhost:3001']
      : ['https://meterum.com', 'https://www.meterum.com'];
  
  return {
    allowedOrigins,
    isDevelopment
  };
}

export function getCORSHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const { allowedOrigins, isDevelopment } = getSecurityConfig();
  
  // Check if origin is allowed
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) ||
    (isDevelopment && origin.startsWith('http://localhost'))
  );
  
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
  
  if (isAllowedOrigin && origin) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return corsHeaders;
}

export function getSecurityHeaders(nonce?: string) {
  const { isDevelopment } = getSecurityConfig();
  
  // Content Security Policy
  const cspDirectives = [
    `default-src 'self'`,
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : isDevelopment ? "'unsafe-inline'" : "'none'"} 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://api.meterum.com wss://meterum.com ${isDevelopment ? 'ws://localhost:*' : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].filter(Boolean).join('; ');
  
  return {
    'Content-Security-Policy': cspDirectives,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    ...(isDevelopment ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  };
}