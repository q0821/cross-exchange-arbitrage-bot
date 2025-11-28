import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#111827' }}>
          {statusCode || '錯誤'}
        </h1>
        <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#6b7280' }}>
          {statusCode === 404 ? '頁面不存在' : '發生錯誤'}
        </p>
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
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
