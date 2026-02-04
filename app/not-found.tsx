'use client';

/**
 * Root Not Found Page
 *
 * 處理未被 middleware 匹配的路由（如無效的 locale）
 * 必須是 Client Component 並包含完整的 HTML 結構
 *
 * @see https://next-intl.dev/docs/environments/error-files
 */
export default function NotFound() {
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
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#111827' }}>404</h1>
            <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#6b7280' }}>頁面不存在</p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                textDecoration: 'none'
              }}
            >
              返回首頁
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
