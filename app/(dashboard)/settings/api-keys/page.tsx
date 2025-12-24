'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectionTestResponse, ValidationErrorCode } from '@/src/types/api-key-validation';

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

// Connection test result state
interface ConnectionTestResult {
  isValid: boolean;
  hasReadPermission: boolean;
  hasTradePermission: boolean;
  error?: {
    code: ValidationErrorCode;
    message: string;
  };
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

  // 連線測試狀態 (T019-T022)
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(null);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 連線測試超時設定：20 秒 (T020)
  const CONNECTION_TEST_TIMEOUT_MS = 20000;

  // 重新測試狀態 (T033-T036)
  const [revalidatingKeyId, setRevalidatingKeyId] = useState<string | null>(null);
  const [revalidateResult, setRevalidateResult] = useState<{
    keyId: string;
    result: ConnectionTestResult;
  } | null>(null);

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

  // 連線測試 (T020)
  const handleTestConnection = async () => {
    // 防止重複請求 (T022)
    if (isTestingConnection) return;

    // 驗證必填欄位
    if (!apiKey || !apiSecret) {
      setError('請填入 API Key 和 API Secret');
      return;
    }

    // OKX 需要 passphrase
    if (exchange === 'okx' && !passphrase) {
      setError('OKX 需要填入 Passphrase');
      return;
    }

    setError('');
    setConnectionTestResult(null);
    setIsTestingConnection(true);

    // 創建 AbortController 用於超時處理 (T020)
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, CONNECTION_TEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/api-keys/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange,
          environment,
          apiKey,
          apiSecret,
          passphrase: passphrase || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      const data: ConnectionTestResponse = await response.json();

      if (data.data) {
        setConnectionTestResult({
          isValid: data.data.isValid,
          hasReadPermission: data.data.hasReadPermission,
          hasTradePermission: data.data.hasTradePermission,
          error: data.error,
        });
      } else if (data.error) {
        setConnectionTestResult({
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: data.error,
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        setConnectionTestResult({
          isValid: false,
          hasReadPermission: false,
          hasTradePermission: false,
          error: {
            code: 'TIMEOUT',
            message: '連線測試超時，請稍後再試',
          },
        });
      } else {
        setError('連線測試失敗，請稍後再試');
      }
    } finally {
      setIsTestingConnection(false);
      abortControllerRef.current = null;
    }
  };

  // 新增 API Key (含警告確認) (T023)
  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    // 如果測試失敗且尚未確認，顯示警告
    if (connectionTestResult && !connectionTestResult.isValid && !showSaveWarning) {
      setShowSaveWarning(true);
      return;
    }

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

      // 清空表單和測試狀態
      setLabel('');
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowAddForm(false);
      setConnectionTestResult(null);
      setShowSaveWarning(false);

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

  // 重新測試已儲存的 API Key (T034)
  const handleRevalidate = async (keyId: string) => {
    // 防止重複請求
    if (revalidatingKeyId) return;

    setRevalidatingKeyId(keyId);
    setRevalidateResult(null);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CONNECTION_TEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/api-keys/${keyId}/test`, {
        method: 'POST',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: ConnectionTestResponse = await response.json();

      if (data.data) {
        setRevalidateResult({
          keyId,
          result: {
            isValid: data.data.isValid,
            hasReadPermission: data.data.hasReadPermission,
            hasTradePermission: data.data.hasTradePermission,
            error: data.error,
          },
        });

        // 成功時重新載入列表以更新 lastValidatedAt (T036)
        if (data.data.isValid) {
          await loadApiKeys();
        }
      } else if (data.error) {
        setRevalidateResult({
          keyId,
          result: {
            isValid: false,
            hasReadPermission: false,
            hasTradePermission: false,
            error: data.error,
          },
        });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        setRevalidateResult({
          keyId,
          result: {
            isValid: false,
            hasReadPermission: false,
            hasTradePermission: false,
            error: {
              code: 'TIMEOUT',
              message: '連線測試超時，請稍後再試',
            },
          },
        });
      } else {
        setError('重新測試失敗，請稍後再試');
      }
    } finally {
      setRevalidatingKeyId(null);
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

            {/* 測試連線按鈕 (T019) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !apiKey || !apiSecret}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isTestingConnection ? '測試中...' : '測試連線'}
              </button>
            </div>

            {/* 測試結果顯示 (T021) */}
            {connectionTestResult && (
              <div
                className={`p-4 rounded-md ${
                  connectionTestResult.isValid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span
                    className={`text-lg font-medium ${
                      connectionTestResult.isValid ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {connectionTestResult.isValid ? '✓ 連線成功' : '✗ 連線失敗'}
                  </span>
                </div>
                {connectionTestResult.isValid ? (
                  <div className="text-sm text-green-700 space-y-1">
                    <div>讀取權限：{connectionTestResult.hasReadPermission ? '✓' : '✗'}</div>
                    <div>
                      交易權限：
                      {connectionTestResult.hasTradePermission
                        ? '✓'
                        : exchange === 'gateio' || exchange === 'mexc'
                          ? '⚠️ 無法驗證'
                          : '✗'}
                    </div>
                    {(exchange === 'gateio' || exchange === 'mexc') && (
                      <div className="text-gray-500 text-xs mt-1">
                        注意：{exchange === 'gateio' ? 'Gate.io' : 'MEXC'} 無法驗證交易權限，請確認 API Key 已開啟交易權限
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-700">
                    {connectionTestResult.error?.message || '未知錯誤'}
                  </div>
                )}
              </div>
            )}

            {/* 儲存警告確認 (T023) */}
            {showSaveWarning && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-yellow-800 font-medium mb-2">
                  ⚠️ 連線測試失敗
                </div>
                <p className="text-sm text-yellow-700 mb-3">
                  連線測試未通過，仍要儲存此 API Key 嗎？儲存後可能無法正常使用。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveWarning(false)}
                    className="px-3 py-1 text-sm border border-yellow-300 text-yellow-800 rounded hover:bg-yellow-100"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-yellow-300"
                  >
                    {isSubmitting ? '儲存中...' : '仍要儲存'}
                  </button>
                </div>
              </div>
            )}

            {/* 新增按鈕 */}
            {!showSaveWarning && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '新增中...' : '新增'}
              </button>
            )}
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
                <React.Fragment key={key.id}>
                <tr>
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
                    {/* 重新測試按鈕 (T033) */}
                    <button
                      onClick={() => handleRevalidate(key.id)}
                      disabled={revalidatingKeyId === key.id}
                      className="text-green-600 hover:text-green-800 disabled:text-green-300 disabled:cursor-not-allowed"
                    >
                      {revalidatingKeyId === key.id ? '測試中...' : '測試'}
                    </button>
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
                {/* 重新測試結果顯示 (T035) */}
                {revalidateResult?.keyId === key.id && (
                  <tr>
                    <td colSpan={6} className="px-6 py-2">
                      <div
                        className={`p-3 rounded-md text-sm ${
                          revalidateResult.result.isValid
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                      >
                        {revalidateResult.result.isValid ? (
                          <span>✓ 連線成功 - 讀取權限：{revalidateResult.result.hasReadPermission ? '✓' : '✗'} | 交易權限：{revalidateResult.result.hasTradePermission ? '✓' : key.exchange === 'gateio' || key.exchange === 'mexc' ? '⚠️ 無法驗證' : '✗'}</span>
                        ) : (
                          <span>✗ 連線失敗 - {revalidateResult.result.error?.message || '未知錯誤'}</span>
                        )}
                        <button
                          onClick={() => setRevalidateResult(null)}
                          className="ml-2 text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
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
