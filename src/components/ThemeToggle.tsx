'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { FOCUS_RING_ON_PRIMARY } from '@/lib/ui';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === 'dark';
  // The visible text is the accessible name (WCAG 2.5.3); the state is exposed through aria-pressed.
  return (
    <button
      type="button"
      aria-pressed={dark}
      data-testid="theme-toggle"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={`shrink-0 rounded border border-on-primary/50 px-2.5 py-1.5 text-sm font-medium text-on-primary hover:bg-on-primary/[0.08] aria-pressed:bg-on-primary/[0.16] aria-pressed:font-semibold ${FOCUS_RING_ON_PRIMARY}`}
    >
      다크 모드
    </button>
  );
}
