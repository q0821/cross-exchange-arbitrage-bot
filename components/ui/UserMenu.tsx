'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Key, Bell, Settings, Shield, LogOut, ChevronDown, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface UserMenuProps {
  onLogout: () => void;
  isLoggingOut?: boolean;
}

const settingsLinks = [
  { href: '/settings/security', label: '安全設定', icon: Shield },
  { href: '/settings/api-keys', label: 'API 金鑰管理', icon: Key },
  { href: '/settings/notifications', label: '通知設定', icon: Bell },
  { href: '/settings/trading', label: '交易設定', icon: Settings },
];

export function UserMenu({ onLogout, isLoggingOut = false }: UserMenuProps) {
  const [email, setEmail] = useState<string | null>(null);

  // 從 JWT Cookie 解析用戶 Email
  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('token='))
      ?.split('=')[1];

    if (token) {
      try {
        // JWT 結構: header.payload.signature
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        setEmail(decoded.email || null);
      } catch {
        setEmail(null);
      }
    }
  }, []);

  // 顯示的名稱：Email 或預設值
  const displayName = email || '用戶';
  // 截短 Email 顯示
  const shortEmail = email && email.length > 20 ? `${email.slice(0, 17)}...` : email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground
                     hover:bg-accent/50 rounded-lg transition-colors duration-200 cursor-pointer
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <User className="size-4 text-muted-foreground" />
          <span className="hidden sm:inline">{shortEmail || '用戶'}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* 用戶資訊 */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {email && (
              <p className="text-xs leading-none text-muted-foreground truncate">
                {email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* 設定連結 */}
        {settingsLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href} className="flex items-center gap-2 cursor-pointer">
              <link.icon className="size-4" />
              <span>{link.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* 登出 */}
        <DropdownMenuItem
          onClick={onLogout}
          disabled={isLoggingOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="size-4" />
          <span>{isLoggingOut ? '登出中...' : '登出'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
