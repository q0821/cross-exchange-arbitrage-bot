'use client';

import { useState, useEffect, useCallback } from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Webhook {
  id: string;
  platform: 'discord' | 'slack';
  name: string;
  isEnabled: boolean;
  threshold: number;
  notifyOnDisappear: boolean;  // Feature 027: 接收結束通知開關
  notificationMinutes: number[];  // 通知時間（每小時的第幾分鐘）
  createdAt: string;
  updatedAt: string;
}

interface WebhookFormData {
  platform: 'discord' | 'slack';
  webhookUrl: string;
  name: string;
  threshold: number;
  notifyOnDisappear: boolean;  // Feature 027: 接收結束通知開關
  notificationMinutes: number[];  // 通知時間（每小時的第幾分鐘）
}

// 可選的通知時間選項
const NOTIFICATION_MINUTE_OPTIONS = [30, 40, 45, 50, 55];

/**
 * 通知設定頁面
 * Feature 026: Discord/Slack 套利機會即時推送通知
 */
export default function NotificationsSettingsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  const [formData, setFormData] = useState<WebhookFormData>({
    platform: 'discord',
    webhookUrl: '',
    name: '',
    threshold: 800,
    notifyOnDisappear: true,  // Feature 027: 預設開啟結束通知
    notificationMinutes: [50],  // 預設 :50 分通知
  });

  // 載入 Webhooks
  const loadWebhooks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications/webhooks');
      const data = await response.json();

      if (data.success) {
        setWebhooks(data.data.webhooks);
      } else {
        setError(data.message || 'Failed to load webhooks');
      }
    } catch (err) {
      setError('Failed to load webhooks');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  // 新增 Webhook
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setShowForm(false);
        setFormData({ platform: 'discord', webhookUrl: '', name: '', threshold: 800, notifyOnDisappear: true, notificationMinutes: [50] });
        await loadWebhooks();
      } else {
        setError(data.message || 'Failed to create webhook');
      }
    } catch (err) {
      setError('Failed to create webhook');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 測試 Webhook
  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId);
    setTestResult(null);

    try {
      const response = await fetch(`/api/notifications/webhooks/${webhookId}/test`, {
        method: 'POST',
      });

      const data = await response.json();
      setTestResult({
        id: webhookId,
        success: data.success,
        message: data.message || (data.success ? '測試成功' : '測試失敗'),
      });
    } catch (err) {
      setTestResult({
        id: webhookId,
        success: false,
        message: '測試失敗：網路錯誤',
      });
      console.error(err);
    } finally {
      setTestingId(null);
    }
  };

  // 切換啟用狀態
  const handleToggle = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/notifications/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !webhook.isEnabled }),
      });

      const data = await response.json();

      if (data.success) {
        await loadWebhooks();
      } else {
        setError(data.message || 'Failed to update webhook');
      }
    } catch (err) {
      setError('Failed to update webhook');
      console.error(err);
    }
  };

  // 刪除 Webhook
  const handleDelete = async (webhookId: string) => {
    if (!confirm('確定要刪除此 Webhook 嗎？')) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await loadWebhooks();
      } else {
        setError(data.message || 'Failed to delete webhook');
      }
    } catch (err) {
      setError('Failed to delete webhook');
      console.error(err);
    }
  };

  // 更新 Webhook
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWebhook) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/notifications/webhooks/${editingWebhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          threshold: formData.threshold,
          webhookUrl: formData.webhookUrl || undefined,
          notifyOnDisappear: formData.notifyOnDisappear,  // Feature 027
          notificationMinutes: formData.notificationMinutes,  // 通知時間
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEditingWebhook(null);
        setFormData({ platform: 'discord', webhookUrl: '', name: '', threshold: 800, notifyOnDisappear: true, notificationMinutes: [50] });
        await loadWebhooks();
      } else {
        setError(data.message || 'Failed to update webhook');
      }
    } catch (err) {
      setError('Failed to update webhook');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 開始編輯
  const startEditing = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      platform: webhook.platform,
      webhookUrl: '',
      name: webhook.name,
      threshold: webhook.threshold,
      notifyOnDisappear: webhook.notifyOnDisappear,  // Feature 027
      notificationMinutes: webhook.notificationMinutes || [50],  // 通知時間
    });
    setShowForm(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
        <p className="mt-1 text-sm text-gray-600">
          設定 Discord 或 Slack Webhook 以接收套利機會通知
        </p>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 新增按鈕 */}
      {!showForm && !editingWebhook && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          新增 Webhook
        </button>
      )}

      {/* 新增表單 */}
      {showForm && (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">新增 Webhook</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                平台
              </label>
              <select
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value as 'discord' | 'slack' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="discord">Discord</option>
                <option value="slack">Slack</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder={
                  formData.platform === 'discord'
                    ? 'https://discord.com/api/webhooks/...'
                    : 'https://hooks.slack.com/services/...'
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名稱
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例：我的套利通知"
                required
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年化收益閾值 (%)
              </label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                min={0}
                max={10000}
                step={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                當年化收益超過此閾值時發送通知（預設 800%）
              </p>
            </div>

            {/* Feature 027: 接收結束通知開關 */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  接收結束通知
                </label>
                <p className="text-xs text-gray-500">
                  當套利機會費差低於閾值時發送結束通知
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, notifyOnDisappear: !formData.notifyOnDisappear })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.notifyOnDisappear ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.notifyOnDisappear ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 通知時間選擇 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                通知時間
              </label>
              <p className="text-xs text-gray-500 mb-2">
                每小時的第幾分鐘發送通知（可選 1-2 個時間點，結算通常在整點）
              </p>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_MINUTE_OPTIONS.map((minute) => {
                  const isSelected = formData.notificationMinutes.includes(minute);
                  const canSelect = isSelected || formData.notificationMinutes.length < 2;

                  return (
                    <button
                      key={minute}
                      type="button"
                      disabled={!canSelect && !isSelected}
                      onClick={() => {
                        if (isSelected) {
                          // 取消選擇（至少保留 1 個）
                          if (formData.notificationMinutes.length > 1) {
                            setFormData({
                              ...formData,
                              notificationMinutes: formData.notificationMinutes.filter(m => m !== minute)
                            });
                          }
                        } else if (canSelect) {
                          // 新增選擇
                          setFormData({
                            ...formData,
                            notificationMinutes: [...formData.notificationMinutes, minute].sort((a, b) => a - b)
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : canSelect
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      :{minute.toString().padStart(2, '0')}
                      <span className="text-xs ml-1 opacity-75">
                        (前{60 - minute}分)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? '建立中...' : '建立'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ platform: 'discord', webhookUrl: '', name: '', threshold: 800, notifyOnDisappear: true, notificationMinutes: [50] });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 編輯表單 */}
      {editingWebhook && (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">編輯 Webhook</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名稱
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新 Webhook URL（留空保持不變）
              </label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="留空保持現有 URL"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年化收益閾值 (%)
              </label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                min={0}
                max={10000}
                step={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Feature 027: 接收結束通知開關 */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  接收結束通知
                </label>
                <p className="text-xs text-gray-500">
                  當套利機會費差低於閾值時發送結束通知
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, notifyOnDisappear: !formData.notifyOnDisappear })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.notifyOnDisappear ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.notifyOnDisappear ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 通知時間選擇 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                通知時間
              </label>
              <p className="text-xs text-gray-500 mb-2">
                每小時的第幾分鐘發送通知（可選 1-2 個時間點，結算通常在整點）
              </p>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_MINUTE_OPTIONS.map((minute) => {
                  const isSelected = formData.notificationMinutes.includes(minute);
                  const canSelect = isSelected || formData.notificationMinutes.length < 2;

                  return (
                    <button
                      key={minute}
                      type="button"
                      disabled={!canSelect && !isSelected}
                      onClick={() => {
                        if (isSelected) {
                          // 取消選擇（至少保留 1 個）
                          if (formData.notificationMinutes.length > 1) {
                            setFormData({
                              ...formData,
                              notificationMinutes: formData.notificationMinutes.filter(m => m !== minute)
                            });
                          }
                        } else if (canSelect) {
                          // 新增選擇
                          setFormData({
                            ...formData,
                            notificationMinutes: [...formData.notificationMinutes, minute].sort((a, b) => a - b)
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : canSelect
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      :{minute.toString().padStart(2, '0')}
                      <span className="text-xs ml-1 opacity-75">
                        (前{60 - minute}分)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? '儲存中...' : '儲存'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingWebhook(null);
                  setFormData({ platform: 'discord', webhookUrl: '', name: '', threshold: 800, notifyOnDisappear: true, notificationMinutes: [50] });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhook 列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">已設定的 Webhooks</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : webhooks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚未設定任何 Webhook
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* 平台圖示 */}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        webhook.platform === 'discord'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {webhook.platform === 'discord' ? 'Discord' : 'Slack'}
                    </span>

                    <div>
                      <p className="font-medium text-gray-900">{webhook.name}</p>
                      <p className="text-sm text-gray-500">
                        閾值：{webhook.threshold}% | 通知時間：
                        {(webhook.notificationMinutes || [50]).map(m => `:${m.toString().padStart(2, '0')}`).join(', ')}
                        {' | '}狀態：
                        <span
                          className={
                            webhook.isEnabled ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {webhook.isEnabled ? '啟用' : '停用'}
                        </span>
                        {' | '}結束通知：
                        <span
                          className={
                            webhook.notifyOnDisappear ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {webhook.notifyOnDisappear ? '開' : '關'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* 測試結果 */}
                    {testResult?.id === webhook.id && (
                      <span
                        className={`text-sm ${
                          testResult.success ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {testResult.message}
                      </span>
                    )}

                    {/* 測試按鈕 */}
                    <button
                      onClick={() => handleTest(webhook.id)}
                      disabled={testingId === webhook.id}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    >
                      {testingId === webhook.id ? '測試中...' : '測試'}
                    </button>

                    {/* 啟用/停用 */}
                    <button
                      onClick={() => handleToggle(webhook)}
                      className={`px-3 py-1 text-sm rounded ${
                        webhook.isEnabled
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {webhook.isEnabled ? '停用' : '啟用'}
                    </button>

                    {/* 編輯 */}
                    <button
                      onClick={() => startEditing(webhook)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded"
                    >
                      編輯
                    </button>

                    {/* 刪除 */}
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 說明 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">如何取得 Webhook URL</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Discord：</strong>伺服器設定 → 整合 → Webhooks → 新 Webhook → 複製 Webhook URL
          </p>
          <p>
            <strong>Slack：</strong>Apps → Incoming Webhooks → Add New Webhook to Workspace → 複製 Webhook URL
          </p>
        </div>
      </div>
    </div>
  );
}
