"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  GraduationCap,
  Trophy,
  Award,
  BookMarked,
  BarChart3,
  Settings,
  LogOut,
  Home,
  ClipboardCheck,
} from "lucide-react";

interface SidebarProps {
  user: {
    name: string;
    role: string;
    level: number;
    xp: number;
    streakDays: number;
  };
  onLogout: () => void;
}

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: Home },
  { href: "/learn", label: "学習モード", icon: BookOpen },
  { href: "/test", label: "テストモード", icon: ClipboardCheck },
  { href: "/exam", label: "卒業検定", icon: GraduationCap },
  { href: "/glossary", label: "用語集", icon: BookMarked },
  { href: "/ranking", label: "ランキング", icon: BarChart3 },
  { href: "/badges", label: "バッジ・称号", icon: Award },
];

const adminItems = [
  { href: "/admin/questions", label: "問題管理", icon: Settings },
  { href: "/admin/glossary", label: "用語管理", icon: Settings },
];

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen sticky top-0 shrink-0 bg-white border-r border-border flex flex-col">
      {/* Logo / Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-bold text-primary">住宅営業育成</h1>
        <p className="text-xs text-muted-foreground mt-1">学習プラットフォーム</p>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-border">
        <p className="font-medium text-sm">{user.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            Lv.{user.level}
          </span>
          <span className="text-xs text-muted-foreground">{user.xp} XP</span>
        </div>
        {user.streakDays > 0 && (
          <p className="text-xs text-orange-500 mt-1">🔥 {user.streakDays}日連続</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {user.role === "ADMIN" && (
          <>
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                管理
              </p>
            </div>
            <ul className="space-y-1 px-2">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
