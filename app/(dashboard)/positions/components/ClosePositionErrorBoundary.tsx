/**
 * ClosePositionErrorBoundary - 平倉組件錯誤邊界
 *
 * 捕獲平倉相關組件的錯誤，提供友好的錯誤提示
 * Feature: 035-close-position (T026)
 */

'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ClosePositionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ClosePositionErrorBoundary] Error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-loss/10 border border-loss/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-loss mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-loss">
                {this.props.fallbackMessage || '平倉操作發生錯誤'}
              </h3>
              <p className="mt-1 text-sm text-loss">
                {this.state.error?.message || '發生未知錯誤，請重試或聯繫客服。'}
              </p>
              <button
                onClick={this.handleReset}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-loss bg-card border border-loss/30 rounded-md hover:bg-loss/10 transition-colors"
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

export default ClosePositionErrorBoundary;
