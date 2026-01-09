/**
 * 帳戶鎖定通知郵件模板 (Feature 061)
 */

export interface AccountLockedEmailData {
  userEmail: string;
  lockedUntil: Date;
  failedAttempts: number;
  ipAddress?: string;
  resetPasswordUrl: string;
}

/**
 * 格式化日期時間
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 產生帳戶鎖定通知郵件的純文字版本
 */
export function getAccountLockedTextTemplate(data: AccountLockedEmailData): string {
  return `
安全警告：您的帳戶已被暫時鎖定

您好，

您的 Arbitrage Platform 帳戶因多次登入失敗而被暫時鎖定。

鎖定詳情：
- 失敗嘗試次數：${data.failedAttempts} 次
- 鎖定至：${formatDateTime(data.lockedUntil)}
${data.ipAddress ? `- 最後嘗試 IP：${data.ipAddress}` : ''}

如果這不是您本人的操作，建議您：
1. 等待鎖定時間結束後立即變更密碼
2. 或立即透過以下連結重設密碼（重設成功後將自動解除鎖定）：
${data.resetPasswordUrl}

如果這是您本人的操作，請等待鎖定時間結束後重新登入。

為了保護您的帳戶安全，請使用強度較高的密碼。

此致，
Arbitrage Platform 安全團隊
`.trim();
}

/**
 * 產生帳戶鎖定通知郵件的 HTML 版本
 */
export function getAccountLockedHtmlTemplate(data: AccountLockedEmailData): string {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>帳戶安全警告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #dc2626;
      font-size: 24px;
      margin: 0;
    }
    .alert-box {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .alert-box h2 {
      color: #dc2626;
      font-size: 18px;
      margin: 0 0 15px 0;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .details-table td {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table td:first-child {
      color: #666;
      width: 140px;
    }
    .details-table td:last-child {
      font-weight: 500;
    }
    .button {
      display: inline-block;
      background-color: #dc2626;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #b91c1c;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .recommendations {
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .recommendations h3 {
      color: #334155;
      font-size: 16px;
      margin: 0 0 12px 0;
    }
    .recommendations ul {
      margin: 0;
      padding-left: 20px;
    }
    .recommendations li {
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #eee;
      padding-top: 20px;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 帳戶安全警告</h1>
    </div>

    <div class="alert-box">
      <h2>您的帳戶已被暫時鎖定</h2>
      <p>由於多次登入失敗，為了保護您的帳戶安全，我們已暫時鎖定您的帳戶。</p>

      <table class="details-table">
        <tr>
          <td>失敗嘗試次數</td>
          <td>${data.failedAttempts} 次</td>
        </tr>
        <tr>
          <td>鎖定至</td>
          <td>${formatDateTime(data.lockedUntil)}</td>
        </tr>
        ${
          data.ipAddress
            ? `
        <tr>
          <td>最後嘗試 IP</td>
          <td>${data.ipAddress}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    <div class="recommendations">
      <h3>建議採取的行動：</h3>
      <ul>
        <li>如果這<strong>不是您本人</strong>的操作，建議立即重設密碼</li>
        <li>如果這<strong>是您本人</strong>的操作，請等待鎖定時間結束後重新登入</li>
        <li>使用強度較高的密碼，包含大小寫字母、數字和特殊符號</li>
      </ul>
    </div>

    <div class="button-container">
      <a href="${data.resetPasswordUrl}" class="button">立即重設密碼</a>
      <p style="color: #666; font-size: 14px;">重設密碼成功後將自動解除帳戶鎖定</p>
    </div>

    <div class="footer">
      <p>此郵件由系統自動發送，請勿直接回覆。</p>
      <p>如有任何疑問，請聯繫我們的支援團隊。</p>
      <p>© ${new Date().getFullYear()} Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * 產生帳戶鎖定通知郵件
 */
export function generateAccountLockedEmail(data: AccountLockedEmailData) {
  return {
    subject: '[Arbitrage Platform] 安全警告：您的帳戶已被暫時鎖定',
    text: getAccountLockedTextTemplate(data),
    html: getAccountLockedHtmlTemplate(data),
  };
}
