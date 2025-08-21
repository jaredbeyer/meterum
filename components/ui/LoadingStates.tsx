import React from 'react';
import { AlertCircle, FileX, Loader2 } from 'lucide-react';

// Skeleton loader component
export function Skeleton({ 
  className = '',
  variant = 'text'
}: { 
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}) {
  const baseClass = 'animate-pulse bg-gray-200 rounded';
  const variantClass = {
    text: 'h-4 rounded',
    rect: 'rounded-md',
    circle: 'rounded-full'
  }[variant];

  return <div className={`${baseClass} ${variantClass} ${className}`} />;
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <Skeleton className="h-4 w-full max-w-xs" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Skeleton variant="circle" className="h-12 w-12" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// Loading spinner
export function LoadingSpinner({ 
  size = 'md',
  message = 'Loading...'
}: { 
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }[size];

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className={`${sizeClass} animate-spin text-blue-600`} />
      {message && (
        <p className="mt-4 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}

// Page loading state
export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" message="Loading page..." />
    </div>
  );
}

// Empty state component
export function EmptyState({
  icon: Icon = FileX,
  title = 'No data found',
  description,
  action
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="text-center py-12">
      <Icon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

// Error state component
export function ErrorState({
  title = 'Something went wrong',
  error,
  onRetry
}: {
  title?: string;
  error?: string | Error;
  onRetry?: () => void;
}) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="rounded-md bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          {errorMessage && (
            <div className="mt-2 text-sm text-red-700">
              <p>{errorMessage}</p>
            </div>
          )}
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="text-sm font-medium text-red-800 hover:text-red-700"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Data loading wrapper
export function DataLoader<T>({
  loading,
  error,
  data,
  children,
  skeleton,
  emptyState,
  errorState
}: {
  loading: boolean;
  error?: Error | string | null;
  data?: T | null;
  children: (data: T) => React.ReactNode;
  skeleton?: React.ReactNode;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
}) {
  if (loading) {
    return <>{skeleton || <LoadingSpinner />}</>;
  }

  if (error) {
    return <>{errorState || <ErrorState error={error} />}</>;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <>{emptyState || <EmptyState />}</>;
  }

  return <>{children(data)}</>;
}