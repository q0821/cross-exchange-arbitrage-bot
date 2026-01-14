/**
 * React Query Test Utilities
 *
 * Provides helper functions for testing components that use TanStack Query.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

/**
 * Create a fresh QueryClient for testing
 * Configured with:
 * - No retries (fail fast in tests)
 * - No cache time (avoid test interference)
 * - Disabled logging (cleaner test output)
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

/**
 * Create a wrapper component with QueryClientProvider
 * Usage: const { wrapper } = createWrapper();
 */
export function createWrapper() {
  const testQueryClient = createTestQueryClient();

  const wrapper = ({ children }: WrapperProps) => (
    <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient: testQueryClient };
}

/**
 * Custom render function that wraps components with QueryClientProvider
 * Automatically provides a fresh QueryClient for each test
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const { wrapper, queryClient } = createWrapper();

  return {
    ...render(ui, { wrapper, ...options }),
    queryClient,
  };
}

/**
 * Wait for query to settle (loading → success/error)
 * Useful when testing async query behavior
 */
export async function waitForQueryToSettle(ms = 100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock fetch response helper
 * Returns a properly formatted Response object for mocking fetch
 */
export function mockFetchResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mock fetch error response
 */
export function mockFetchError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
