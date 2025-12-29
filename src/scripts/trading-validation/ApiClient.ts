/**
 * Web API 呼叫模組
 * 透過 axios 呼叫本地 Web API
 * Feature: 049-trading-validation-script
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  OpenPositionRequest,
  OpenPositionResponse,
  ClosePositionResponse,
} from './types';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 60000; // 60 秒

/**
 * API 呼叫錯誤
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Web API 客戶端
 */
export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = API_BASE) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 開倉
   */
  async openPosition(params: OpenPositionRequest): Promise<OpenPositionResponse> {
    try {
      const response = await this.client.post<OpenPositionResponse>(
        '/api/positions/open',
        params,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, '開倉失敗');
    }
  }

  /**
   * 平倉
   */
  async closePosition(positionId: string): Promise<ClosePositionResponse> {
    try {
      const response = await this.client.post<ClosePositionResponse>(
        `/api/positions/${positionId}/close`,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error, '平倉失敗');
    }
  }

  /**
   * 查詢持倉
   */
  async getPosition(positionId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/positions/${positionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, '查詢持倉失敗');
    }
  }

  /**
   * 處理錯誤
   */
  private handleError(error: unknown, context: string): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status;
      const responseData = axiosError.response?.data;

      // 提取錯誤訊息
      let message = context;
      if (responseData && typeof responseData === 'object') {
        const data = responseData as Record<string, unknown>;
        if (data.error) {
          message = `${context}: ${data.error}`;
        } else if (data.message) {
          message = `${context}: ${data.message}`;
        }
      }

      // 處理特定錯誤
      if (statusCode === 400) {
        message = `${context}: 請求參數錯誤`;
      } else if (statusCode === 401) {
        message = `${context}: 未授權，請檢查登入狀態`;
      } else if (statusCode === 404) {
        message = `${context}: 資源不存在`;
      } else if (statusCode === 500) {
        message = `${context}: 伺服器內部錯誤`;
      } else if (axiosError.code === 'ECONNREFUSED') {
        message = `${context}: 無法連線到伺服器，請確認 Web 服務已啟動`;
      } else if (axiosError.code === 'ETIMEDOUT') {
        message = `${context}: 請求超時`;
      }

      return new ApiError(message, statusCode, responseData);
    }

    if (error instanceof Error) {
      return new ApiError(`${context}: ${error.message}`);
    }

    return new ApiError(context);
  }
}
