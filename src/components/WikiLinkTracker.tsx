'use client';

import { useEffect } from 'react';
import { recordWikilinkClick } from '@/lib/back-stack';

/** Remembers the page a plain click on an inline wikilink came from, so the destination can offer a way back. */
export default function WikiLinkTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a.wikilink') : null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      recordWikilinkClick({ from: window.location.pathname, to: href.split(/[?#]/)[0] });
    };
    // Capture phase: client-side links call preventDefault before a bubbling listener would run.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
