'use client';

import { useRef, useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, setCollapsed, subscribe } from '@/lib/sidebar-state';
import { FOCUS_RING_ON_PRIMARY } from '@/lib/ui';

export default function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      data-testid="sidebar-toggle"
      aria-expanded={!collapsed}
      aria-controls="sidebar"
      aria-label={collapsed ? '문서 목록 보기' : '문서 목록 숨기기'}
      onClick={() => {
        setCollapsed(!collapsed);
        ref.current?.focus();
      }}
      className={`hidden shrink-0 rounded p-2 text-on-primary hover:bg-on-primary/[0.08] lg:inline-flex ${FOCUS_RING_ON_PRIMARY}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
