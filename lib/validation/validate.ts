import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Validates request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: [{ field: 'body', message: 'Invalid JSON body' }] 
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, string> = {};
    
    searchParams.forEach((value, key) => {
      query[key] = value;
    });
    
    const data = schema.parse(query);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: [{ field: 'query', message: 'Invalid query parameters' }] 
    };
  }
}

/**
 * Validates route parameters against a Zod schema
 */
export function validateParams<T>(
  params: any,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: [{ field: 'params', message: 'Invalid route parameters' }] 
    };
  }
}

/**
 * Creates a validation error response
 */
export function validationErrorResponse(errors: ValidationError[]): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: errors
    },
    { status: 400 }
  );
}

/**
 * Wrapper to validate request and handle errors
 */
export async function withValidation<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  handler: (data: T, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const validation = await validateBody(request, schema);
  
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }
  
  return handler(validation.data!, request);
}

/**
 * Combined validation for body, query, and params
 */
export async function validateRequest<B = any, Q = any, P = any>(
  request: NextRequest,
  schemas: {
    body?: ZodSchema<B>;
    query?: ZodSchema<Q>;
    params?: ZodSchema<P>;
  },
  params?: any
): Promise<{
  success: boolean;
  body?: B;
  query?: Q;
  params?: P;
  errors?: ValidationError[];
}> {
  const errors: ValidationError[] = [];
  let bodyData: B | undefined;
  let queryData: Q | undefined;
  let paramsData: P | undefined;
  
  // Validate body if schema provided
  if (schemas.body) {
    const bodyValidation = await validateBody(request, schemas.body);
    if (!bodyValidation.success) {
      errors.push(...bodyValidation.errors!);
    } else {
      bodyData = bodyValidation.data;
    }
  }
  
  // Validate query if schema provided
  if (schemas.query) {
    const queryValidation = validateQuery(request, schemas.query);
    if (!queryValidation.success) {
      errors.push(...queryValidation.errors!);
    } else {
      queryData = queryValidation.data;
    }
  }
  
  // Validate params if schema provided
  if (schemas.params && params) {
    const paramsValidation = validateParams(params, schemas.params);
    if (!paramsValidation.success) {
      errors.push(...paramsValidation.errors!);
    } else {
      paramsData = paramsValidation.data;
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    body: bodyData,
    query: queryData,
    params: paramsData
  };
}