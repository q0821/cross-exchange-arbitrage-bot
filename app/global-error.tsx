'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
