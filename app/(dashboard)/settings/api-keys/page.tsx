'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKeyDTO {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
}

/**
 * API Key 管理頁面
 */
export default function ApiKeysPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKeyDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 新增表單狀態
  const [exchange, setExchange] = useState('binance');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 載入 API Keys
  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to load API keys');
        return;
      }

      setApiKeys(data.data.apiKeys);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  // 新增 API Key
  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange,
          label,
          apiKey,
          apiSecret,
          passphrase: passphrase || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to add API key');
        setIsSubmitting(false);
        return;
      }

      // 清空表單
      setLabel('');
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowAddForm(false);

      // 重新載入列表
      await loadApiKeys();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除 API Key
  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('確定要刪除此 API Key 嗎？')) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to delete API key');
        return;
      }

      // 重新載入列表
      await loadApiKeys();
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  // 切換啟用狀態
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message || 'Failed to update API key');
        return;
      }

      // 重新載入列表
      await loadApiKeys();
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">API Key 管理</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showAddForm ? '取消' : '新增 API Key'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">新增 API Key</h2>
          <form onSubmit={handleAddApiKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                交易所
              </label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="binance">Binance</option>
                <option value="okx">OKX</option>
                <option value="bybit">Bybit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                標籤
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="例如：主帳戶、測試帳戶"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Secret
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            {exchange === 'okx' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passphrase (OKX 專用)
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '新增中...' : '新增'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {apiKeys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚未新增任何 API Key
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  交易所
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  標籤
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  API Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  狀態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {key.exchange.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {key.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                    {key.maskedKey}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        key.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {key.isActive ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => handleToggleActive(key.id, key.isActive)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {key.isActive ? '停用' : '啟用'}
                    </button>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
