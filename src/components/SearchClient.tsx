'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type MiniSearch from 'minisearch';
import { FOCUS_RING, PAPER } from '@/lib/ui';
import { loadSearchIndex, searchPages, type SearchDoc } from '@/lib/search/search';

const TYPE_LABEL: Record<string, string> = { source: '출처 요약', concept: '개념', entity: '개체', synthesis: '종합' };

export default function SearchClient() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [index, setIndex] = useState<MiniSearch<SearchDoc> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => {
        if (!cancelled) setIndex(loadSearchIndex(t));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [q]);

  const hits = useMemo(() => (index ? searchPages(index, q) : []), [index, q]);

  return (
    <div>
      <h1 className="mb-4 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">검색</h1>
      <input
        autoFocus
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목, 본문, 태그 검색 (예: 컨텍스트, compaction, jobs)"
        aria-label="검색어"
        data-testid="search-input"
        className={`w-full rounded border border-fg/25 bg-surface px-3 py-2 text-fg hover:border-fg ${FOCUS_RING}`}
      />
      <div className="mt-4" aria-live="polite">
        {failed && <p className="text-error">검색 색인을 불러오지 못했습니다.</p>}
        {!failed && !index && <p className="text-fg-2">색인 불러오는 중…</p>}
        {index && q.trim() === '' && <p className="text-fg-2">검색어를 입력하세요.</p>}
        {index && q.trim() !== '' && hits.length === 0 && <p data-testid="no-results">결과가 없습니다.</p>}
        <ul className="space-y-3" data-testid="search-results">
          {hits.map((h) => (
            <li key={h.id} className={`min-w-0 p-3 ${PAPER}`}>
              <Link href={`/wiki/${h.id}`} className="font-medium text-primary underline">
                {h.title}
              </Link>
              <span className="ml-2 rounded-full bg-fg/10 px-2 py-0.5 text-xs">{TYPE_LABEL[h.type] ?? h.type}</span>
              <p className="mt-1 break-words text-sm text-fg-2">{h.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
