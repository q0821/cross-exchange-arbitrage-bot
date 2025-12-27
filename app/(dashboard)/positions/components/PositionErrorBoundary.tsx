/**
 * PositionErrorBoundary - 持倉相關組件的錯誤邊界
 *
 * Feature 033: Manual Open Position (T034)
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PositionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PositionErrorBoundary] Error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-loss flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-loss mb-2">
                發生錯誤
              </h3>
              <p className="text-sm text-loss mb-4">
                載入持倉資料時發生錯誤。請嘗試重新載入頁面。
              </p>
              {this.state.error && (
                <p className="text-xs text-loss font-mono bg-loss/10 p-2 rounded mb-4">
                  {this.state.error.message}
                </p>
              )}
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-loss rounded-md hover:bg-loss/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重試
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
