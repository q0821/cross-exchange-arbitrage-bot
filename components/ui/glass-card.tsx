import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** 是否使用較深的背景透明度 */
  variant?: 'default' | 'solid';
}

/**
 * GlassCard - Glassmorphism 毛玻璃卡片元件
 * 包含半透明背景、模糊效果和優雅的邊框
 * 自動支援深色/淺色模式
 */
export function GlassCard({ children, className = '', variant = 'default' }: GlassCardProps) {
  const baseClasses = 'rounded-lg border shadow-lg';

  const variantClasses = variant === 'solid'
    ? 'bg-card border-border'
    : 'glass-card';

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </div>
  );
}
