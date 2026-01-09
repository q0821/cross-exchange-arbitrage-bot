/**
 * 密碼重設郵件模板 (Feature 061)
 */

export interface PasswordResetEmailData {
  resetUrl: string;
  expiryHours: number;
  userEmail: string;
}

/**
 * 產生密碼重設郵件的純文字版本
 */
export function getPasswordResetTextTemplate(data: PasswordResetEmailData): string {
  return `
您好，

您收到此郵件是因為您（或某人）請求重設您的 Arbitrage Platform 帳戶密碼。

請點擊以下連結重設您的密碼：
${data.resetUrl}

此連結將在 ${data.expiryHours} 小時後失效。

如果您沒有請求重設密碼，請忽略此郵件，您的密碼將保持不變。

為了您的帳戶安全，請勿將此連結分享給他人。

此致，
Arbitrage Platform 團隊
`.trim();
}

/**
 * 產生密碼重設郵件的 HTML 版本
 */
export function getPasswordResetHtmlTemplate(data: PasswordResetEmailData): string {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重設密碼</title>
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
      color: #1a1a2e;
      font-size: 24px;
      margin: 0;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #2563eb;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 0 4px 4px 0;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #eee;
      padding-top: 20px;
      margin-top: 30px;
    }
    .link-fallback {
      word-break: break-all;
      color: #666;
      font-size: 12px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 密碼重設請求</h1>
    </div>

    <div class="content">
      <p>您好，</p>
      <p>您收到此郵件是因為您（或某人）請求重設您的 <strong>Arbitrage Platform</strong> 帳戶密碼。</p>

      <div class="button-container">
        <a href="${data.resetUrl}" class="button">重設密碼</a>
      </div>

      <p class="link-fallback">
        如果按鈕無法點擊，請複製以下連結到瀏覽器：<br>
        ${data.resetUrl}
      </p>

      <div class="warning">
        <strong>⚠️ 注意事項：</strong>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>此連結將在 <strong>${data.expiryHours} 小時</strong>後失效</li>
          <li>如果您沒有請求重設密碼，請忽略此郵件</li>
          <li>請勿將此連結分享給他人</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>此郵件由系統自動發送，請勿直接回覆。</p>
      <p>© ${new Date().getFullYear()} Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * 產生密碼重設郵件
 */
export function generatePasswordResetEmail(data: PasswordResetEmailData) {
  return {
    subject: '[Arbitrage Platform] 密碼重設請求',
    text: getPasswordResetTextTemplate(data),
    html: getPasswordResetHtmlTemplate(data),
  };
}
