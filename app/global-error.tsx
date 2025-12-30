'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="zh-TW">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#111827' }}>
              發生錯誤
            </h1>
            <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
              應用程式發生未預期的錯誤
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              重試
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
