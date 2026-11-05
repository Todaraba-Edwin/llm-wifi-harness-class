import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchClient from '@/components/SearchClient';

export const metadata: Metadata = { title: '검색' };

export default function SearchPage() {
  return (
    <div>
      <p className="mb-2 text-sm text-fg-2">제목, 본문, 태그를 한 번에 찾는 전문 검색입니다. 결과를 누르면 해당 문서로 이동합니다.</p>
      <Suspense fallback={<p>불러오는 중…</p>}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
