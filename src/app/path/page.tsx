import type { Metadata } from 'next';
import Link from 'next/link';
import { dashboards, titles } from '@/lib/data';
import { splitLeadingTitle } from '@/lib/reading';
import { CHIP, PAPER } from '@/lib/ui';

export const metadata: Metadata = { title: '학습 순서' };

function StepText({ text, links }: { text: string; links: Record<string, string> }) {
  const parts = text.split(/(\b\d{4}\.\d{5}\b)/);
  return (
    <>
      {parts.map((p, i) =>
        links[p] ? (
          <a key={i} href={links[p]} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function PathPage() {
  const steps = dashboards.reading;
  return (
    <div>
      <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">학습 순서</h1>
      <p className="mb-6 text-sm text-fg-2">
        위키 문서{' '}
        <Link href="/wiki/harness-reading-order" className="text-primary underline">
          {titles['harness-reading-order']}
        </Link>
        를 단계별로 보여줍니다. 총 {steps.length}단계.
      </p>
      <ol className="space-y-4" data-testid="path-steps">
        {steps.map((s) => {
          const lead = splitLeadingTitle(s, titles);
          const chips = s.slugs.filter((slug) => slug !== lead?.slug);
          return (
            <li key={s.n} className="flex items-center gap-3" data-testid="path-step">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{s.n}</span>
              <div className={`min-w-0 flex-1 p-3 ${PAPER}`}>
                {lead ? (
                  <>
                    <Link href={`/wiki/${lead.slug}`} className="block break-words font-display font-medium text-primary underline">
                      {lead.title}
                    </Link>
                    <p className="mt-1 break-words text-sm text-fg-2">
                      <StepText text={lead.rest} links={s.arxivLinks} />
                    </p>
                  </>
                ) : (
                  <p className="break-words">
                    <StepText text={s.text} links={s.arxivLinks} />
                  </p>
                )}
                {chips.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {chips.map((slug) => (
                      <li key={slug}>
                        <Link href={`/wiki/${slug}`} className={CHIP}>
                          {titles[slug] ?? slug}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
