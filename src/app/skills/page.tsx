import type { Metadata } from 'next';
import Link from 'next/link';
import { dashboards, titles } from '@/lib/data';
import { H2, PAPER } from '@/lib/ui';

export const metadata: Metadata = { title: '직무 역량' };

export default function SkillsPage() {
  const { skills, postings } = dashboards;
  return (
    <div>
      <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">공고로 본 직무 역량</h1>
      <p className="mb-6 text-sm text-fg-2">
        위키 문서{' '}
        <Link href="/wiki/harness-job-requirements" className="text-primary underline">
          {titles['harness-job-requirements']}
        </Link>
        와{' '}
        <Link href="/wiki/src-job-postings" className="text-primary underline">
          {titles['src-job-postings']}
        </Link>
        를 정리한 화면입니다. 빈도는 엄밀한 통계가 아니라 이 {postings.length}건에서의 관찰입니다.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2" data-testid="skills">
        {skills.map((s) => (
          <li key={s.n} className={`min-w-0 p-3 ${PAPER}`} data-testid="skill-card">
            <h2 className="font-display text-[1.25rem] font-medium leading-[1.6]">
              <span className="mr-2 text-fg-2">{s.n}.</span>
              {s.title}
            </h2>
            <p className="mt-1 break-words text-sm">{s.desc}</p>
            {s.chips.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="관련 회사">
                {s.chips.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/wiki/${c.slug}`} data-testid="skill-chip" className="inline-block rounded-full bg-selected px-2.5 py-0.5 text-primary">
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {s.parenthetical && <p className="mt-1 break-words text-xs text-fg-2">({s.parenthetical})</p>}
            {s.slugs.length > 0 && (
              <p className="mt-2 text-xs">
                {s.slugs.map((slug) => (
                  <Link key={slug} href={`/wiki/${slug}`} className="mr-2 text-primary underline">
                    {titles[slug] ?? slug}
                  </Link>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h2 className={`mb-2 mt-10 ${H2}`}>채용공고 {postings.length}건</h2>
      <p className="mb-3 text-sm text-fg-2">
        공고 링크는 원문 파일의 frontmatter 에 기록된 출처 URL 입니다. 수집 범위의 한계는 위키 문서를 참고하세요.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm" data-testid="postings">
          <thead>
            <tr className="border-b border-divider text-left text-fg-2">
              <th className="p-2">회사</th>
              <th className="p-2">포지션</th>
              <th className="p-2">harness 맥락</th>
              <th className="p-2">공고</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((p) => (
              <tr key={p.url} className="border-b border-divider align-top" data-testid="posting-row">
                <td className="p-2 font-medium">{p.company}</td>
                <td className="p-2">{p.position}</td>
                <td className="p-2">{p.context}</td>
                <td className="p-2">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    원문
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
