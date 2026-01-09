'use client';

import { ChangePasswordForm } from './components/ChangePasswordForm';

/**
 * 安全設定頁面
 *
 * Feature 061: 密碼管理 (T024)
 */
export default function SecuritySettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">安全設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理您的帳戶安全選項
        </p>
      </div>

      {/* 變更密碼區塊 */}
      <div className="mb-6">
        <ChangePasswordForm />
      </div>

      {/* 未來可擴展的安全設定區塊 */}
      {/* 例如：雙因素認證、登入歷史、裝置管理等 */}
    </div>
  );
}
