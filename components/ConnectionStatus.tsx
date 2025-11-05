'use client';

/**
 * ConnectionStatus Component
 *
 * Displays WebSocket connection status with visual indicator
 * Used across the application to show real-time connection state
 */

interface ConnectionStatusProps {
  isConnected: boolean;
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({
  isConnected,
  showLabel = true,
  className = '',
}: ConnectionStatusProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Indicator Dot */}
      <div
        className={`w-2 h-2 rounded-full transition-colors ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`}
        aria-label={isConnected ? 'Connected' : 'Disconnected'}
      />

      {/* Status Label */}
      {showLabel && (
        <span className="text-sm text-gray-600">
          {isConnected ? '即時更新' : '已斷線'}
        </span>
      )}
    </div>
  );
}
