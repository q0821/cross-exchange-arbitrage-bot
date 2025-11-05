'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKeyDTO {
  id: string;
  exchange: string;
  environment: string;
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

  // 編輯表單狀態
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyDTO | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // 新增表單狀態
  const [exchange, setExchange] = useState('binance');
  const [environment, setEnvironment] = useState<'MAINNET' | 'TESTNET'>('TESTNET');
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
          environment,
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

  // 開啟編輯對話框
  const handleOpenEdit = (key: ApiKeyDTO) => {
    setEditingKey(key);
    setEditLabel(key.label);
    setShowEditModal(true);
    setError('');
  };

  // 提交編輯
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    setError('');
    setIsEditSubmitting(true);

    try {
      const response = await fetch(`/api/api-keys/${editingKey.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: editLabel }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to update API key');
        setIsEditSubmitting(false);
        return;
      }

      // 關閉對話框並重新載入列表
      setShowEditModal(false);
      setEditingKey(null);
      await loadApiKeys();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsEditSubmitting(false);
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
                name="exchange"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="binance">Binance</option>
                <option value="okx">OKX</option>
                <option value="bybit">Bybit</option>
                <option value="mexc">MEXC</option>
                <option value="gateio">Gate.io</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                環境
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="environment"
                    value="MAINNET"
                    checked={environment === 'MAINNET'}
                    onChange={(e) => setEnvironment(e.target.value as 'MAINNET' | 'TESTNET')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">主網（真實交易）</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="environment"
                    value="TESTNET"
                    checked={environment === 'TESTNET'}
                    onChange={(e) => setEnvironment(e.target.value as 'MAINNET' | 'TESTNET')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">測試網（Demo Trading）</span>
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                ⚠️ 重要：主網和測試網的 API Key 來自不同平台，創建後無法修改環境設定
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                標籤
              </label>
              <input
                name="label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="例如：主帳戶、備用帳戶"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                name="apiKey"
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
                name="apiSecret"
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
                  name="passphrase"
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
                  環境
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        key.environment === 'MAINNET'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {key.environment === 'MAINNET' ? '主網' : '測試網'}
                    </span>
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
                      onClick={() => handleOpenEdit(key)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      編輯
                    </button>
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

      {/* 編輯對話框 */}
      {showEditModal && editingKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">編輯 API Key</h2>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  交易所
                </label>
                <input
                  type="text"
                  value={editingKey.exchange.toUpperCase()}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  環境
                </label>
                <input
                  type="text"
                  value={editingKey.environment === 'MAINNET' ? '主網（真實交易）' : '測試網（Demo Trading）'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
                <p className="mt-1 text-sm text-gray-500">
                  環境設定在創建時已固定，無法修改
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  標籤
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="例如：主帳戶、備用帳戶"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingKey(null);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={isEditSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {isEditSubmitting ? '儲存中...' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
