import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BackLink from '@/components/BackLink';
import Markdown from '@/components/Markdown';
import { bySlug, dashboards, pages, TYPE_LABEL, titles } from '@/lib/data';
import { readingPosition } from '@/lib/reading';
import { CHIP, H2, PAPER } from '@/lib/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return pages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = bySlug[slug];
  return { title: page?.title ?? '문서' };
}

function PageList({ slugs }: { slugs: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {slugs.map((s) => (
        <li key={s}>
          <Link
            href={`/wiki/${s}`}
            className={CHIP}
          >
            {titles[s] ?? s}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function WikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = bySlug[slug];
  if (!page) notFound();
  const reading = readingPosition(dashboards.reading, slug);

  return (
    <article>
      <header className="mb-6 border-b border-divider pb-4">
        <BackLink titles={titles} />
        <h1 className="font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">{page.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-2">
          <span className="rounded-full bg-fg/10 px-2.5 py-0.5">{TYPE_LABEL[page.type]}</span>
          {page.tags.map((t) => (
            <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="underline decoration-dotted">
              #{t}
            </Link>
          ))}
          <span>갱신 {page.updated}</span>
        </div>
      </header>

      <Markdown>{page.body}</Markdown>

      {reading && (
        <nav aria-label="학습 순서 이동" data-testid="reading-nav" className="mt-8 flex items-stretch justify-between gap-3 text-sm">
          {reading.prev ? (
            <Link href={`/wiki/${reading.prev.slugs[0]}`} data-testid="reading-prev" className={`min-w-0 flex-1 p-3 hover:bg-hover ${PAPER}`}>
              <span className="block text-xs text-fg-2">← 이전 ({reading.prev.n}/{reading.total})</span>
              <span className="block break-words font-medium">{titles[reading.prev.slugs[0]]}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {reading.next ? (
            <Link href={`/wiki/${reading.next.slugs[0]}`} data-testid="reading-next" className={`min-w-0 flex-1 p-3 text-right hover:bg-hover ${PAPER}`}>
              <span className="block text-xs text-fg-2">다음 ({reading.next.n}/{reading.total}) →</span>
              <span className="block break-words font-medium">{titles[reading.next.slugs[0]]}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}

      <section className="mt-10 space-y-8 border-t border-divider pt-6">
        <div className={`p-4 ${PAPER}`}>
          <h2 className={`mb-2 ${H2}`}>출처 (원문 링크)</h2>
          {page.sourceLinks.length === 0 ? (
            <p className="text-sm text-fg-2">등록된 출처가 없습니다.</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="source-links">
              {page.sourceLinks.map((s) => (
                <li key={s.path} className="min-w-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline">
                    {s.label}
                  </a>
                  {s.fetched && <span className="ml-2 text-fg-2">수집 {s.fetched}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`p-4 ${PAPER}`}>
          <h2 className={`mb-2 ${H2}`}>이 문서를 링크한 문서</h2>
          {page.backlinks.length === 0 ? <p className="text-sm text-fg-2">없음</p> : <div data-testid="backlinks"><PageList slugs={page.backlinks} /></div>}
        </div>
        {page.outgoing.length > 0 && (
          <div className={`p-4 ${PAPER}`}>
            <h2 className={`mb-2 ${H2}`}>관련 문서</h2>
            <PageList slugs={page.outgoing} />
          </div>
        )}
      </section>
    </article>
  );
}
