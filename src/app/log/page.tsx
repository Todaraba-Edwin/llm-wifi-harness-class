import type { Metadata } from 'next';
import Markdown from '@/components/Markdown';
import { logBody } from '@/lib/data';

export const metadata: Metadata = { title: '변경 기록' };

export default function LogPage() {
  return (
    <div>
      <p className="mb-4 text-sm text-fg-2">위키 작업 이력(ingest, query, lint 등)을 시간순으로 기록한 문서입니다.</p>
      <Markdown>{logBody}</Markdown>
    </div>
  );
}
