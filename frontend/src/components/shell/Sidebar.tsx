'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  CalendarDays,
  ScanBarcode,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  currentEventId?: number;
}

export function Sidebar({ currentEventId }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    {
      label: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Events',
      href: '/events',
      icon: CalendarDays,
    },
    {
      label: 'Live Scanner',
      href: currentEventId ? `/events/${currentEventId}/scanner` : '/events',
      icon: ScanBarcode,
      highlight: true,
    },
    {
      label: 'Students',
      href: '/students',
      icon: Users,
    },
    {
      label: 'Reports & CSV',
      href: '/reports',
      icon: FileSpreadsheet,
    },
    {
      label: 'Audit & Hash Chain',
      href: '/audit',
      icon: ShieldCheck,
      adminOnly: false,
    },
  ];

  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-neutral-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-xs">
            TX
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              TechXtract
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60">
                Core
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-medium">Event & Attendance System</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Operations
          </div>
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && !item.highlight);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-neutral-800 text-white font-semibold shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                } ${item.highlight ? 'text-blue-400 hover:text-blue-300' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-blue-400' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User profile & Logout */}
      <div className="p-3 border-t border-neutral-800/80">
        <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/60 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-200 truncate">{user?.name || 'Coordinator'}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase tracking-wider">
              {user?.role?.replace('_', ' ') || 'STAFF'}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 truncate mt-0.5">{user?.email}</div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-red-400 hover:bg-red-950/30 transition border border-transparent hover:border-red-900/40"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
