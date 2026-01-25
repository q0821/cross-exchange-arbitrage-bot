import { isServer, QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

/**
 * Extract error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  // Standard Error instance
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Object with message property (common pattern)
  if (error && typeof error === 'object') {
    // Check for message property
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    // Check for error property (API response format)
    if ('error' in error) {
      const errorProp = (error as { error: unknown }).error;
      if (typeof errorProp === 'string') {
        return errorProp;
      }
      if (errorProp && typeof errorProp === 'object' && 'message' in errorProp) {
        return String((errorProp as { message: unknown }).message);
      }
    }
    // Try to stringify the object
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error (non-serializable)';
    }
  }

  return 'Unknown error';
}

/**
 * Global error handler for TanStack Query
 * Feature 063: Frontend Data Caching (T040)
 */
function handleQueryError(error: unknown, query?: unknown) {
  const errorMessage = extractErrorMessage(error);

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[TanStack Query] Error:', errorMessage, { query, error });
  }

  // Handle 401 authentication errors - redirect to login page
  if (
    errorMessage.includes('401') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Token has expired') ||
    errorMessage.includes('INVALID_TOKEN')
  ) {
    // Only redirect on client-side
    if (!isServer) {
      // Avoid redirect loops on auth-related pages
      const currentPath = window.location.pathname;
      const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      if (!authPaths.some((path) => currentPath.startsWith(path))) {
        window.location.href = '/login';
      }
    }
    return;
  }

  // Log other errors for monitoring (could integrate with Sentry/etc.)
  console.warn('[TanStack Query] Request failed:', errorMessage);
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleQueryError,
    }),
    defaultOptions: {
      queries: {
        // Default: 1 minute stale time
        staleTime: 60 * 1000,
        // Default: 10 minutes garbage collection time
        gcTime: 10 * 60 * 1000,
        // Retry failed queries up to 2 times
        retry: 2,
        // Refetch when window regains focus
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data is fresh
        refetchOnMount: 'always',
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get the QueryClient instance.
 * - Server: Creates a new instance per request (avoids cross-request state pollution)
 * - Browser: Reuses a singleton instance (maintains cache across navigations)
 */
export function getQueryClient() {
  if (isServer) {
    // Server: Always create a new QueryClient
    return makeQueryClient();
  }

  // Browser: Reuse the same QueryClient
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
