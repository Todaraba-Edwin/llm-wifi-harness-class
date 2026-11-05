'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { backTarget, labelFor, parseStack, popBack, readRaw, subscribe } from '@/lib/back-stack';
import { FOCUS_RING } from '@/lib/ui';

/** "← 돌아가기 (이전 문서 제목)" shown only when this page was opened from an inline wikilink. */
export default function BackLink({ titles }: { titles: Record<string, string> }) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readRaw, () => '');
  const target = backTarget(parseStack(raw), pathname);
  if (!target) return null;
  return (
    <Link
      href={target.from}
      data-testid="back-link"
      onClick={() => popBack()}
      className={`mb-2 inline-flex items-center gap-1 rounded px-1 text-sm text-primary hover:bg-primary/[0.04] ${FOCUS_RING}`}
    >
      <span aria-hidden="true">←</span>
      <span>돌아가기 ({labelFor(target.from, titles)})</span>
    </Link>
  );
}
